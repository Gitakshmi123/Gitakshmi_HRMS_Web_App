/**
 * shiftPolicyEngine.js
 *
 * Enterprise-grade Shift Policy Engine.
 * Resolves the effective shift for an employee on a date and runs the full
 * attendance calculation pipeline using that policy.
 *
 * IMPORTANT: Pure logic — no direct DB writes. 
 * Wraps / extends the existing attendanceRulesEngine.js without modifying it.
 */

const ShiftSchema = require('../models/Shift');
const ShiftAssignmentSchema = require('../models/ShiftAssignment');

// ─────────────────────────────────────────────────────────────────────────────
//  INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function hhmm(timeStr, baseDate, spansNextDay = false) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(baseDate);
    d.setHours(h, m, 0, 0);
    if (spansNextDay && h < 12) d.setDate(d.getDate() + 1);
    return d;
}

function diffMins(a, b) {
    if (!a || !b) return 0;
    return Math.round((a.getTime() - b.getTime()) / 60000);
}

function getWeekOfMonth(date) {
    return Math.floor((date.getDate() - 1) / 7) + 1;
}

// Round OT minutes according to policy rounding mode
function roundOT(raw, mode) {
    if (!mode || mode === 'none') return raw;
    const [dir, mins] = mode.split('_').slice(1);
    const unit = parseInt(mins, 10);
    if (!unit) return raw;
    if (dir === 'up') return Math.ceil(raw / unit) * unit;
    if (dir === 'down') return Math.floor(raw / unit) * unit;
    return raw;
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. RESOLVE EFFECTIVE SHIFT
//     Priority: active override → active standard assignment → null
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the effective shift policy document for an employee on a given date.
 *
 * @param {string}   employeeId  - Mongoose ObjectId string
 * @param {Date}     date        - Attendance date
 * @param {object}   tenantDB    - req.tenantDB (multi-tenant DB connection)
 * @returns {Promise<{ shift: object|null, source: string }>}
 */
async function resolveEffectiveShift(employeeId, date, tenantDB) {
    if (!tenantDB) throw new Error('Tenant DB connection required');

    const Assignment = tenantDB.model('ShiftAssignment', ShiftAssignmentSchema);
    const Shift = tenantDB.model('Shift', ShiftSchema);

    const targetDate = new Date(date);

    const dateFilter = {
        employee: employeeId,
        isActive: true,
        effectiveFrom: { $lte: targetDate },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gte: targetDate } }],
    };

    // Override takes priority
    const override = await Assignment.findOne({ ...dateFilter, isOverride: true })
        .sort({ effectiveFrom: -1 })
        .lean();

    if (override) {
        const shift = await Shift.findOne({ _id: override.shift, isDeleted: false }).lean();
        return { shift, source: 'override', assignment: override };
    }

    // Standard assignment
    const standard = await Assignment.findOne({ ...dateFilter, isOverride: false })
        .sort({ effectiveFrom: -1 })
        .lean();

    if (standard) {
        const shift = await Shift.findOne({ _id: standard.shift, isDeleted: false }).lean();
        return { shift, source: 'assignment', assignment: standard };
    }

    // No assignment found — caller should use global attendance settings
    return { shift: null, source: 'none', assignment: null };
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. BUILD ATTENDANCE WINDOW
//     Converts shift policy → concrete Date objects for the target day
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} shift      - Shift document (POJO)
 * @param {Date}   date       - Attendance date (start of day local)
 * @returns {{
 *   shiftStart: Date,
 *   shiftEnd: Date,
 *   breakDeductionMinutes: number,
 *   graceLate: number,
 *   graceEarly: number,
 *   fullDayThresholdHours: number,
 *   halfDayThresholdHours: number,
 *   isNight: boolean,
 *   punchMode: string,        // 'single' | 'multi'
 *   otStartAfterMinutes: number,
 *   otRoundingMode: string,
 *   separateNightOT: boolean
 * }}
 */
