const mongoose = require('mongoose');
require('dotenv').config();

async function findTenantsCollection() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const connection = await mongoose.createConnection(mongoUri).asPromise();
        const admin = connection.db.admin();
        const databases = await admin.listDatabases();

        for (const dbInfo of databases.databases) {
            const db = connection.useDb(dbInfo.name);
            const collections = await db.db.listCollections().toArray();
            const hasTenants = collections.some(c => c.name === 'tenants');
            if (hasTenants) {
                const count = await db.collection('tenants').countDocuments();
                console.log(`DB: ${dbInfo.name} has 'tenants' collection with ${count} documents.`);
            }
        }

        await connection.close();
    } catch (err) {
        console.error("Error:", err);
    }
}

findTenantsCollection();
