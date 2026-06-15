const mongoose = require('mongoose');
require('dotenv').config();
const getTenantDB = require('./utils/tenantDB');

async function check() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to main DB");

        // Assuming a tenant ID or code. I'll search for tenants first.
        const Tenant = require('./models/Tenant');
        const tenants = await Tenant.find({});
        console.log(`Found ${tenants.length} tenants`);

        for (const tenant of tenants) {
            console.log(`Checking tenant: ${tenant.companyName} (${tenant._id})`);
            const tenantDb = await getTenantDB(tenant._id.toString());
            const LeaveRequest = tenantDb.model('LeaveRequest');
            const leaves = await LeaveRequest.find({}).limit(5);
            console.log(`  Found ${leaves.length} leaves`);
            leaves.forEach(l => console.log(`    ID: ${l._id}`));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
