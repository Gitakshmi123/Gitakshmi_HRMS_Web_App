const mongoose = require('mongoose');
require('dotenv').config();

async function cleanupOrphanDB() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const connection = await mongoose.createConnection(mongoUri).asPromise();

        // 1. Get active IDs
        const masterDb = connection.useDb('test');
        const tenants = await masterDb.collection('tenants').find({}).toArray();
        const activeIds = tenants.map(t => t._id.toString());

        // 2. List all DBs
        const admin = connection.db.admin();
        const databases = await admin.listDatabases();

        console.log("Checking for orphans...");
        for (const dbInfo of databases.databases) {
            const name = dbInfo.name;
            if (name.startsWith('company_')) {
                const id = name.replace('company_', '');
                if (!activeIds.includes(id)) {
                    console.log(`FOUND ORPHAN: ${name}. Deleting to free up collection slots...`);
                    const dbToDelete = connection.useDb(name);
                    await dbToDelete.db.dropDatabase();
                    console.log(`DELETED: ${name}`);
                    // Just delete one for now to prove fix
                    break;
                }
            }
        }

        await connection.close();
    } catch (err) {
        console.error("Error during cleanup:", err);
    }
}

cleanupOrphanDB();
