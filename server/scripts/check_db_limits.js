const mongoose = require('mongoose');
require('dotenv').config();

async function checkCollections() {
    try {
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            console.error("MONGO_URI not found in .env");
            return;
        }

        const connection = await mongoose.createConnection(mongoUri).asPromise();
        const admin = connection.db.admin();

        const databases = await admin.listDatabases();
        console.log(`Found ${databases.databases.length} databases.`);

        let totalCollections = 0;
        for (const dbInfo of databases.databases) {
            const db = connection.useDb(dbInfo.name);
            const collections = await db.db.listCollections().toArray();
            console.log(`DB: ${dbInfo.name} - Collections: ${collections.length}`);
            totalCollections += collections.length;
        }

        console.log(`\nTotal Collections in Cluster: ${totalCollections}`);
        await connection.close();
    } catch (err) {
        console.error("Error checking collections:", err);
    }
}

checkCollections();
