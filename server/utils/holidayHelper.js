const HolidayGroupSchema = require('../models/HolidayGroup');

async function getHolidaysForEmployee({ employeeId, year, tenantDB, tenantId }) {
    try {
        const Employee = tenantDB.model('Employee');
        const HolidayGroup = tenantDB.model('HolidayGroup', HolidayGroupSchema);
        const Holiday = tenantDB.model('Holiday');

        const employee = await Employee.findById(employeeId);
        if (!employee) return [];

        const groups = await HolidayGroup.find({ tenant: tenantId, year: Number(year) });
        let matchedHolidays = [];

        for (const group of groups) {
            const app = group.applicability || { type: 'All Employees' };
            let isMatched = false;

            if (app.type === 'All Employees' || app.type === 'All') {
                isMatched = true;
            } else if (app.type === 'Branch' && app.branches && employee.branchId && app.branches.includes(employee.branchId.toString())) {
                isMatched = true;
            } else if (app.type === 'Department' && app.departments && employee.departmentId && app.departments.includes(employee.departmentId.toString())) {
                isMatched = true;
            } else if (app.type === 'Policy Based' && app.leavePolicies && employee.leavePolicy && app.leavePolicies.includes(employee.leavePolicy.toString())) {
                isMatched = true;
            } else if (app.type === 'Custom Selection' && app.employees && app.employees.includes(employeeId.toString())) {
                isMatched = true;
            }

            if (isMatched && group.holidays) {
                matchedHolidays = [...matchedHolidays, ...group.holidays];
            }
        }

        if (matchedHolidays.length === 0) {
            const legacyHolidays = await Holiday.find({
                tenant: tenantId,
                date: {
                    $gte: new Date(`${year}-01-01`),
                    $lte: new Date(`${year}-12-31T23:59:59`)
                }
            });
            return legacyHolidays.map(h => ({
                name: h.name,
                date: h.date,
                type: h.type || 'National Holiday',
                leaveImpact: 'Paid Holiday'
            }));
        }

        return matchedHolidays;
    } catch (error) {
        console.error('Error fetching holidays for employee:', error);
        return [];
    }
}

module.exports = { getHolidaysForEmployee };
