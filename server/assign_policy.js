const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('Connected to Main DB');

    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`\n=== Tenant: ${tenant.name} ===`);
        try {
            const db = await getTenantDB(tenant._id);

            if (!db.models['Employee']) db.model('Employee', require('./models/Employee'));
            if (!db.models['LeavePolicy']) db.model('LeavePolicy', require('./models/LeavePolicy'));
            if (!db.models['LeaveBalance']) db.model('LeaveBalance', require('./models/LeaveBalance'));

            const Employee = db.model('Employee');
            const LeavePolicy = db.model('LeavePolicy');
            const LeaveBalance = db.model('LeaveBalance');

            // Find the first policy
            const policy = await LeavePolicy.findOne({ tenant: tenant._id });
            if (!policy) {
                console.log('No policies found');
                continue;
            }

            console.log(`Found policy: ${policy.name} (${policy._id})`);
            console.log(`Rules: ${policy.rules.map(r => `${r.leaveType}=${r.totalPerYear}`).join(', ')}`);

            // Find Dharmik
            const employee = await Employee.findOne({
                firstName: { $regex: /dharmik/i },
                tenant: tenant._id
            });

            if (!employee) {
                console.log('Employee not found');
                continue;
            }

            console.log(`\nAssigning policy to: ${employee.firstName} ${employee.lastName}`);

            // Assign policy
            employee.leavePolicy = policy._id;
            await employee.save();
            console.log('✓ Policy assigned');

            // Delete old balances
            const year = new Date().getFullYear();
            await LeaveBalance.deleteMany({ employee: employee._id, year });
            console.log('✓ Old balances cleared');

            // Create new balances
            for (const rule of policy.rules) {
                const balance = new LeaveBalance({
                    tenant: tenant._id,
                    employee: employee._id,
                    policy: policy._id,
                    leaveType: rule.leaveType,
                    year,
                    total: rule.totalPerYear,
                    used: 0,
                    pending: 0,
                    available: rule.totalPerYear
                });
                await balance.save();
                console.log(`✓ Created balance: ${rule.leaveType} = ${rule.totalPerYear}`);
            }

            console.log('\n✅ Successfully assigned policy and created balances!');

        } catch (err) {
            console.error(`Error: ${err.message}`);
            console.error(err.stack);
        }
    }

    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
