const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function run() {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms_master';
        console.log('Connecting to:', mongoUri);
        await mongoose.connect(mongoUri);
        
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        console.log('Databases:', dbs.databases.map(d => d.name));

        for (const dbInfo of dbs.databases) {
            const dbName = dbInfo.name;
            if (['admin', 'config', 'local'].includes(dbName)) continue;
            
            const dbConnection = mongoose.connection.useDb(dbName);
            const collections = await dbConnection.db.listCollections().toArray();
            const colNames = collections.map(c => c.name);

            if (colNames.includes('candidates') || colNames.includes('applicants') || colNames.includes('applications')) {
                console.log(`\nDatabase: ${dbName}, Collections:`, colNames.filter(c => ['candidates', 'applicants', 'applications'].includes(c)));
            }

            if (colNames.includes('candidates')) {
                const count = await dbConnection.collection('candidates').countDocuments();
                console.log(`  - candidates count: ${count}`);
                if (count > 0) {
                    const samples = await dbConnection.collection('candidates').find().limit(5).toArray();
                    console.log('  Samples:', samples.map(s => ({ _id: s._id, name: s.name, email: s.email, tenantId: s.tenantId })));
                }
            }

            if (colNames.includes('applicants')) {
                const count = await dbConnection.collection('applicants').countDocuments();
                console.log(`  - applicants count: ${count}`);
                if (count > 0) {
                    const samples = await dbConnection.collection('applicants').find().limit(5).toArray();
                    console.log('  Samples:', samples.map(s => ({ _id: s._id, status: s.status, candidateId: s.candidateId })));
                }
            }

            if (colNames.includes('applications')) {
                const count = await dbConnection.collection('applications').countDocuments();
                console.log(`  - applications count: ${count}`);
                if (count > 0) {
                    const samples = await dbConnection.collection('applications').find().limit(5).toArray();
                    console.log('  Samples:', samples.map(s => ({ _id: s._id, status: s.status })));
                }
            }
        }

        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

run();
