const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('✅ Connected to Main DB');

    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`\n=== Tenant: ${tenant.name} ===`);
        const db = await getTenantDB(tenant._id);
        const Employee = db.model('Employee', require('./models/Employee'));
        const LeavePolicy = db.model('LeavePolicy', require('./models/LeavePolicy'));
        const LeaveBalance = db.model('LeaveBalance', require('./models/LeaveBalance'));
        const AttendanceSettings = db.model('AttendanceSettings', require('./models/AttendanceSettings'));

        // Check Settings
        const settings = await AttendanceSettings.findOne({ tenant: tenant._id });
        console.log(`Attendance Settings: Start Month = ${settings?.leaveCycleStartMonth || 0} (${settings ? 'Found' : 'Default'})`);

        const employee = await Employee.findOne({
            $or: [
                { firstName: { $regex: /Harsh/i } },
                { lastName: { $regex: /Shah/i } }
            ]
        });

        if (!employee) {
            console.log("Employee 'Harsh Shah' not found in this tenant.");
            continue;
        }

        console.log(`Found Employee: ${employee.firstName} ${employee.lastName} (${employee._id})`);

        // Ensure Policy
        let policy = null;
        if (employee.leavePolicy) {
            policy = await LeavePolicy.findById(employee.leavePolicy);
        }

        if (!policy) {
            console.log("Employee has no valid policy. looking for 'Standard Leave Policy'");
            policy = await LeavePolicy.findOne({ name: 'Standard Leave Policy', tenant: tenant._id });
            if (policy) {
                employee.leavePolicy = policy._id;
                await employee.save();
                console.log("Assigned 'Standard Leave Policy' to employee.");
            } else {
                console.log("❌ Could not find Standard Leave Policy. Creating it...");
                policy = new LeavePolicy({
                    tenant: tenant._id,
                    name: 'Standard Leave Policy',
                    applicableTo: 'All',
                    rules: [
                        { leaveType: 'Casual Leave', totalPerYear: 12, color: '#3b82f6' },
                        { leaveType: 'Sick Leave', totalPerYear: 7, color: '#ef4444' },
                        { leaveType: 'Privilege Leave', totalPerYear: 15, color: '#10b981' }
                    ]
                });
                await policy.save();
                employee.leavePolicy = policy._id;
                await employee.save();
                console.log("Created and assigned new policy.");
            }
        } else {
            console.log(`Employee has policy: ${policy.name}`);
        }

        // Force Create Balances for 2025 AND 2026
        const years = [2025, 2026];
        for (const year of years) {
            console.log(`\nEnsuring balances for Year ${year}...`);
            await LeaveBalance.deleteMany({ employee: employee._id, year });

            for (const rule of policy.rules) {
                await new LeaveBalance({
                    tenant: tenant._id,
                    employee: employee._id,
                    policy: policy._id,
                    leaveType: rule.leaveType,
                    year,
                    total: rule.totalPerYear,
                    available: rule.totalPerYear,
                    used: 0,
                    pending: 0
                }).save();
                console.log(` + Created ${rule.leaveType}: ${rule.totalPerYear}`);
            }
        }
    }

    console.log('\n✅ Fix Complete for Harsh Shah');
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
