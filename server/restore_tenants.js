const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const db = mongoose.connection.client.db('test');
        const tenants = require('./tenants_list.json');
        
        for (let t of tenants) {
            await db.collection('tenants').updateOne(
                { _id: new mongoose.Types.ObjectId(t._id) },
                { $set: { code: t.code, slug: t.code, databaseName: 'company_' + t._id, _id: new mongoose.Types.ObjectId(t._id) } },
                { upsert: true }
            );
        }
        
        // Also look at tenant_dump.json and try to restore that
        try {
            const fs = require('fs');
            const dumpData = fs.readFileSync('./tenant_dump.json', 'utf8');
            const match = dumpData.match(/FULL_TENANT:(.*)/);
            if (match) {
                const fullTenant = JSON.parse(match[1]);
                if (fullTenant._id) {
                    fullTenant._id = new mongoose.Types.ObjectId(fullTenant._id);
                    await db.collection('tenants').updateOne(
                        { _id: fullTenant._id },
                        { $set: fullTenant },
                        { upsert: true }
                    );
                    console.log('Restored full tenant from dump');
                }
            }
        } catch (err) {
            console.log('Could not restore from dump', err.message);
        }

        console.log('Restored tenants successfully.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
