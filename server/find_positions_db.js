const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        for (const dbInfo of dbs.databases) {
            const db = mongoose.connection.client.db(dbInfo.name);
            const collections = await db.listCollections().toArray();
            const names = collections.map(c => c.name);
            if (names.includes('positions')) {
                console.log(`Found 'positions' in ${dbInfo.name}`);
                const pos = await db.collection('positions').find().toArray();
                console.log(`Count: ${pos.length}`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
