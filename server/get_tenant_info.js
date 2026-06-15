const mongoose = require('mongoose');

async function getTenantInfo() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        const t = await db.collection('tenants').findOne({ _id: new mongoose.Types.ObjectId("69ae76d0d0a86653c8f75c29") });
        if (t) {
            console.log(`ID: ${t._id} | Code: ${t.companyCode} | Name: ${t.name}`);
        } else {
            console.log('Tenant not found');
        }
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

getTenantInfo();
