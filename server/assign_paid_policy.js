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

            // Find Dharmik
            const employee = await Employee.findOne({
                firstName: { $regex: /dharmik/i },
                tenant: tenant._id
            });

            if (!employee) {
                console.log('Employee not found');
                continue;
            }

            console.log(`\nEmployee Details:`);
            console.log(`  Name: ${employee.firstName} ${employee.lastName}`);
            console.log(`  ID: ${employee._id}`);
            console.log(`  Role: ${employee.role}`);
            console.log(`  Email: ${employee.email}`);

            // Find the "paid" policy
            const policy = await LeavePolicy.findOne({
                name: { $regex: /paid/i },
                tenant: tenant._id
            });

            if (!policy) {
                console.log('\n❌ No policy found with name "paid"');

                // Show all policies
                const allPolicies = await LeavePolicy.find({ tenant: tenant._id });
                console.log(`\nAll policies (${allPolicies.length}):`);
                allPolicies.forEach(p => {
                    console.log(`  - ${p.name} (${p.applicableTo}) - Roles: ${p.roles?.join(', ') || 'N/A'}`);
                });
                continue;
            }

            console.log(`\nPolicy Details:`);
            console.log(`  Name: ${policy.name}`);
            console.log(`  Applicable To: ${policy.applicableTo}`);
            console.log(`  Roles: ${policy.roles?.join(', ') || 'N/A'}`);
            console.log(`  Rules: ${policy.rules.map(r => `${r.leaveType}=${r.totalPerYear}`).join(', ')}`);

            // Assign policy to employee
            console.log(`\n📌 Assigning policy to employee...`);
            employee.leavePolicy = policy._id;
            await employee.save();
            console.log('✓ Policy assigned');

            // Delete old balances
            const year = new Date().getFullYear();
            await LeaveBalance.deleteMany({ employee: employee._id, year });
            console.log('✓ Old balances deleted');

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
                console.log(`✓ Created ${rule.leaveType}: ${rule.totalPerYear} days`);
            }

            console.log('\n✅ Policy assigned successfully!');

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
