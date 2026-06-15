const mongoose = require('mongoose');

async function checkLocal() {
    try {
        await mongoose.connect('mongodb://localhost:27017/hrms');
        console.log('✅ Connected to local MongoDB');
        
        // Let's print all collections
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        console.log('Collections in local hrms:', collections.map(c => c.name));
        
        // Check companies
        const companies = await db.collection('companies').find({}).toArray();
        console.log('--- Companies in local ---');
        console.log(companies.map(c => ({ id: c._id, name: c.companyName || c.name, code: c.code, databaseName: c.databaseName })));
        
        // Let's also see other databases on localhost
        const admin = mongoose.connection.db.admin();
        const dbs = await admin.listDatabases();
        console.log('✅ Databases on localhost:');
        console.log(dbs.databases.map(d => d.name));
        
        await mongoose.disconnect();
    } catch (e) {
        console.error('❌ Error checking local MongoDB:', e.message);
    }
}
checkLocal();
