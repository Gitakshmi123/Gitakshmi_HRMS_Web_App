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

            console.log(`Found employee: ${employee.firstName} ${employee.lastName}`);

            // Find or create policy
            let policy = await LeavePolicy.findOne({ tenant: tenant._id });

            if (!policy) {
                console.log('Creating new policy...');
                policy = new LeavePolicy({
                    tenant: tenant._id,
                    name: 'Standard Leave Policy',
                    applicableTo: 'All',
                    rules: [
                        { leaveType: 'CL', totalPerYear: 12, monthlyAccrual: true, carryForwardAllowed: false, maxCarryForward: 0, requiresApproval: true },
                        { leaveType: 'PL', totalPerYear: 6, monthlyAccrual: true, carryForwardAllowed: false, maxCarryForward: 0, requiresApproval: true },
                        { leaveType: 'SL', totalPerYear: 7, monthlyAccrual: false, carryForwardAllowed: false, maxCarryForward: 0, requiresApproval: true }
                    ]
                });
                await policy.save();
                console.log('✓ Policy created');
            } else {
                console.log(`Using existing policy: ${policy.name}`);
                // Update policy rules if needed
                policy.rules = [
                    { leaveType: 'CL', totalPerYear: 12, monthlyAccrual: true, carryForwardAllowed: false, maxCarryForward: 0, requiresApproval: true },
                    { leaveType: 'PL', totalPerYear: 6, monthlyAccrual: true, carryForwardAllowed: false, maxCarryForward: 0, requiresApproval: true },
                    { leaveType: 'SL', totalPerYear: 7, monthlyAccrual: false, carryForwardAllowed: false, maxCarryForward: 0, requiresApproval: true }
                ];
                await policy.save();
                console.log('✓ Policy updated with all leave types');
            }

            // Assign policy to employee
            employee.leavePolicy = policy._id;
            await employee.save();
            console.log('✓ Policy assigned to employee');

            // Clear old balances and create new ones
            const year = new Date().getFullYear();
            await LeaveBalance.deleteMany({ employee: employee._id, year });
            console.log('✓ Old balances cleared');

            // Create balances for all leave types
            const leaveTypes = [
                { type: 'CL', total: 12 },
                { type: 'PL', total: 6 },
                { type: 'SL', total: 7 }
            ];

            for (const leave of leaveTypes) {
                const balance = new LeaveBalance({
                    tenant: tenant._id,
                    employee: employee._id,
                    policy: policy._id,
                    leaveType: leave.type,
                    year,
                    total: leave.total,
                    used: 0,
                    pending: 0,
                    available: leave.total
                });
                await balance.save();
                console.log(`✓ Created ${leave.type}: ${leave.total} days`);
            }

            console.log('\n✅ Successfully added all leave types!');

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
