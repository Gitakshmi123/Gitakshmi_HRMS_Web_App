const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('Connected\n');

    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`Tenant: ${tenant.name}`);
        const db = await getTenantDB(tenant._id);

        if (!db.models['Employee']) db.model('Employee', require('./models/Employee'));
        if (!db.models['LeavePolicy']) db.model('LeavePolicy', require('./models/LeavePolicy'));
        if (!db.models['LeaveBalance']) db.model('LeaveBalance', require('./models/LeaveBalance'));

        const Employee = db.model('Employee');
        const LeavePolicy = db.model('LeavePolicy');
        const LeaveBalance = db.model('LeaveBalance');

        // Find policy
        const policy = await LeavePolicy.findOne({ tenant: tenant._id, applicableTo: 'Role', roles: 'Employee' });
        if (!policy) {
            console.log('No Employee policy found\n');
            continue;
        }

        console.log(`Policy: ${policy.name} (${policy._id})\n`);

        // Find ALL employees with firstName containing "harmik"
        const employees = await Employee.find({
            firstName: { $regex: /harmik/i },
            tenant: tenant._id
        });

        console.log(`Found ${employees.length} Dharmik employees:\n`);

        const year = new Date().getFullYear();
        for (const emp of employees) {
            console.log(`  ${emp.firstName} ${emp.lastName} (${emp.email})`);

            emp.leavePolicy = policy._id;
            await emp.save();
            console.log(`    ✓ Policy assigned`);

            await LeaveBalance.deleteMany({ employee: emp._id, year });

            for (const rule of policy.rules) {
                await new LeaveBalance({
                    tenant: tenant._id,
                    employee: emp._id,
                    policy: policy._id,
                    leaveType: rule.leaveType,
                    year,
                    total: rule.totalPerYear,
                    used: 0,
                    pending: 0,
                    available: rule.totalPerYear
                }).save();
            }
            console.log(`    ✓ Balances created: ${policy.rules.map(r => `${r.leaveType}=${r.totalPerYear}`).join(', ')}\n`);
        }
    }

    console.log('✅ DONE!');
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
