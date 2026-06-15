const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('Connected to Main DB');

    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`\n=== Tenant: ${tenant.name} (${tenant.code}) ===`);
        try {
            const db = await getTenantDB(tenant._id);

            if (!db.models['Employee']) db.model('Employee', require('./models/Employee'));
            if (!db.models['LeavePolicy']) db.model('LeavePolicy', require('./models/LeavePolicy'));

            const Employee = db.model('Employee');
            const LeavePolicy = db.model('LeavePolicy');

            const policies = await LeavePolicy.find({ tenant: tenant._id });
            console.log(`\nLeave Policies (${policies.length}):`);
            policies.forEach(p => {
                console.log(`  - ${p.name} (ID: ${p._id})`);
                console.log(`    Applicable To: ${p.applicableTo}`);
                console.log(`    Rules: ${p.rules.map(r => `${r.leaveType}=${r.totalPerYear}`).join(', ')}`);
            });

            const employees = await Employee.find({ firstName: { $regex: /dharmik/i } });
            console.log(`\nEmployees matching 'Dharmik' (${employees.length}):`);
            employees.forEach(e => {
                console.log(`  - ${e.firstName} ${e.lastName} (${e.employeeId})`);
                console.log(`    ID: ${e._id}`);
                console.log(`    Policy: ${e.leavePolicy || 'NONE'}`);
            });

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
