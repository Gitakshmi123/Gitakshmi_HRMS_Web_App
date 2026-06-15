const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
    const tenants = await Tenant.find({});
    console.log(`Found ${tenants.length} tenants`);

    if (tenants.length > 0) {
        let foundAny = false;
        // Loop through all tenants to find the employee
        for (let t of tenants) {
            try {
                const tenantId = t._id.toString();
                const tenantDB = await getTenantDB(tenantId);
                const EmployeeCompensation = tenantDB.model('EmployeeCompensation', require('./models/EmployeeCompensation'));
                const Employee = tenantDB.model('Employee', require('./models/Employee'));

                const ivas = await Employee.find({ firstName: /Iva/i });
                if (ivas.length > 0) {
                    console.log(`\nFound employees in tenant ${t.code}:`, ivas.map(e => e.firstName));
                    foundAny = true;
                    for (const iva of ivas) {
                        const comp = await EmployeeCompensation.findOne({ employeeId: iva._id, status: 'ACTIVE' }).lean();
                        console.log(`Compensation for ${iva.firstName}:`, JSON.stringify(comp, null, 2));
                    }
                }
            } catch (err) {
                // Ignore errors for individual tenants
            }
        }
        if (!foundAny) console.log("Could not find employee 'Iva' in any tenant.");
    }
    process.exit(0);
}
run().catch(console.error);
