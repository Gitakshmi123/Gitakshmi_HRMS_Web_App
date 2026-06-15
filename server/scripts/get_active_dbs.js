const mongoose = require('mongoose');
require('dotenv').config();

async function getActiveTenantDBs() {
    try {
        const mongoUri = process.env.MONGO_URI;
        const connection = await mongoose.createConnection(mongoUri).asPromise();
        const db = connection.useDb('test');

        const tenants = await db.collection('tenants').find({}).toArray();
        console.log(`Active Tenant IDs:`);
        tenants.forEach(t => {
            console.log(`- ${t._id} (${t.name}) -> company_${t._id}`);
        });

        await connection.close();
    } catch (err) {
        console.error("Error:", err);
    }
}

getActiveTenantDBs();
