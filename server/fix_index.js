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

            // Get the leavepolicies collection
            const collection = db.collection('leavepolicies');

            // List all indexes
            const indexes = await collection.indexes();
            console.log('Current indexes:');
            indexes.forEach(idx => {
                console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
            });

            // Drop the problematic index if it exists
            try {
                await collection.dropIndex('tenant_1_leaveType_1');
                console.log('✓ Dropped tenant_1_leaveType_1 index');
            } catch (err) {
                if (err.message.includes('index not found')) {
                    console.log('  (Index does not exist)');
                } else {
                    console.error('  Error dropping index:', err.message);
                }
            }

            // List indexes after drop
            const indexesAfter = await collection.indexes();
            console.log('\nIndexes after cleanup:');
            indexesAfter.forEach(idx => {
                console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
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
