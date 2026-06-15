const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('✅ Connected to Main DB');

    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`\n================================`);
        console.log(`TENANT: ${tenant.name} (${tenant._id})`);
        console.log(`================================`);

        const db = await getTenantDB(tenant._id);
        const Employee = db.model('Employee', require('./models/Employee'));
        const LeavePolicy = db.model('LeavePolicy', require('./models/LeavePolicy'));
        const LeaveBalance = db.model('LeaveBalance', require('./models/LeaveBalance'));
        const AttendanceSettings = db.model('AttendanceSettings', require('./models/AttendanceSettings'));

        // 1. Check Settings & Year Logic
        const settings = await AttendanceSettings.findOne({ tenant: tenant._id });
        const startMonth = settings?.leaveCycleStartMonth || 0;
        console.log(`[SETTINGS] leaveCycleStartMonth: ${startMonth} (${settings ? 'Found' : 'Used Default 0'})`);

        const now = new Date();
        const currentYear = now.getFullYear();
        let derivedYear = currentYear;
        // Logic from controller:
        if (now.getMonth() < startMonth) derivedYear--;

        console.log(`[DATE] Today: ${now.toISOString()}`);
        console.log(`[YEAR LOGIC] Current Month: ${now.getMonth()}, StartMonth: ${startMonth} => Logic Year: ${derivedYear}`);

        // 2. Find Harsh Shah
        const employees = await Employee.find({
            $or: [
                { firstName: { $regex: /Harsh/i } },
                { lastName: { $regex: /Shah/i } }
            ]
        });

        if (employees.length === 0) {
            console.log("❌ No employee found matching 'Harsh' or 'Shah'");
            continue;
        }

        for (const emp of employees) {
            console.log(`\n--------------------------------`);
            console.log(`EMPLOYEE: ${emp.firstName} ${emp.lastName}`);
            console.log(`ID: ${emp._id}`);
            console.log(`Policy ID: ${emp.leavePolicy}`);

            // Check Policy Object
            if (emp.leavePolicy) {
                const p = await LeavePolicy.findById(emp.leavePolicy);
                console.log(`Policy Doc: ${p ? p.name : '❌ NOT FOUND IN DB'}`);
            } else {
                console.log(`Policy Doc: ❌ NULL REF`);
            }

            // Check Balances for Derived Year
            const balances = await LeaveBalance.find({
                employee: emp._id,
                tenant: tenant._id,
                year: derivedYear
            });

            console.log(`[QUERY] LeaveBalance.find({ employee: '${emp._id}', year: ${derivedYear} })`);
            console.log(`[RESULT] Count: ${balances.length}`);

            if (balances.length > 0) {
                balances.forEach(b => console.log(`   - ${b.leaveType}: Available=${b.available}, Total=${b.total}`));
            } else {
                console.log(`   ❌ NO BALANCES RETURNED FOR ${derivedYear}`);
            }

            // Check Balances for Calendar Year just in case
            if (currentYear !== derivedYear) {
                const calBalances = await LeaveBalance.find({
                    employee: emp._id,
                    tenant: tenant._id,
                    year: currentYear
                });
                console.log(`[CHECK] Count for ${currentYear}: ${calBalances.length}`);
            }
        }
    }

    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
