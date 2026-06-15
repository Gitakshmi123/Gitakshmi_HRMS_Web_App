const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('✅ Connected to Main DB');

    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`\n=== Processing Tenant: ${tenant.name} ===`);
        try {
            const db = await getTenantDB(tenant._id);
            if (!db.models['Employee']) db.model('Employee', require('./models/Employee'));
            if (!db.models['LeavePolicy']) db.model('LeavePolicy', require('./models/LeavePolicy'));
            if (!db.models['LeaveBalance']) db.model('LeaveBalance', require('./models/LeaveBalance'));

            const Employee = db.model('Employee');
            const LeavePolicy = db.model('LeavePolicy');
            const LeaveBalance = db.model('LeaveBalance');

            // Find the Standard Leave Policy
            const policy = await LeavePolicy.findOne({ name: 'Standard Leave Policy', tenant: tenant._id });
            
            if (!policy) {
                console.log('❌ "Standard Leave Policy" not found. Please run create_and_assign_policy.js first.');
                continue;
            }

            console.log(`Found Policy: ${policy.name} (${policy._id})`);

            // Find all employees
            const employees = await Employee.find({ tenant: tenant._id });
            console.log(`Found ${employees.length} employees.`);

            const year = new Date().getFullYear();

            for (const emp of employees) {
                console.log(`Processing ${emp.firstName} ${emp.lastName}...`);
                
                // Assign Policy
                emp.leavePolicy = policy._id;
                await emp.save();

                // Clear Old Balances
                await LeaveBalance.deleteMany({ employee: emp._id, year });

                // Create New Balances
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
                console.log(`   ✓ Assigned policy and created balances.`);
            }

        } catch (err) {
            console.error(`Error in tenant ${tenant.name}:`, err);
        }
    }

    console.log('\n✅ All Done!');
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
