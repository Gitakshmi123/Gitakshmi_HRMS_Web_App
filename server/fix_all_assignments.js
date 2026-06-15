const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('✅ Connected to Main DB\n');

    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`TENANT: ${tenant.name}`);
        console.log('='.repeat(50));

        try {
            const db = await getTenantDB(tenant._id);

            if (!db.models['Employee']) db.model('Employee', require('./models/Employee'));
            if (!db.models['LeavePolicy']) db.model('LeavePolicy', require('./models/LeavePolicy'));
            if (!db.models['LeaveBalance']) db.model('LeaveBalance', require('./models/LeaveBalance'));

            const Employee = db.model('Employee');
            const LeavePolicy = db.model('LeavePolicy');
            const LeaveBalance = db.model('LeaveBalance');

            // Show all policies
            const policies = await LeavePolicy.find({ tenant: tenant._id });
            console.log(`\n📋 LEAVE POLICIES (${policies.length}):`);
            policies.forEach((p, i) => {
                console.log(`\n  ${i + 1}. ${p.name}`);
                console.log(`     ID: ${p._id}`);
                console.log(`     Applicable To: ${p.applicableTo}`);
                console.log(`     Roles: ${p.roles?.join(', ') || 'N/A'}`);
                console.log(`     Rules: ${p.rules.map(r => `${r.leaveType}=${r.totalPerYear}`).join(', ')}`);
            });

            // Show all employees
            const employees = await Employee.find({ tenant: tenant._id }).limit(10);
            console.log(`\n\n👥 EMPLOYEES (showing first 10 of total):`);

            for (const emp of employees) {
                console.log(`\n  • ${emp.firstName} ${emp.lastName}`);
                console.log(`    Email: ${emp.email}`);
                console.log(`    Role: ${emp.role}`);
                console.log(`    Policy: ${emp.leavePolicy || '❌ NONE'}`);

                const balances = await LeaveBalance.find({ employee: emp._id, tenant: tenant._id });
                if (balances.length > 0) {
                    console.log(`    Balances: ${balances.map(b => `${b.leaveType}=${b.available}/${b.total}`).join(', ')}`);
                } else {
                    console.log(`    Balances: ❌ NONE`);
                }
            }

            // Now auto-assign policies
            console.log(`\n\n🔧 AUTO-ASSIGNING POLICIES...`);

            for (const policy of policies) {
                if (policy.applicableTo === 'Role' && policy.roles && policy.roles.length > 0) {
                    console.log(`\n  Assigning "${policy.name}" to roles: ${policy.roles.join(', ')}`);

                    const matchingEmployees = await Employee.find({
                        role: { $in: policy.roles },
                        tenant: tenant._id
                    });

                    console.log(`  Found ${matchingEmployees.length} matching employees`);

                    const year = new Date().getFullYear();
                    for (const emp of matchingEmployees) {
                        emp.leavePolicy = policy._id;
                        await emp.save();

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

                        console.log(`    ✅ ${emp.firstName} ${emp.lastName} (${emp.role})`);
                    }
                }
            }

            console.log(`\n✅ Done for ${tenant.name}!`);

        } catch (err) {
            console.error(`❌ Error: ${err.message}`);
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL DONE!');
    console.log('='.repeat(50) + '\n');
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
