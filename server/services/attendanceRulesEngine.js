/**
 * attendanceRulesEngine.js
 *
 * Central, additive rules engine for advanced attendance policy evaluation.
 * - Pure utility (no direct DB writes)
 * - Consumes AttendanceSettings + daily context
 * - Produces a normalized decision object used by controllers/services
 *
 * NOTE: This module is designed to be backwards-compatible with existing
 * attendance behavior. If advancedPolicy is missing or disabled, the
 * resulting status mirrors the legacy logic (threshold-based).
 */

// Helper: convert "HH:mm" to Date on a given day
function buildShiftDate(baseDate, timeStr, spansNextDay) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(h || 0, m || 0, 0, 0);
    if (spansNextDay && h < 12) {
        // If marked as spanning midnight, treat early-morning end as next day
        d.setDate(d.getDate() + 1);
    }
    return d;
}

// Helper: safe minutes diff (later - earlier)
function diffMinutes(later, earlier) {
    if (!later || !earlier) return 0;
    const ms = later.getTime() - earlier.getTime();
    return Math.round(ms / 60000);
}

function addMinutes(date, minutes) {
    if (!date || !Number.isFinite(Number(minutes))) return null;
    return new Date(date.getTime() + Number(minutes) * 60000);
}

// Helper: week of month (1-5)
function getWeekOfMonth(date) {
    const d = date.getDate();
    return Math.floor((d - 1) / 7) + 1;
}

// Normalize settings.advancedPolicy to avoid repetitive null checks
function getAdvanced(settings) {
    return settings && settings.advancedPolicy ? settings.advancedPolicy : {};
}

/**
 * Determine whether a particular date is a weekly off, considering:
 * - Base settings.weeklyOffDays (backward compatible)
 * - advancedPolicy.weeklyOff.mode
 * - advancedPolicy.weeklyOff.alternateSaturday
 * - advancedPolicy.weeklyOff.employeeOverrides
 *
 * @param {Object} params
 * @param {Date}   params.date
 * @param {Object} params.settings - AttendanceSettings document/POJO
 * @param {String|Object} [params.employeeId] - Optional employee ObjectId string
 * @param {Array<Number>} [params.shiftWeeklyOffs] - Optional shift-specific weekly off days [0-6]
 * @returns {{ isWeeklyOff: boolean, isSaturdayHalfDay: boolean, source: string }}
 */
function isWeeklyOffDate({ date, settings, employeeId, shiftWeeklyOffs }) {
    const day = date.getDay(); // 0-6
    const baseWeeklyOffDays = Array.isArray(shiftWeeklyOffs)
        ? shiftWeeklyOffs
        : (Array.isArray(settings?.weeklyOffDays) ? settings.weeklyOffDays : [0]);

    const adv = getAdvanced(settings);
    const weeklyOffCfg = adv.weeklyOff || {};

    let isWeeklyOff = baseWeeklyOffDays.includes(day);
    let isSaturdayHalfDay = false;
    let source = 'base';

    // Per-employee override (if configured)
    if (weeklyOffCfg.employeeOverrides && employeeId) {
        const empIdStr = String(employeeId);
        const override = weeklyOffCfg.employeeOverrides.find(o => String(o.employee) === empIdStr);
        if (override) {
            const overrideDays = Array.isArray(override.weeklyOffDays) ? override.weeklyOffDays : [];
            isWeeklyOff = overrideDays.includes(day);
            isSaturdayHalfDay = !!override.saturdayHalfDayEnabled && day === 6;
            source = 'employeeOverride';
            return { isWeeklyOff, isSaturdayHalfDay, source };
        }
    }

    // Global weekly off mode
    switch (weeklyOffCfg.mode) {
        case 'sunday':
            isWeeklyOff = (day === 0);
            source = 'mode_sunday';
            break;
        case 'saturday_sunday':
            isWeeklyOff = (day === 0 || day === 6);
            source = 'mode_saturday_sunday';
            break;
        case 'alternate_saturday':
            if (day === 6) {
                const week = getWeekOfMonth(date);
                const offWeeks = Array.isArray(weeklyOffCfg.alternateSaturday?.offWeeks)
                    ? weeklyOffCfg.alternateSaturday.offWeeks
                    : [2, 4];
                if (offWeeks.includes(week)) {
                    isWeeklyOff = true;
                    source = 'mode_alternate_saturday_off';
                } else {
                    isWeeklyOff = false;
                    source = 'mode_alternate_saturday_working';
                }
            } else {
                isWeeklyOff = baseWeeklyOffDays.includes(day);
                source = 'mode_alternate_saturday_base';
            }
            break;
        case 'custom':
        case 'basic':
        default:
            // Respect base weeklyOffDays only
            isWeeklyOff = baseWeeklyOffDays.includes(day);
            source = 'base';
            break;
    }

    // Saturday half-day flag (global)
    if (day === 6 && weeklyOffCfg.saturdayHalfDayEnabled) {
        isSaturdayHalfDay = true;
    }

    return { isWeeklyOff, isSaturdayHalfDay, source };
}

