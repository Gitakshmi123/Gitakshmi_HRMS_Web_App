const mongoose = require('mongoose');

async function listTenantsShort() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        const tenants = await db.collection('tenants').find({}).toArray();
        console.log('--- TENANTS ---');
        tenants.forEach(t => {
            console.log(`ID: ${t._id} | Code: ${t.companyCode} | Name: ${t.name}`);
        });
        console.log('---------------');
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

listTenantsShort();
