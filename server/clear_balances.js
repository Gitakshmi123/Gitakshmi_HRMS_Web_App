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

            const Employee = db.model('Employee');
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
            console.log(`Employee ID: ${employee._id}`);
            console.log(`Policy assigned: ${employee.leavePolicy}`);

            // Find all balances for this employee
            const balances = await LeaveBalance.find({
                employee: employee._id,
                tenant: tenant._id
            });

            console.log(`\nLeave Balances (${balances.length}):`);
            balances.forEach(b => {
                console.log(`  - ${b.leaveType}: ${b.available}/${b.total} (Policy: ${b.policy})`);
            });

            // Delete all balances
            console.log('\nDeleting all balances...');
            const result = await LeaveBalance.deleteMany({
                employee: employee._id,
                tenant: tenant._id
            });
            console.log(`✓ Deleted ${result.deletedCount} balances`);

            // Remove policy reference
            employee.leavePolicy = null;
            await employee.save();
            console.log('✓ Removed policy reference from employee');

            console.log('\n✅ All leave balances cleared!');

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
