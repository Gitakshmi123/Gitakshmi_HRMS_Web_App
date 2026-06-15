const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

console.log('\n🔧 FINAL FIX SCRIPT - ASSIGNING LEAVE POLICIES\n');

mongoose.connect(MONGO_URI).then(async () => {
    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`\n📌 Tenant: ${tenant.name}`);
        const db = await getTenantDB(tenant._id);

        if (!db.models['Employee']) db.model('Employee', require('./models/Employee'));
        if (!db.models['LeavePolicy']) db.model('LeavePolicy', require('./models/LeavePolicy'));
        if (!db.models['LeaveBalance']) db.model('LeaveBalance', require('./models/LeaveBalance'));

        const Employee = db.model('Employee');
        const LeavePolicy = db.model('LeavePolicy');
        const LeaveBalance = db.model('LeaveBalance');

        // Get ALL employees
        const allEmployees = await Employee.find({ tenant: tenant._id });
        console.log(`   Total employees: ${allEmployees.length}`);

        // Get ALL policies
        const allPolicies = await LeavePolicy.find({ tenant: tenant._id });
        console.log(`   Total policies: ${allPolicies.length}\n`);

        if (allPolicies.length === 0) {
            console.log('   ⚠️  No policies found. Creating default policy...\n');

            const defaultPolicy = new LeavePolicy({
                tenant: tenant._id,
                name: 'Default Employee Policy',
                applicableTo: 'All',
                rules: [
                    { leaveType: 'CL', totalPerYear: 12, monthlyAccrual: true, carryForwardAllowed: false, maxCarryForward: 0, requiresApproval: true },
                    { leaveType: 'PL', totalPerYear: 6, monthlyAccrual: true, carryForwardAllowed: false, maxCarryForward: 0, requiresApproval: true },
                    { leaveType: 'SL', totalPerYear: 7, monthlyAccrual: false, carryForwardAllowed: false, maxCarryForward: 0, requiresApproval: true }
                ]
            });
            await defaultPolicy.save();
            allPolicies.push(defaultPolicy);
            console.log(`   ✅ Created default policy: ${defaultPolicy._id}\n`);
        }

        const year = new Date().getFullYear();

        // Assign policies to ALL employees
        for (const employee of allEmployees) {
            console.log(`   👤 ${employee.firstName} ${employee.lastName} (${employee.email || 'no email'})`);
            console.log(`      Role: ${employee.role}`);

            // Find matching policy
            let assignedPolicy = null;

            for (const policy of allPolicies) {
                if (policy.applicableTo === 'All') {
                    assignedPolicy = policy;
                    break;
                } else if (policy.applicableTo === 'Role' && policy.roles && policy.roles.includes(employee.role)) {
                    assignedPolicy = policy;
                    break;
                }
            }

            if (!assignedPolicy && allPolicies.length > 0) {
                assignedPolicy = allPolicies[0]; // Fallback to first policy
            }

            if (assignedPolicy) {
                // Assign policy
                employee.leavePolicy = assignedPolicy._id;
                await employee.save();
                console.log(`      ✅ Policy assigned: ${assignedPolicy.name}`);

                // Create/Update balances using upsert
                for (const rule of assignedPolicy.rules) {
                    try {
                        await LeaveBalance.findOneAndUpdate(
                            {
                                tenant: tenant._id,
                                employee: employee._id,
                                leaveType: rule.leaveType,
                                year
                            },
                            {
                                $set: {
                                    policy: assignedPolicy._id,
                                    total: rule.totalPerYear,
                                    used: 0,
                                    pending: 0,
                                    available: rule.totalPerYear
                                }
                            },
                            { upsert: true, new: true }
                        );
                    } catch (balanceErr) {
                        console.log(`      ⚠️  Error updating ${rule.leaveType}: ${balanceErr.message}`);
                    }
                }
                console.log(`      ✅ Balances created/updated: ${assignedPolicy.rules.map(r => r.leaveType).join(', ')}`);
            } else {
                console.log(`      ⚠️  No policy available to assign`);
            }
            console.log('');
        }
    }

    console.log('\n✅ ✅ ✅ ALL DONE! ✅ ✅ ✅');
    console.log('\nPlease refresh your Employee Dashboard now!\n');
    process.exit();
}).catch(err => {
    console.error('❌ ERROR:', err);
    process.exit(1);
});
