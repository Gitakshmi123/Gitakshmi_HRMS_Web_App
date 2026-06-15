const mongoose = require('mongoose');
const { isWeeklyOffDate } = require('../attendanceRulesEngine');

/**
 * Attendance Engine: Converts live attendance logs into immutable snapshots
 */
class AttendanceEngine {
    /**
     * Generates an attendance snapshot for a specific month
     * @param {Object} params
     * @param {Object} params.tenantDB - Tenant DB connection
     * @param {ObjectId} params.employeeId
     * @param {String} params.period - YYYY-MM
     */
    static async generateSnapshot({ tenantDB, employeeId, period }) {
        const Attendance = tenantDB.model('Attendance');
        const AttendanceSnapshot = tenantDB.model('AttendanceSnapshot');
        const AttendanceSettings = tenantDB.model('AttendanceSettings');

        // Parse period
        const [year, month] = period.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month
        const totalDays = endDate.getDate();

        // Fetch all attendance records for this employee and month
        const attendanceRecords = await Attendance.find({
            employee: employeeId,
            date: { $gte: startDate, $lte: endDate }
        }).lean();

        // Fetch settings once for weekly off / advanced rules
        let settings = await AttendanceSettings.findOne({}).lean().catch(() => null);

        // Calculate metrics
        let presentDays = 0;
        let absentDays = 0;
        let leaveDays = 0;
        let holidays = 0;
        let weeklyOffs = 0;
        let lateMarks = 0;
        let halfDays = 0;

        attendanceRecords.forEach(rec => {
            const status = (rec.status || '').toLowerCase();
            const date = new Date(rec.date);

            // Holiday takes precedence over weekly off
            if (status === 'holiday') {
                holidays++;
            } else {
                const weekly = isWeeklyOffDate({
                    date,
                    settings: settings || { weeklyOffDays: [0] },
                    employeeId: rec.employee
                });

                if (weekly.isWeeklyOff) {
                    weeklyOffs++;
                } else {
                    switch (status) {
                        case 'present':
                            presentDays++;
                            break;
                        case 'absent':
                            absentDays++;
                            break;
                        case 'leave':
                            leaveDays++;
                            break;
                        case 'half_day':
                            presentDays += 0.5;
                            halfDays++;
                            break;
                        default:
                            break;
                    }
                }
            }

            if (rec.isLate) lateMarks++;
        });

        // Handle missing records: treat as absent if not in DB (simple logic)
        // Actually, we should only snapshot if attendance is "Locked" or explicitly confirmed
        const recordedDays = attendanceRecords.length;
        if (recordedDays < totalDays) {
            absentDays += (totalDays - recordedDays);
        }

        // Upsert snapshot
        const snapshot = await AttendanceSnapshot.findOneAndUpdate(
            { employee: employeeId, period },
            {
                totalDays,
                presentDays,
                absentDays,
                leaveDays,
                holidays,
                weeklyOffs,
                lateMarks,
                halfDays,
                createdAt: new Date()
            },
            { upsert: true, new: true }
        );

        return snapshot;
    }
}

module.exports = AttendanceEngine;
