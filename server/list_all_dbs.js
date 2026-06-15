const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const listAllDbs = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        console.log('Databases on this cluster:');
        console.log(dbs.databases.map(db => db.name));

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

listAllDbs();
