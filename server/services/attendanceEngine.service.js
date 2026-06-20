const dayjs = require('dayjs');
const isBetween = require('dayjs/plugin/isBetween');
dayjs.extend(isBetween);

/**
 * Enterprise Attendance Intelligence Engine (Phase 3)
 *
 * The Core Brain that processes raw punches against the dynamic JSON Policy Engine.
 */

class AttendanceEngine {
    constructor(models) {
        this.models = models;
    }

    /**
     * Main Pipeline Execution
     * @param {Object} employee - The employee document
     * @param {Date} targetDate - The date to process
     * @param {Array} rawPunches - Array of punch objects for the day
     */
    async processDailyAttendance(employee, targetDate, rawPunches, tenantId) {
        const { EmployeeRoster, ShiftMaster, ShiftPolicy, DailyAttendanceResult } = this.models;

        // 1. Check Roster for assigned shift
        const startOfDay = dayjs(targetDate).startOf('day').toDate();
        const endOfDay = dayjs(targetDate).endOf('day').toDate();

        let rosterEntry = await EmployeeRoster.findOne({
            tenant: tenantId,
            employeeId: employee._id,
            date: { $gte: startOfDay, $lte: endOfDay }
        });

        // If no roster exists, check if there's a fallback company assignment (Mocking for now)
        if (!rosterEntry) {
            // For MVP Phase 3 testing, if no roster, we abort or assume missing.
            return { success: false, reason: "NO_ROSTER_ASSIGNMENT" };
        }

        // 2. Load Shift Master & Active Policy Version
        const shift = await ShiftMaster.findOne({ _id: rosterEntry.shiftMasterId });
        if (!shift) return { success: false, reason: "INVALID_SHIFT" };

        const policy = await ShiftPolicy.findOne({
            shiftMasterId: shift._id,
            tenant: tenantId,
            effectiveFrom: { $lte: targetDate }
        }).sort({ effectiveFrom: -1 }); // Get the version active on that specific date

        if (!policy) return { success: false, reason: "NO_ACTIVE_POLICY" };

        // 3. Process Punches
        const sortedPunches = rawPunches.sort((a, b) => new Date(a.time) - new Date(b.time));
        const firstPunch = sortedPunches.length > 0 ? sortedPunches[0].time : null;
        const lastPunch = sortedPunches.length > 0 ? sortedPunches[sortedPunches.length - 1].time : null;

        let lateMinutes = 0;
        let earlyExitMinutes = 0;
        let totalWorkingMinutes = 0;
        let status = 'Absent';

        if (firstPunch && lastPunch) {
            totalWorkingMinutes = dayjs(lastPunch).diff(dayjs(firstPunch), 'minute');
            
            // Calculate Late Minutes
            // Construct Shift Start Time for today
            const shiftStartTime = dayjs(targetDate).format('YYYY-MM-DD') + 'T' + shift.coreTiming.startTime;
            const lateDiff = dayjs(firstPunch).diff(dayjs(shiftStartTime), 'minute');
            if (lateDiff > 0) lateMinutes = lateDiff;

            // Calculate Early Exit
            const shiftEndTime = dayjs(targetDate).format('YYYY-MM-DD') + 'T' + shift.coreTiming.endTime;
            const earlyDiff = dayjs(shiftEndTime).diff(dayjs(lastPunch), 'minute');
            if (earlyDiff > 0) earlyExitMinutes = earlyDiff;

            status = 'Present'; // Initial assumption
        } else if (firstPunch && !lastPunch) {
            status = 'Missing Punch';
        }

        // 4. Execute Dynamic Policy Rules (IF-THEN engine)
        if (status === 'Present') {
            const { attendanceRules } = policy;

            // Check Absent Threshold
            if (attendanceRules?.absentThresholdMinutes > 0 && totalWorkingMinutes < attendanceRules.absentThresholdMinutes) {
                status = 'Absent';
            } else {
                // Check Late Mark Rules
                if (attendanceRules?.lateMarks && attendanceRules.lateMarks.length > 0) {
                    for (const rule of attendanceRules.lateMarks) {
                        if (rule.conditionType === 'GREATER_THAN' && lateMinutes > rule.minutes) {
                            if (rule.action === 'LATE_MARK') status = 'Late';
                            if (rule.action === 'HALF_DAY') status = 'Half Day';
                            if (rule.action === 'ABSENT') status = 'Absent';
                        }
                    }
                }

                // Check Early Exit Rules
                if (attendanceRules?.earlyExit && attendanceRules.earlyExit.length > 0) {
                    for (const rule of attendanceRules.earlyExit) {
                        if (rule.conditionType === 'GREATER_THAN' && earlyExitMinutes > rule.minutes) {
                            if (rule.action === 'LATE_MARK' && status === 'Present') status = 'Late';
                            if (rule.action === 'HALF_DAY') status = 'Half Day';
                            if (rule.action === 'ABSENT') status = 'Absent';
                        }
                    }
                }
            }
        }

        // Override status if it's a Weekly Off or Holiday
        if (rosterEntry.isWeeklyOff) status = 'Weekly Off';
        if (rosterEntry.isHoliday) status = 'Holiday';

        // 5. Overtime Engine
        let otMinutes = 0;
        let otMultiplier = 1.0;
        const { overtimeEngine } = policy;

        if (overtimeEngine?.isEligible && totalWorkingMinutes > 0) {
            // Shift total required minutes
            const shiftStartTime = dayjs(targetDate).format('YYYY-MM-DD') + 'T' + shift.coreTiming.startTime;
            const shiftEndTime = dayjs(targetDate).format('YYYY-MM-DD') + 'T' + shift.coreTiming.endTime;
            const requiredMinutes = dayjs(shiftEndTime).diff(dayjs(shiftStartTime), 'minute');

            const excessMinutes = totalWorkingMinutes - requiredMinutes;

            if (excessMinutes >= overtimeEngine.minimumMinutesToQualify) {
                otMinutes = Math.min(excessMinutes, overtimeEngine.maximumMinutesPerDay || 9999);
                
                // Determine Multiplier
                if (rosterEntry.isHoliday) otMultiplier = overtimeEngine.holidayMultiplier;
                else if (rosterEntry.isWeeklyOff) otMultiplier = overtimeEngine.weeklyOffMultiplier;
                else if (shift.coreTiming.isNightShiftAcrossMidnight) otMultiplier = overtimeEngine.nightShiftMultiplier;
                else otMultiplier = overtimeEngine.normalMultiplier;
            }
        }

        // 6. Save Final Result
        const resultPayload = {
            tenant: tenantId,
            employeeId: employee._id,
            date: targetDate,
            shiftMasterId: shift._id,
            shiftPolicyId: policy._id,
            firstPunch,
            lastPunch,
            totalWorkingMinutes,
            status,
            lateMinutes,
            earlyExitMinutes,
            otMinutes,
            otMultiplierApplied: otMultiplier
        };

        const result = await DailyAttendanceResult.findOneAndUpdate(
            { tenant: tenantId, employeeId: employee._id, date: { $gte: startOfDay, $lte: endOfDay } },
            { $set: resultPayload },
            { new: true, upsert: true }
        );

        return { success: true, data: result };
    }
}

module.exports = AttendanceEngine;
