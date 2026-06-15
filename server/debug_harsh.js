const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('✅ Connected to Main DB');

    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`\n=== Tenant: ${tenant.name} ===`);
        const db = await getTenantDB(tenant._id);
        const Employee = db.model('Employee', require('./models/Employee'));
        const LeavePolicy = db.model('LeavePolicy', require('./models/LeavePolicy'));
        const LeaveBalance = db.model('LeaveBalance', require('./models/LeaveBalance'));

        const employees = await Employee.find({
            $or: [
                { firstName: { $regex: /Harsh/i } },
                { lastName: { $regex: /Shah/i } }
            ]
        });

        if (employees.length === 0) {
            console.log("No employee found with name matching 'Harsh' or 'Shah'");
            continue;
        }

        for (const emp of employees) {
            console.log(`\nUser: ${emp.firstName} ${emp.lastName} (${emp.email})`);
            console.log(`ID: ${emp._id}`);
            console.log(`Current Policy ID in Employee Doc: ${emp.leavePolicy}`);

            if (emp.leavePolicy) {
                const policy = await LeavePolicy.findById(emp.leavePolicy);
                console.log(`Policy Details: ${policy ? policy.name : '❌ POLICY DOC NOT FOUND'}`);
            } else {
                console.log(`Policy: ❌ NONE`);
            }

            const balances = await LeaveBalance.find({ employee: emp._id });
            console.log(`Balances Found: ${balances.length}`);
            balances.forEach(b => {
                console.log(` - ${b.leaveType}: Total ${b.total}, Available ${b.available}, Year ${b.year}`);
            });
        }
    }

    process.exit();
}).catch(err => {
    console.error(err);
    process.exit(1);
});
