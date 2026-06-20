const mongoose = require('mongoose');

const getModels = (req) => {
    if (!req.tenantDB) throw new Error('Tenant database not initialized.');
    return {
        Attendance: req.tenantDB.model('Attendance'),
        LeaveRequest: req.tenantDB.model('LeaveRequest'),
        Employee: req.tenantDB.model('Employee'),
        Holiday: req.tenantDB.model('Holiday')
    };
};

/**
 * Generate precise Payroll Inputs (Paid Days calculation) dynamically.
 * Formula: Paid Days = Present + Approved Paid Leaves + Weekly Offs + Holidays
 */
exports.generatePayrollInputs = async (req, res) => {
    try {
        const { tenantIdStr } = req.user?.tenantId || req.tenantId;
        const tenantId = new mongoose.Types.ObjectId(tenantIdStr || req.tenantId);
        const { Attendance, LeaveRequest, Employee, Holiday } = getModels(req);
        
        const { month, year } = req.query; // e.g., month=6, year=2026
        if (!month || !year) return res.status(400).json({ error: "Month and Year are required" });

        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of the month
        endDate.setHours(23, 59, 59, 999);

        // Fetch all employees in tenant
        const employees = await Employee.find({ tenant: tenantId, status: 'Active' }).select('_id firstName lastName employeeId').lean();
        
        const inputs = [];

        for (const emp of employees) {
            const employeeId = emp._id;

            // 1. Calculate Present Days & Half Days from Attendance Engine
            const attendanceRecords = await Attendance.find({
                tenant: tenantId,
                employee: employeeId,
                date: { $gte: startDate, $lte: endDate }
            }).lean();

            let presentCount = 0;
            let halfDayCount = 0;
            let absentCount = 0;
            let totalLopDaysFromPenalties = 0;

            attendanceRecords.forEach(record => {
                if (record.status === 'present') presentCount++;
                if (record.status === 'half_day') halfDayCount++;
                if (record.status === 'absent') absentCount++;
                
                if (record.lopDays) {
                    totalLopDaysFromPenalties += record.lopDays;
                }
            });

            // Calculate exact Paid Present Days
            const effectivePresentDays = presentCount + (halfDayCount * 0.5) - totalLopDaysFromPenalties;

            // 2. Calculate Approved Paid Leaves
            const leaveRequests = await LeaveRequest.find({
                tenant: tenantId,
                employee: employeeId,
                status: 'Approved',
                startDate: { $lte: endDate },
                endDate: { $gte: startDate }
            }).lean();

            let paidLeaveDays = 0;
            let unpaidLeaveDays = 0;

            leaveRequests.forEach(req => {
                // Prorate if leave spans outside this month
                const reqStart = req.startDate < startDate ? startDate : req.startDate;
                const reqEnd = req.endDate > endDate ? endDate : req.endDate;
                
                const diffTime = Math.abs(reqEnd - reqStart);
                const overlapDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                
                // Estimate fraction if partial LOP
                const totalDays = req.daysCount || 1;
                const paidFraction = req.paidLeaveDays / totalDays;
                const unpaidFraction = req.unpaidLeaveDays / totalDays;

                paidLeaveDays += overlapDays * paidFraction;
                unpaidLeaveDays += overlapDays * unpaidFraction;
            });

            // 3. Holidays & Weekly Offs (Simplistic assumption for payroll lock, in enterprise usually calculated from Attendance record tags)
            let weeklyOffCount = 0;
            let holidayCount = 0;
            
            attendanceRecords.forEach(record => {
                if (record.status === 'weekly_off') weeklyOffCount++;
                if (record.status === 'holiday') holidayCount++;
            });

            // 4. Final Aggregation
            const totalPaidDays = effectivePresentDays + paidLeaveDays + weeklyOffCount + holidayCount;
            const totalMonthDays = endDate.getDate();
            const lwpDays = Math.max(0, totalMonthDays - totalPaidDays); // Failsafe for unrecorded days

            inputs.push({
                employeeId: emp.employeeId,
                name: `${emp.firstName} ${emp.lastName}`,
                totalDays: totalMonthDays,
                presentDays: effectivePresentDays,
                paidLeaveDays,
                weeklyOffs: weeklyOffCount,
                holidays: holidayCount,
                totalPaidDays,
                lwpDays: lwpDays + unpaidLeaveDays
            });
        }

        res.json({ success: true, count: inputs.length, data: inputs });

    } catch (error) {
        console.error("Generate Payroll Inputs Error:", error);
        res.status(500).json({ error: error.message });
    }
};
