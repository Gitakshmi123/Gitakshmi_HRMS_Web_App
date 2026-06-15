const mongoose = require('mongoose');

async function run() {
    try {
        await mongoose.connect('mongodb://localhost:27017/company_pnr_pnr001_295b0fcc');
        console.log('✅ Connected to local company_pnr_pnr001_295b0fcc');
        
        const db = mongoose.connection.db;
        
        // Print count of documents in applicants, candidates, requirements, users
        const colls = ['applicants', 'candidates', 'requirements', 'users'];
        for (const collName of colls) {
            try {
                const count = await db.collection(collName).countDocuments({});
                console.log(`- Collection '${collName}' has ${count} documents.`);
                if (count > 0) {
                    const docs = await db.collection(collName).find({}).limit(3).toArray();
                    console.log(`  Sample:`, docs.map(d => ({ id: d._id, name: d.name || d.firstName || d.title || d.email })));
                }
            } catch (err) {
                console.log(`- Collection '${collName}' error: ${err.message}`);
            }
        }
        await mongoose.disconnect();
    } catch (e) {
        console.error('Error:', e.message);
    }
}
run();