/**
 * Compute late & early-exit metrics for a given day, based on first IN and last OUT.
 *
 * @param {Object} params
 * @param {Date}   params.date
 * @param {Array}  params.logs - Attendance.logs array
 * @param {Object} params.settings - AttendanceSettings
 * @returns {{
 *   isLate: boolean,
 *   isEarlyOut: boolean,
 *   lateMinutes: number,
 *   earlyExitMinutes: number,
 *   firstIn: Date | null,
 *   lastOut: Date | null
 * }}
 */
// Helper: Check if time is after threshold
function isAfter(time, threshold) {
    return time.getTime() > threshold.getTime();
}

// Helper: Check if time is before threshold
function isBefore(time, threshold) {
    return time.getTime() < threshold.getTime();
}

/**
 * Compute late & early-exit metrics for a given day, based on first IN and last OUT.
 *
 * @param {Object} params
 * @param {Date}   params.date
 * @param {Array}  params.logs - Attendance.logs array
 * @param {Object} params.settings - AttendanceSettings
 * @returns {{
 *   isLate: boolean,
 *   isEarlyOut: boolean,
 *   lateMinutes: number,
 *   earlyExitMinutes: number,
 *   firstIn: Date | null,
 *   lastOut: Date | null
 * }}
 */
function evaluateLateAndEarly({ date, logs, settings, shiftStart: shiftStartOverride, shiftEnd: shiftEndSubstitute, graceMin: graceMinOverride, isNightShift }) {
    const adv = getAdvanced(settings);
    const lateCfg = adv.lateMarkRules || {};
    const earlyCfg = adv.earlyExitRules || {};
    const nightCfg = adv.nightShiftRules || {};
    const gradeTiming = adv.gradeTiming || {};

    // Default fallback values if settings are missing
    // Shift-specific overrides (from employee shift assignment) take priority
    const isFlexibleGradeTiming = gradeTiming.enabled && gradeTiming.timingType === 'flexible';
    const shiftStartTimeStr = isFlexibleGradeTiming
        ? (gradeTiming.flexibleWindowEnd || gradeTiming.shiftStartTime || settings.shiftStartTime || '09:00')
        : (shiftStartOverride || gradeTiming.shiftStartTime || settings.shiftStartTime || '09:00');
    const shiftEndTimeStr = shiftEndSubstitute || gradeTiming.shiftEndTime || settings.shiftEndTime || '18:00';
    const graceTime = graceMinOverride != null ? graceMinOverride : (settings.graceTimeMinutes || 0);
    const allowedLate = lateCfg.allowedLateMinutesPerDay || 0;
    const allowedEarly = earlyCfg.allowedEarlyMinutesPerDay || 0;

    const spansMidnight = isNightShift != null ? isNightShift : !!nightCfg.shiftSpansMidnight;

    const shiftStart = buildShiftDate(date, shiftStartTimeStr, false);
    let shiftEnd = buildShiftDate(date, shiftEndTimeStr, spansMidnight);

    let firstIn = null;
    let lastOut = null;

    (logs || []).forEach(l => {
        if (!l || !l.time || !l.type) return;
        const t = new Date(l.time);
        if (l.type === 'IN') {
            if (!firstIn || t < firstIn) firstIn = t;
        } else if (l.type === 'OUT') {
            if (!lastOut || t > lastOut) lastOut = t;
        }
    });

    if (isFlexibleGradeTiming && firstIn) {
        const requiredWorkMinutes = Number(gradeTiming.requiredWorkMinutes);
        if (Number.isFinite(requiredWorkMinutes) && requiredWorkMinutes > 0) {
            shiftEnd = addMinutes(firstIn, requiredWorkMinutes);
        }
    }

    let lateMinutes = 0;
    let earlyExitMinutes = 0;
    let isLate = false;
    let isEarlyOut = false;

    // --- LATE CALCULATION ---
    // Rule: Late if (PunchTime > ShiftStart + Grace)
    // Note: 'Allowed Late Minutes' usually acts as an extension to grace OR a specific allowance.
    // Interpret 'allowedLateMinutesPerDay' as ADDITIONAL tolerance? 
    // Usually standard is: ShiftStart + Grace = Late Threshold. 
    // If user exceeds that, they are "LATE". 
    // "Allowed Late Minutes" might mean "Late but excused". 
    // For counting "Late Marks", we typically look at if they exceeded the grace period.

    if (shiftStart && firstIn) {
        // Calculate raw difference
        const diff = diffMinutes(firstIn, shiftStart); // Positive if late

        if (diff > 0) {
            lateMinutes = diff;

            // Effective threshold for being marked "LATE" (for count purposes)
            // Usually, if you are late beyond grace time, it counts as a late mark.
            const lateThresholdMinutes = settings.lateMarkThresholdMinutes || graceTime;

            // If diff > graceTime, it is technically late. 
            // However, some systems only mark 'isLate' flag if diff > threshold.
            // Let's stick to: isLate = True if (Arrival > ShiftStart + Grace)

            // CUSTOM IMPLEMENTATION: User explicitly requested 15 mins allowance
            const effectiveGraceTime = Math.max(graceTime || 0, 15);
            if (lateMinutes > (isFlexibleGradeTiming ? 0 : effectiveGraceTime)) {
                isLate = true;
            }

            // If 'allowedLateMinutesPerDay' is configured, perhaps we only flag if > allowed?
            // The user req says: "If employee exceeds ALLOWED_LATE_MINUTES per day, then that should count toward LATE MARKS."
            if (lateCfg.enabled && allowedLate > 0) {
                isLate = lateMinutes > allowedLate;
            }
        }
    }

    // --- EARLY EXIT CALCULATION ---
    // Rule: Early if (PunchTime < ShiftEnd - AllowedEarly)
    if (shiftEnd && lastOut) {
        // diffMinutes(later, earlier) -> (lastOut, shiftEnd)
        // If lastOut is BEFORE shiftEnd, diff is negative.
        // We want minutes BEFORE shift end.
        const msDiff = shiftEnd.getTime() - lastOut.getTime();

        if (msDiff > 0) {
            earlyExitMinutes = Math.round(msDiff / 60000);

            // Check if it exceeds allowed limit
            // If strict, any early exit is flagged.
            // If allowedEarly is set, only flag if exceeded.
            if (earlyExitMinutes > allowedEarly) {
                isEarlyOut = true;
            }
        }
    }

    return { isLate, isEarlyOut, lateMinutes, earlyExitMinutes, firstIn, lastOut };
}

