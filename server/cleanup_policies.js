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

            if (!db.models['LeavePolicy']) {
                db.model('LeavePolicy', require('./models/LeavePolicy'));
            }

            const LeavePolicy = db.model('LeavePolicy');

            // Find all policies
            const policies = await LeavePolicy.find({ tenant: tenant._id });
            console.log(`Found ${policies.length} policies`);

            // Delete any policies with empty rules or invalid data
            for (const policy of policies) {
                if (!policy.rules || policy.rules.length === 0) {
                    console.log(`Deleting invalid policy: ${policy.name} (${policy._id}) - no rules`);
                    await LeavePolicy.deleteOne({ _id: policy._id });
                } else {
                    console.log(`✓ Valid policy: ${policy.name} - ${policy.rules.length} rules`);
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
