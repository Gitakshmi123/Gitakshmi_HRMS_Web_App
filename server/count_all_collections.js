const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        let total = 0;
        console.log('--- Collection Count Report ---');
        for (const dbInfo of dbs.databases) {
            const db = mongoose.connection.client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();
            console.log(`${dbInfo.name}: ${collections.length} collections`);
            total += collections.length;
        }
        console.log('----------------------------');
        console.log(`TOTAL COLLECTIONS: ${total}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
