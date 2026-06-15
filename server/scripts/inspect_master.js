const mongoose = require('mongoose');
require('dotenv').config();

async function inspectMasterDB() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const connection = await mongoose.createConnection(mongoUri).asPromise();
        const db = connection.useDb('hrms_tenants_data');

        const collections = await db.db.listCollections().toArray();
        console.log(`Collections in hrms_tenants_data:`, collections.map(c => c.name));

        await connection.close();
    } catch (err) {
        console.error("Error inspecting master DB:", err);
    }
}

inspectMasterDB();
