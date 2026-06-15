const mongoose = require('mongoose');
const dotenv = require('dotenv').config();

const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
    console.error('❌ MONGO_URI not set in .env');
    process.exit(1);
}

async function listDatabases() {
    try {
        const conn = await mongoose.connect(mongoURI);
        const client = conn.connection.getClient();
        
        console.log('✅ Connected to MongoDB');
        console.log(`\n📊 Listing all databases:\n`);

        const { databases } = await client.db().admin().listDatabases();
        
        databases.forEach((db, idx) => {
            console.log(`${idx + 1}. ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
        });

        console.log(`\nℹ️  Looking for HRMS-related databases...`);
        const hrmsDBs = databases.filter(db => 
            db.name.toLowerCase().includes('hrms') || 
            db.name.toLowerCase().includes('tenant') ||
            db.name.toLowerCase().includes('gt_')
        );

        if (hrmsDBs.length > 0) {
            console.log(`\n🔍 Found HRMS databases:`);
            hrmsDBs.forEach(db => {
                console.log(`   - ${db.name}`);
            });
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

listDatabases();
