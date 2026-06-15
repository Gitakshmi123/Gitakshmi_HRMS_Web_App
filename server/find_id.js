const mongoose = require('mongoose');
require('dotenv').config();

async function findId() {
    await mongoose.connect(process.env.MONGODB_URI);
    const id = "69d67161c3784c4def51e2c5";
    
    // Check main DB collections first (just in case)
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`Checking ${collections.length} collections in main DB...`);
    
    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({});
    
    for (const t of tenants) {
        process.stdout.write(`Checking Tenant ${t.code}... `);
        try {
            const getTenantDB = require('./utils/tenantDB');
            const tDb = await getTenantDB(t._id.toString());
            
            const models = ['Applicant', 'TrackerCandidate', 'Candidate', 'Employee', 'Requirement'];
            for (const m of models) {
                try {
                    const Model = tDb.model(m);
                    const doc = await Model.findById(id);
                    if (doc) {
                        console.log(`\n\nFOUND! Collection: ${m}, Tenant: ${t.code}`);
                        console.log(JSON.stringify(doc, null, 2));
                        process.exit(0);
                    }
                } catch (e) {}
            }
            console.log("Done.");
        } catch (e) {
            console.log("Error: " + e.message);
        }
    }
    console.log("\nID not found in any tenant.");
    process.exit(1);
}

findId();