/**
 * Apply full attendance rules for a single day.
 */
function applyAttendanceRules(params) {
    const {
        date,
        employeeId,
        logs,
        workingHours: inputWorkingHours,
        baseStatus,
        settings,
        accumulatedLateCount = 0, // Count of PREVIOUS late marks in this cycle
        accumulatedEarlyExitCount = 0, // Count of PREVIOUS early exits in this cycle
        isHoliday = false,
        hasApprovedLeave = false,
        leaveType = null,
        dayTag = null,
        // Shift-specific overrides (optional — passed from punch controller when employee has a shift assigned)
        shiftStart: shiftStartOverride = null,
        shiftEnd: shiftEndOverride = null,
        graceMin: graceMinOverride = null,
        lateMin: _lateMinOverride = null, // reserved for future use in policy expansion
        isNightShift: shiftIsNightShift = false,
        shiftPolicy = null, // Dynamic ShiftPolicy from DB
    } = params;

    // Safety check for settings
    if (!settings) throw new Error("AttendanceSettings are required for rules engine");

    const adv = getAdvanced(settings);
    const halfCfg = adv.halfDayRules || {};
    const absentCfg = adv.absentRules || {};
    const wfhCfg = adv.wfhSettings || {};
    const odCfg = adv.odSettings || {};
    const compCfg = adv.compOffSettings || {};
    const nightCfg = adv.nightShiftRules || {};
    const lateCfg = adv.lateMarkRules || {};
    const earlyCfg = adv.earlyExitRules || {};

    const { isWeeklyOff, isSaturdayHalfDay, source: weeklyOffSource } = isWeeklyOffDate({
        date,
        settings,
        employeeId
    });

    // 1. Re-evaluate metrics based on logs — pass shift overrides for accurate late/early calc
    const lateEarly = evaluateLateAndEarly({
        date,
        logs,
        settings,
        shiftStart: shiftStartOverride,
        shiftEnd: shiftEndOverride,
        graceMin: graceMinOverride,
        isNightShift: shiftIsNightShift,
    });

    let status = baseStatus || 'absent';
    let workingHours = typeof inputWorkingHours === 'number' ? inputWorkingHours : 0;
    let isLate = lateEarly.isLate;
    let isEarlyOut = lateEarly.isEarlyOut;
    let lateMinutes = lateEarly.lateMinutes;
    let earlyExitMinutes = lateEarly.earlyExitMinutes;
    let lopDays = 0;

    const meta = {
        weeklyOff: { isWeeklyOff, isSaturdayHalfDay, source: weeklyOffSource },
        lateEarly,
        policyViolations: [] // Store messages for frontend popups
    };

    // --- BASE STATUS DETERMINATION ---
    // If no specific override, determine status from working hours
    const fullDayThreshold = settings.fullDayThresholdHours || 7;
    const halfDayThreshold = settings.halfDayThresholdHours || 4;

    if (!['leave', 'holiday', 'weekly_off'].includes(status)) {
        if (workingHours >= fullDayThreshold) {
            status = 'present';
        } else if (workingHours >= halfDayThreshold) {
            status = 'half_day';
        } else if (workingHours > 0) {
            status = 'half_day'; // Worked some hours but less than half threshold -> usually half day or absent depending on policy
            // If strict, absent. But user wants "Mark Half Day" logic to work, so default to half_day allows us to apply penalties.
            // Actually, if < halfDayThreshold, it's typically Absent.
            if (workingHours < halfDayThreshold) {
                status = 'absent';
            }
        } else {
            status = 'absent';
        }
    }

    // --- PRIORITY 1: HARD OVERRIDES ---
    if (isHoliday) {
        return createResult('holiday', false, false, 0, meta);
    }
    if (isWeeklyOff) {
        // If punched on weekly off, it might be Overtime or Comp-off?
        // User requirement: "Today is weekly off" popup
        if (logs.length > 0) {
            meta.policyViolations.push("Marked attendance on Weekly Off");
            // If they worked, maybe mark as Present? 
            // For now, respect rule: if punched, it's present/working on off day.
            // But let's flag it.
            return createResult('present', false, false, 0, { ...meta, isCompOffDay: true });
        }
        return createResult('weekly_off', false, false, 0, meta);
    }
    if (hasApprovedLeave) {
        return createResult('leave', false, false, 0, { ...meta, leaveType });
    }

    // --- PRIORITY 2: DAY TAGS ---
    if (dayTag === 'WFH' && wfhCfg.enabled) {
        if (wfhCfg.autoPresentMode === 'auto_present') status = 'present';
        meta.isWFH = true;
    }
    if (dayTag === 'OD' && odCfg.enabled) {
        status = 'present';
        meta.isOnDuty = true;
    }

    // --- PRIORITY 3: PENALTY RULES (LATE & EARLY) ---
    // Only apply penalties if status is Present or Half Day (don't penalize if already Absent)
    if (['present', 'half_day'].includes(status)) {

        // A. LATE MARKS LOGIC
        if (isLate) {
            meta.policyViolations.push(`Late Arrival Detected (${lateMinutes} min)`);

            // Check Daily Late Marks from Dynamic ShiftPolicy
            let dailyActionApplied = false;
            if (shiftPolicy?.attendanceRules?.lateMarks && shiftPolicy.attendanceRules.lateMarks.length > 0) {
                // Find matching rule (assuming sorted or we just find first match where lateMinutes > rule.minutes)
                const matchingRule = [...shiftPolicy.attendanceRules.lateMarks]
                    .sort((a, b) => b.minutes - a.minutes) // Sort descending to match highest penalty first
                    .find(r => r.conditionType === 'GREATER_THAN' ? lateMinutes > r.minutes : lateMinutes < r.minutes);
                
                if (matchingRule) {
                    dailyActionApplied = true;
                    const action = matchingRule.action;
                    if (action === 'HALF_DAY' && status !== 'absent') {
                        status = 'half_day';
                        lopDays = Math.max(lopDays, 0.5);
                        meta.policyViolations.push(`Daily Policy: Late > ${matchingRule.minutes}m = Half Day`);
                        meta.penaltyApplied = 'late_half_day';
                    } else if (action === 'FULL_DAY' || action === 'ABSENT') {
                        status = 'absent';
                        lopDays = Math.max(lopDays, 1);
                        meta.policyViolations.push(`Daily Policy: Late > ${matchingRule.minutes}m = Full Day Absent`);
                        meta.penaltyApplied = 'late_lop_full';
                    } else if (action === 'DEDUCT_LEAVE') {
                        meta.policyViolations.push(`Daily Policy: Late > ${matchingRule.minutes}m = Deduct Leave`);
                        meta.penaltyApplied = 'late_deduct_leave';
                        meta.leaveDeductType = matchingRule.leaveTypeToDeduct;
                    }
                }
            }

            // Monthly Late Conversion (e.g. 3 late marks = 1 LWP)
            if (!dailyActionApplied || status !== 'absent') {
                if (shiftPolicy?.attendanceRules) {
                    const currentLateCount = accumulatedLateCount + 1;
                    const convToHalfDay = shiftPolicy.attendanceRules.monthlyLateToHalfDayConversion;
                    const lateAction = shiftPolicy.attendanceRules.monthlyLateAction;
                    
                    if (convToHalfDay > 0 && currentLateCount % convToHalfDay === 0) {
                        if (lateAction === 'HALF_DAY' && status !== 'absent') {
                            status = 'half_day';
                            lopDays = Math.max(lopDays, 0.5);
                            meta.policyViolations.push(`Monthly Policy: ${currentLateCount} late marks = Half Day`);
                            meta.penaltyApplied = 'late_half_day';
                        } else if (lateAction === 'DEDUCT_LEAVE') {
                            meta.policyViolations.push(`Monthly Policy: ${currentLateCount} late marks = Deduct ${shiftPolicy.attendanceRules.monthlyLateLeaveDeductType}`);
                            meta.penaltyApplied = 'late_deduct_leave';
                            meta.leaveDeductType = shiftPolicy.attendanceRules.monthlyLateLeaveDeductType;
                        } else if (lateAction === 'LWP' || lateAction === 'FULL_DAY') {
                            status = 'absent';
                            lopDays = Math.max(lopDays, 1);
                            meta.policyViolations.push(`Monthly Policy: ${currentLateCount} late marks = 1 Day LOP`);
                            meta.penaltyApplied = 'late_lop_full';
                        }
                    }
                // CUSTOM IMPLEMENTATION: 15 min late 3 times allowed, 4th time = Half Day
                } else if (lateCfg.enabled || true) {
                    const currentLateCount = accumulatedLateCount + 1;

                    // Fallback to 4 if user didn't explicitly configure it
                    const marksToHalfDay = lateCfg.lateMarksToHalfDay || 4; 

                    // Check LOP Threshold First (Severity High)
                    if (lateCfg.lateMarksToFullDay > 0 && currentLateCount % lateCfg.lateMarksToFullDay === 0) {
                        status = 'absent'; // Full Day LOP implies Absent equivalent for payroll
                        lopDays = Math.max(lopDays, 1);
                        meta.policyViolations.push(`Late Mark Policy: ${currentLateCount} late marks = 1 Day LOP`);
                        meta.penaltyApplied = 'late_lop_full';
                    }
                    // Check Half Day Threshold (Severity Medium)
                    else if (marksToHalfDay > 0 && currentLateCount % marksToHalfDay === 0) {
                        if (status !== 'absent') { // Don't downgrade if already absent
                            status = 'half_day';
                            lopDays = Math.max(lopDays, 0.5);
                            meta.policyViolations.push(`Late Mark Policy: ${currentLateCount} late marks = Half Day`);
                            meta.penaltyApplied = 'late_half_day';
                        }
                    }
                }
            }
        }

        // B. EARLY EXIT LOGIC
        if (isEarlyOut) {
            meta.policyViolations.push(`Early Exit Detected (${earlyExitMinutes} min)`);

            // Check Daily Early Exits from Dynamic ShiftPolicy
            let dailyEarlyActionApplied = false;
            if (shiftPolicy?.attendanceRules?.earlyExits && shiftPolicy.attendanceRules.earlyExits.length > 0) {
                // Find matching rule
                const matchingRule = [...shiftPolicy.attendanceRules.earlyExits]
                    .sort((a, b) => b.minutes - a.minutes)
                    .find(r => r.conditionType === 'GREATER_THAN' ? earlyExitMinutes > r.minutes : earlyExitMinutes < r.minutes);
                
                if (matchingRule) {
                    dailyEarlyActionApplied = true;
                    const action = matchingRule.action;
                    if (action === 'HALF_DAY' && status !== 'absent') {
                        status = 'half_day';
                        lopDays = Math.max(lopDays, 0.5);
                        meta.policyViolations.push(`Daily Policy: Early Exit > ${matchingRule.minutes}m = Half Day`);
                        meta.penaltyApplied = 'early_half_day';
                    } else if (action === 'FULL_DAY' || action === 'ABSENT') {
                        status = 'absent';
                        lopDays = Math.max(lopDays, 1);
                        meta.policyViolations.push(`Daily Policy: Early Exit > ${matchingRule.minutes}m = Full Day Absent`);
                        meta.penaltyApplied = 'early_lop_full';
                    } else if (action === 'DEDUCT_LEAVE') {
                        meta.policyViolations.push(`Daily Policy: Early Exit > ${matchingRule.minutes}m = Deduct Leave`);
                        meta.penaltyApplied = 'early_deduct_leave';
                        meta.leaveDeductType = matchingRule.leaveTypeToDeduct;
                    }
                }
            }

            if (!dailyEarlyActionApplied || status !== 'absent') {
                if (earlyCfg.enabled) {
                    const currentEarlyCount = accumulatedEarlyExitCount + 1;

                    // Check LOP Threshold
                    if (earlyCfg.earlyExitsToFullDay > 0 && currentEarlyCount % earlyCfg.earlyExitsToFullDay === 0) {
                        status = 'absent';
                        lopDays = Math.max(lopDays, 1);
                        meta.policyViolations.push(`Early Exit Policy: ${currentEarlyCount} early exits = 1 Day LOP`);
                        meta.penaltyApplied = 'early_lop_full';
                    }
                    // Check Half Day Threshold
                    else if (earlyCfg.earlyExitsToHalfDay > 0 && currentEarlyCount % earlyCfg.earlyExitsToHalfDay === 0) {
                        if (status !== 'absent') {
                            status = 'half_day';
                            lopDays = Math.max(lopDays, 0.5); // Keep existing LOP if higher
                            meta.policyViolations.push(`Early Exit Policy: ${currentEarlyCount} early exits = Half Day`);
                            meta.penaltyApplied = 'early_half_day';
                        }
                    }
                }
            }
        }
    }

    // --- PRIORITY 4: HALF DAY WORKING HOURS ---
    if (halfCfg.enabled && status === 'present') {
        if (halfCfg.workingHoursThreshold > 0 && workingHours < halfCfg.workingHoursThreshold && workingHours > 0) {
            status = 'half_day';
            lopDays = Math.max(lopDays, 0.5);
            meta.policyViolations.push("Working hours below full-day threshold");
        }
    }

    // --- PRIORITY 5: OVERTIME ENGINE ---
    let otMinutes = 0;
    let otMultiplierApplied = 1.0;

    if (shiftPolicy?.overtimeEngine?.isEligible && workingHours > 0) {
        // Find required working hours for the shift
        let requiredHours = 8; // Default fallback
        if (shiftStartOverride && shiftEndOverride) {
            const sStart = buildShiftDate(date, shiftStartOverride, false);
            const sEnd = buildShiftDate(date, shiftEndOverride, shiftIsNightShift);
            if (sStart && sEnd) {
                requiredHours = diffMinutes(sEnd, sStart) / 60;
            }
        }
        
        const excessMinutes = Math.round((workingHours - requiredHours) * 60);
        if (excessMinutes >= (shiftPolicy.overtimeEngine.minimumMinutesToQualify || 0)) {
            otMinutes = Math.min(excessMinutes, shiftPolicy.overtimeEngine.maximumMinutesPerDay || 9999);
            
            // Determine Multiplier
            if (isHoliday) otMultiplierApplied = shiftPolicy.overtimeEngine.holidayMultiplier || 2.0;
            else if (isWeeklyOff) otMultiplierApplied = shiftPolicy.overtimeEngine.weeklyOffMultiplier || 2.0;
            else if (shiftIsNightShift) otMultiplierApplied = shiftPolicy.overtimeEngine.nightShiftMultiplier || 1.5;
            else otMultiplierApplied = shiftPolicy.overtimeEngine.normalMultiplier || 1.0;
        }
    }

    // Result Construction
    return {
        status,
        isLate,
        isEarlyOut,
        workingHours,
        lateMinutes,
        earlyExitMinutes,
        isWFH: !!meta.isWFH,
        isOnDuty: !!meta.isOnDuty,
        isCompOffDay: !!meta.isCompOffDay,
        isNightShift: !!shiftIsNightShift || (!!nightCfg.enabled && !!nightCfg.shiftSpansMidnight),
        lopDays,
        otMinutes,
        otMultiplierApplied,
        engineVersion: 2,
        meta,
        policyViolations: meta.policyViolations // Expose at top level for easy access
    };
}

function createResult(status, isLate, isEarlyOut, lop, meta) {
    return {
        status, isLate, isEarlyOut,
        workingHours: 0, lateMinutes: 0, earlyExitMinutes: 0,
        isWFH: false, isOnDuty: false, isCompOffDay: false, isNightShift: false,
        lopDays: lop, engineVersion: 2, meta,
        policyViolations: meta.policyViolations || []
    };
}


module.exports = {
    applyAttendanceRules,
    isWeeklyOffDate,
    evaluateLateAndEarly
};

