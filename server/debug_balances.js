const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('Connected to Main DB');

    // We need to find the tenant first.
    // Assuming there is at least one active tenant or we check all.
    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});
    console.log(`Found ${tenants.length} tenants.`);

    for (const tenant of tenants) {
        console.log(`\nChecking Tenant: ${tenant.name} (${tenant.code}) - ID: ${tenant._id}`);
        try {
            const db = await getTenantDB(tenant._id);

            // Register models manually for this script context
            if (!db.models['Employee']) db.model('Employee', require('./models/Employee'));
            if (!db.models['LeaveBalance']) db.model('LeaveBalance', require('./models/LeaveBalance'));
            if (!db.models['LeavePolicy']) db.model('LeavePolicy', require('./models/LeavePolicy'));

            const Employee = db.model('Employee');
            const LeaveBalance = db.model('LeaveBalance');
            const LeavePolicy = db.model('LeavePolicy');

            // Find Employee Dharmik
            const employees = await Employee.find({ firstName: { $regex: /Dharmik/i } });
            console.log(`Found ${employees.length} employees matching 'Dharmik' in this tenant.`);

            for (const emp of employees) {
                console.log(`--- Employee: ${emp.firstName} ${emp.lastName} (${emp.employeeId}) ---`);
                console.log(`    ID: ${emp._id}`);
                console.log(`    Policy ID Assigned: ${emp.leavePolicy}`);

                if (emp.leavePolicy) {
                    const policy = await LeavePolicy.findById(emp.leavePolicy);
                    console.log(`    Policy Details: ${policy ? policy.name : 'NOT FOUND'}`);
                    if (policy) {
                        console.log(`    Rules: ${JSON.stringify(policy.rules)}`);
                    }
                }

                const balances = await LeaveBalance.find({ employee: emp._id });
                console.log(`    Balances found: ${balances.length}`);
                balances.forEach(b => {
                    console.log(`       - ${b.leaveType}: Total=${b.total}, Available=${b.available}, Year=${b.year}`);
                });
            }

        } catch (err) {
            console.error(`Error checking tenant ${tenant.code}:`, err.message);
        }
    }

    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
