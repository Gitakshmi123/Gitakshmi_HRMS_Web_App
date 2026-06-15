const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('✅ Connected');

    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`\nTenant: ${tenant.name}`);
        const db = await getTenantDB(tenant._id);
        const Employee = db.model('Employee', require('./models/Employee'));
        const LeavePolicy = db.model('LeavePolicy', require('./models/LeavePolicy'));
        const LeaveBalance = db.model('LeaveBalance', require('./models/LeaveBalance'));

        const emp = await Employee.findOne({ firstName: { $regex: /Harsh/i } });
        if (!emp) continue;

        console.log(`Target: ${emp.firstName} (${emp._id})`);

        // 1. DELETE EVERYTHING for this guy
        await LeaveBalance.deleteMany({ employee: emp._id });
        console.log("Deleted all old balances.");

        // 2. Create ONE record manually
        const b = new LeaveBalance({
            tenant: tenant._id,
            employee: emp._id,
            leaveType: 'TEST_LEAVE',
            year: 2026,
            total: 10,
            available: 10,
            used: 0,
            pending: 0
        });
        const saved = await b.save();
        console.log(`Saved ID: ${saved._id}`);

        // 3. Read it back
        const check = await LeaveBalance.find({ employee: emp._id });
        console.log(`Read back count: ${check.length}`);
        check.forEach(c => console.log(` - ${c.leaveType}: ${c.total}`));

        // 4. If that works, do the real ones
        if (check.length > 0) {
            console.log("Persistence working. Creating real balances...");
            const policy = await LeavePolicy.findOne({ name: 'Standard Leave Policy', tenant: tenant._id });
            if (policy) {
                for (const rule of policy.rules) {
                    await new LeaveBalance({
                        tenant: tenant._id,
                        employee: emp._id,
                        policy: policy._id,
                        leaveType: rule.leaveType,
                        year: 2026,
                        total: rule.totalPerYear,
                        available: rule.totalPerYear
                    }).save();
                }
                console.log("Real balances created.");
            }
        }
    }
    process.exit();
});
