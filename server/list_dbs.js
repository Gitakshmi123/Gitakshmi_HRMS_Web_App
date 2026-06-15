const mongoose = require('mongoose');
require('dotenv').config();

async function listDbs() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const admin = mongoose.connection.useDb('admin').db.admin();
        const dbs = await admin.listDatabases();
        console.log('Databases on this cluster:');
        dbs.databases.forEach(db => console.log(` - ${db.name}`));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

listDbs();