function buildAttendanceWindow(shift, date) {
    const isNight = !!shift.isNightShift;
    const wh = shift.workingHoursCfg || {};
    const pm = shift.punchMode || {};
    const ot = shift.overtimeCfg || {};

    // Break deduction: use shift.breakMinutes if break tracking is on
    const breakDeductionMinutes = pm.deductBreakFromHours && pm.breakTrackingEnabled
        ? (shift.breakMinutes || 0)
        : 0;

    return {
        shiftStart: hhmm(shift.startTime, date, false),
        shiftEnd: hhmm(shift.endTime, date, isNight),
        breakDeductionMinutes,
        graceLate: wh.graceLateMinutes ?? shift.graceMinutes ?? 15,
        graceEarly: wh.graceEarlyMinutes ?? shift.graceEarly ?? 15,
        fullDayThresholdHours: wh.fullDayThresholdHours ?? 7,
        halfDayThresholdHours: wh.halfDayThresholdHours ?? 4,
        isNight,
        punchMode: (shift.punchMode?.mode) || 'single',
        otEnabled: !!ot.enabled,
        otStartAfterMinutes: ot.startAfterMinutes ?? 30,
        otRoundingMode: ot.roundingMode || 'none',
        separateNightOT: !!ot.separateNightOT,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. IS WEEKLY OFF
//     Uses the shift's weeklyOffCfg to determine if a date is a day off
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Date}   date   - Target date
 * @param {object} shift  - Shift document
 * @returns {{ isWeeklyOff: boolean, isSaturdayHalfDay: boolean }}
 */
function isWeeklyOffByShift(date, shift) {
    if (!shift) return { isWeeklyOff: false, isSaturdayHalfDay: false };

    const cfg = shift.weeklyOffCfg || {};
    const day = date.getDay();            // 0 Sun … 6 Sat
    const baseDays = Array.isArray(cfg.days) ? cfg.days : (shift.weeklyOffs || [0]);

    let isWeeklyOff = baseDays.includes(day);
    let isSaturdayHalfDay = false;

    switch (cfg.mode) {
        case 'alternate_saturday':
            if (day === 6) {
                const week = getWeekOfMonth(date);
                const offWeeks = Array.isArray(cfg.alternateSaturdayOffWeeks)
                    ? cfg.alternateSaturdayOffWeeks
                    : [2, 4];
                isWeeklyOff = offWeeks.includes(week);
            } else {
                isWeeklyOff = baseDays.includes(day);
            }
            break;
        default:
            isWeeklyOff = baseDays.includes(day);
    }

    // Saturday half-day flag
    if (day === 6 && cfg.saturdayMode === 'half_day') {
        isSaturdayHalfDay = true;
    }

    return { isWeeklyOff, isSaturdayHalfDay };
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. CALCULATE ATTENDANCE
//     Full pipeline using shift policy + punch logs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} params
 * @param {object} params.shift                    - Shift policy POJO (null = use buildOptions as direct thresholds)
 * @param {object} params.window                   - buildAttendanceWindow() result
 * @param {Date}   params.date                     - Attendance date
 * @param {Array}  params.punchLogs                - [{type:'IN'|'OUT', time:Date}]
 * @param {boolean} params.isHoliday               - Is this day a declared holiday?
 * @param {boolean} params.hasApprovedLeave        - Does employee have approved leave?
 * @param {string}  params.leaveType               - Leave type if approved
 * @param {string}  params.dayTag                  - 'WFH' | 'OD' | null
 * @param {number}  params.accumulatedLateCount    - Month-to-date late marks before this day
 * @param {number}  params.accumulatedEarlyCount   - Month-to-date early exit marks before this day
 * @returns {object}  attendance decision
 */
function calculateAttendance({
    shift,
    window: win,
    date,
    punchLogs = [],
    isHoliday = false,
    hasApprovedLeave = false,
    leaveType = null,
    dayTag = null,
    accumulatedLateCount = 0,
    accumulatedEarlyCount = 0,
}) {
    // Derive sub-configs from shift (safe defaults if shift is null)
    const late = shift?.lateMarkRules || {};
    const early = shift?.earlyExitRules || {};
    const half = shift?.halfDayRules || {};
    const absent = shift?.absentCfg || {};
    const wfh = shift?.wfhSettings || {};
    const od = shift?.odSettings || {};
    const compOff = shift?.compOffSettings || {};
    const night = shift?.nightShiftRules || {};
    const leaveCfg = shift?.leaveIntegration || {};
    const woCfg = shift ? isWeeklyOffByShift(date, shift) : { isWeeklyOff: false, isSaturdayHalfDay: false };

    const logs = punchLogs || [];
    const policyViolations = [];
    let lopDays = 0;

    // ── HARD OVERRIDES ───────────────────────────────────────────────────────
    if (isHoliday) return buildResult('holiday', { lopDays: 0, policyViolations });
    if (woCfg.isWeeklyOff && logs.length === 0) return buildResult('weekly_off', { lopDays: 0, policyViolations });

    // If punched on weekly off → potential comp-off day
    if (woCfg.isWeeklyOff && logs.length > 0 && compOff.enabled && compOff.autoCreditOnWeeklyOffWork) {
        policyViolations.push('Worked on Weekly Off — Comp-Off eligible');
    }

    if (hasApprovedLeave) return buildResult('leave', { lopDays: 0, policyViolations, leaveType });

    // ── EXTRACT FIRST-IN / LAST-OUT ──────────────────────────────────────────
    let firstIn = null, lastOut = null;
    for (const l of logs) {
        if (!l?.time || !l?.type) continue;
        const t = new Date(l.time);
        if (l.type === 'IN') { if (!firstIn || t < firstIn) firstIn = t; }
        else if (l.type === 'OUT') { if (!lastOut || t > lastOut) lastOut = t; }
    }

    // ── WORKING HOURS ────────────────────────────────────────────────────────
    let workingMinutes = 0;
    if (firstIn && lastOut) {
        workingMinutes = Math.max(0, diffMins(lastOut, firstIn) - (win?.breakDeductionMinutes || 0));
    }
    const workingHours = workingMinutes / 60;

    // ── DAY TAG HANDLING ─────────────────────────────────────────────────────
    let isWFH = false, isOnDuty = false;
    if (dayTag === 'WFH' && wfh.enabled) { isWFH = true; }
    if (dayTag === 'OD' && od.enabled) { isOnDuty = true; }

    // ── NO PUNCH RULE ────────────────────────────────────────────────────────
    if (!firstIn) {
        if (isWFH && wfh.autoPresentMode === 'full_day') return buildResult('wfh_present', { lopDays: 0, policyViolations, isWFH, workingHours });
        if (isWFH && wfh.autoPresentMode === 'half_day') return buildResult('half_day', { lopDays: 0.5, policyViolations, isWFH, workingHours });
        if (isOnDuty && od.countAsPresent) return buildResult('present', { lopDays: 0, policyViolations, isOnDuty, workingHours });

        // Only IN, no OUT scenario
        if (firstIn && !lastOut) {
            const beh = (half?.onlyInNoOutBehaviour) || 'half_day';
            policyViolations.push('Only IN punch recorded — no OUT');
            if (beh === 'half_day') return buildResult('half_day', { lopDays: 0.5, policyViolations, workingHours });
            if (beh === 'lop') return buildResult('absent', { lopDays: 1, policyViolations, workingHours });
            return buildResult('absent', { lopDays: 1, policyViolations, workingHours });
        }

        if (absent.autoMarkAbsentOnNoPunch) return buildResult('absent', { lopDays: 1, policyViolations, workingHours });
        return buildResult('absent', { lopDays: 0, policyViolations, workingHours });
    }

    // ── BASE STATUS FROM WORKING HOURS ───────────────────────────────────────
    let status = 'absent';
    if (workingHours >= (win?.fullDayThresholdHours || 7)) status = 'present';
    else if (workingHours >= (win?.halfDayThresholdHours || 4)) status = 'half_day';

    if (isWFH && wfh.autoPresentMode === 'full_day') status = 'present';
    if (isOnDuty && od.countAsPresent) status = 'present';

    // ── LATE CALCULATION ─────────────────────────────────────────────────────
    let lateMinutes = 0, isLate = false;
    if (win?.shiftStart && firstIn) {
        const rawLate = diffMins(firstIn, win.shiftStart);
        if (rawLate > 0) {
            lateMinutes = rawLate;
            const graceLate = win?.graceLate ?? 15;
            const allowedExtra = late?.allowedLateMinutesPerDay || 0;
            const effectiveThreshold = late?.enabled && allowedExtra > 0 ? allowedExtra : graceLate;
            isLate = lateMinutes > effectiveThreshold;
        }
    }

    // ── EARLY EXIT CALCULATION ───────────────────────────────────────────────
    let earlyMinutes = 0, isEarlyOut = false;
    if (win?.shiftEnd && lastOut) {
        const rawEarly = diffMins(win.shiftEnd, lastOut);
        if (rawEarly > 0) {
            earlyMinutes = rawEarly;
            const graceEarly = win?.graceEarly ?? 15;
            const allowedEarly = early?.allowedEarlyMinutesPerDay || 0;
            const effectiveThreshold = early?.enabled && allowedEarly > 0 ? allowedEarly : graceEarly;
            isEarlyOut = earlyMinutes > effectiveThreshold;
        }
    }

    // ── OVERTIME CALCULATION ─────────────────────────────────────────────────
    let overtimeMinutes = 0;
    if (win?.otEnabled && win?.shiftEnd && lastOut) {
        const rawOT = diffMins(lastOut, win.shiftEnd);
        if (rawOT > (win?.otStartAfterMinutes || 30)) {
            overtimeMinutes = roundOT(rawOT, win?.otRoundingMode || 'none');
        }
    }

    // ── LATE MARK PENALTY ─────────────────────────────────────────────────────
    if (isLate && status !== 'absent' && late?.enabled) {
        const currentLateCount = accumulatedLateCount + 1;
        policyViolations.push(`Late ${lateMinutes} min (count: ${currentLateCount})`);

        if (late.lateMarksToFullDay > 0 && currentLateCount % late.lateMarksToFullDay === 0) {
            status = 'absent'; lopDays = 1;
            policyViolations.push(`${currentLateCount} late marks → 1 Day LOP`);
        } else if (late.lateMarksToHalfDay > 0 && currentLateCount % late.lateMarksToHalfDay === 0 && status !== 'absent') {
            status = 'half_day'; lopDays = Math.max(lopDays, 0.5);
            policyViolations.push(`${currentLateCount} late marks → Half Day`);
        }
    } else if (isLate) {
        policyViolations.push(`Late arrival: ${lateMinutes} min`);
    }

    // ── EARLY EXIT PENALTY ────────────────────────────────────────────────────
    if (isEarlyOut && status !== 'absent' && early?.enabled) {
        const currentEarlyCount = accumulatedEarlyCount + 1;
        policyViolations.push(`Early exit ${earlyMinutes} min (count: ${currentEarlyCount})`);

        if (early.earlyExitsToFullDay > 0 && currentEarlyCount % early.earlyExitsToFullDay === 0) {
            status = 'absent'; lopDays = Math.max(lopDays, 1);
            policyViolations.push(`${currentEarlyCount} early exits → 1 Day LOP`);
        } else if (early.earlyExitsToHalfDay > 0 && currentEarlyCount % early.earlyExitsToHalfDay === 0 && status !== 'absent') {
            status = 'half_day'; lopDays = Math.max(lopDays, 0.5);
            policyViolations.push(`${currentEarlyCount} early exits → Half Day`);
        }
    } else if (isEarlyOut) {
        policyViolations.push(`Early exit: ${earlyMinutes} min`);
    }

    // ── HALF DAY WORKING HOURS RULE ───────────────────────────────────────────
    if (half?.enabled && status === 'present') {
        if (half.halfDayIfWorkedLessThanHours > 0 && workingHours < half.halfDayIfWorkedLessThanHours) {
            status = 'half_day'; lopDays = Math.max(lopDays, 0.5);
            policyViolations.push(`Worked ${workingHours.toFixed(1)}h < threshold → Half Day`);
        }
        if (half.halfDayIfLateMoreThanMinutes > 0 && lateMinutes > half.halfDayIfLateMoreThanMinutes) {
            status = 'half_day'; lopDays = Math.max(lopDays, 0.5);
            policyViolations.push(`Late ${lateMinutes} min > half-day threshold`);
        }
    }

    // ── SATURDAY HALF-DAY ─────────────────────────────────────────────────────
    if (woCfg.isSaturdayHalfDay && status === 'present') {
        status = 'half_day';
        lopDays = Math.max(lopDays, 0.5);
    }

    return {
        status,
        isLate,
        isEarlyOut,
        lateMinutes,
        earlyExitMinutes: earlyMinutes,
        workingHours,
        overtimeMinutes,
        lopDays,
        isWFH,
        isOnDuty,
        isNightShift: win?.isNight || false,
        engineVersion: 3,
        policyViolations,
    };
}

function buildResult(status, extras) {
    return {
        status,
        isLate: false,
        isEarlyOut: false,
        lateMinutes: 0,
        earlyExitMinutes: 0,
        workingHours: extras.workingHours || 0,
        overtimeMinutes: 0,
        lopDays: extras.lopDays || 0,
        isWFH: !!extras.isWFH,
        isOnDuty: !!extras.isOnDuty,
        isNightShift: false,
        engineVersion: 3,
        policyViolations: extras.policyViolations || [],
        leaveType: extras.leaveType || null,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
    resolveEffectiveShift,
    buildAttendanceWindow,
    calculateAttendance,
    isWeeklyOffByShift,
};
