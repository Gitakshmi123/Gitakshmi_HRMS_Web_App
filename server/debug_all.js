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
            if (!db.models['LeaveBalance']) db.model('LeaveBalance', require('./models/LeaveBalance'));
            if (!db.models['LeavePolicy']) db.model('LeavePolicy', require('./models/LeavePolicy'));

            const Employee = db.model('Employee');
            const LeaveBalance = db.model('LeaveBalance');
            const LeavePolicy = db.model('LeavePolicy');

            // Find all employees
            const employees = await Employee.find({ tenant: tenant._id });
            console.log(`\nTotal Employees: ${employees.length}`);

            for (const emp of employees) {
                console.log(`\n--- ${emp.firstName} ${emp.lastName} (${emp.email}) ---`);
                console.log(`  Role: ${emp.role}`);
                console.log(`  Employee ID: ${emp._id}`);
                console.log(`  Policy ID: ${emp.leavePolicy || 'NONE'}`);

                // Check balances
                const balances = await LeaveBalance.find({
                    employee: emp._id,
                    tenant: tenant._id
                });
                console.log(`  Balances: ${balances.length}`);
                balances.forEach(b => {
                    console.log(`    - ${b.leaveType}: ${b.available}/${b.total}`);
                });
            }

            // Show all policies
            const policies = await LeavePolicy.find({ tenant: tenant._id });
            console.log(`\n\nTotal Policies: ${policies.length}`);
            policies.forEach(p => {
                console.log(`\n  Policy: ${p.name}`);
                console.log(`    ID: ${p._id}`);
                console.log(`    Applicable To: ${p.applicableTo}`);
                console.log(`    Roles: ${p.roles?.join(', ') || 'N/A'}`);
                console.log(`    Rules: ${p.rules.map(r => `${r.leaveType}=${r.totalPerYear}`).join(', ')}`);
            });

        } catch (err) {
            console.error(`Error: ${err.message}`);
        }
    }

    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
