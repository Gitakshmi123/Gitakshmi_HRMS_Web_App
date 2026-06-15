const mongoose = require('mongoose');
require('dotenv').config();

// Import dbManager functions
const { getTenantDB } = require('./config/dbManager');

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI).then(async () => {
    console.log('Connected to Main DB');

    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
    const tenants = await Tenant.find({});

    for (const tenant of tenants) {
        console.log(`\n=== Tenant: ${tenant._id} ===`);
        try {
            const db = getTenantDB(tenant._id.toString());

            // Get the lettertemplates collection
            const collection = db.collection('lettertemplates');

            // List all indexes
            const indexes = await collection.indexes();
            console.log('Current indexes:');
            indexes.forEach(idx => {
                console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
            });

            // Drop the problematic old index if it exists
            try {
                await collection.dropIndex('tenant_1_letterType_1_templateName_1');
                console.log('✓ Dropped tenant_1_letterType_1_templateName_1 index');
            } catch (err) {
                if (err.message.includes('index not found') || err.code === 27) {
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
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});

