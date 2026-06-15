const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Tenant = require('./models/Tenant');
        const tenant = await Tenant.findOne({ code: 'abc002' });
        if (!tenant) return console.log('Tenant not found');

        const dbName = `company_${tenant._id}`;
        const db = mongoose.connection.useDb(dbName);

        const AttendanceSchema = require('./models/Attendance');
        const Attendance = db.model('Attendance', AttendanceSchema);

        const EmployeeSchema = require('./models/Employee');
        const Employee = db.model('Employee', EmployeeSchema);

        const employees = await Employee.find({ status: 'Active' });
        console.log(`Active Employees: ${employees.length}`);

        for (const emp of employees) {
            const startDate = new Date(2026, 0, 1);
            const endDate = new Date(2026, 0, 31);

            const count = await Attendance.countDocuments({
                employee: emp._id,
                date: { $gte: startDate, $lte: endDate },
                status: { $in: ['present', 'half_day'] }
            });

            const allLogs = await Attendance.find({
                employee: emp._id,
                date: { $gte: startDate, $lte: endDate }
            });

            console.log(`Employee: ${emp.firstName} ${emp.lastName} (${emp._id})`);
            console.log(`  - Present Count (countDocuments): ${count}`);
            console.log(`  - Total Attendance Records in Jan 2026: ${allLogs.length}`);
            if (allLogs.length > 0) {
                console.log(`  - Sample Record Status: ${allLogs[0].status}, Date: ${allLogs[0].date}`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
