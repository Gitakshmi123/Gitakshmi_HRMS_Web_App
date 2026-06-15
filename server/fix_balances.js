const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('Connected to Main DB');

    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`\nChecking Tenant: ${tenant.name} (${tenant.code})`);
        try {
            const db = await getTenantDB(tenant._id);

            // Register models
            if (!db.models['Employee']) db.model('Employee', require('./models/Employee'));
            if (!db.models['LeaveBalance']) db.model('LeaveBalance', require('./models/LeaveBalance'));
            if (!db.models['LeavePolicy']) db.model('LeavePolicy', require('./models/LeavePolicy'));

            const Employee = db.model('Employee');
            const LeaveBalance = db.model('LeaveBalance');
            const LeavePolicy = db.model('LeavePolicy');

            // Find all employees with a policy but no balances
            const employees = await Employee.find({ leavePolicy: { $exists: true, $ne: null } });
            console.log(`Found ${employees.length} employees with policies`);

            for (const emp of employees) {
                console.log(`\n--- Employee: ${emp.firstName} ${emp.lastName} (${emp.employeeId}) ---`);
                console.log(`    Policy ID: ${emp.leavePolicy}`);

                const policy = await LeavePolicy.findById(emp.leavePolicy);
                if (!policy) {
                    console.log(`    ❌ Policy NOT FOUND - removing reference`);
                    emp.leavePolicy = null;
                    await emp.save();
                    continue;
                }

                console.log(`    ✓ Policy: ${policy.name} with ${policy.rules.length} rules`);

                const year = new Date().getFullYear();
                const existingBalances = await LeaveBalance.find({ employee: emp._id, year });
                console.log(`    Existing balances: ${existingBalances.length}`);

                if (existingBalances.length === 0 && policy.rules.length > 0) {
                    console.log(`    Creating balances...`);

                    for (const rule of policy.rules) {
                        const newBalance = new LeaveBalance({
                            tenant: tenant._id,
                            employee: emp._id,
                            policy: policy._id,
                            leaveType: rule.leaveType,
                            year,
                            total: rule.totalPerYear || 0,
                            used: 0,
                            pending: 0,
                            available: rule.totalPerYear || 0
                        });
                        await newBalance.save();
                        console.log(`      ✓ Created ${rule.leaveType}: ${rule.totalPerYear}`);
                    }
                } else if (existingBalances.length > 0) {
                    console.log(`    Balances already exist:`);
                    existingBalances.forEach(b => {
                        console.log(`      - ${b.leaveType}: ${b.available}/${b.total}`);
                    });
                }
            }

        } catch (err) {
            console.error(`Error: ${err.message}`);
        }
    }

    console.log('\n✅ Done!');
    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
