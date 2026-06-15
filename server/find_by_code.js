const mongoose = require('mongoose');

async function findByCode() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        const tenants = await db.collection('tenants').find({ companyCode: "goo001" }).toArray();
        console.log(`Found ${tenants.length} tenants with code goo001:`);
        tenants.forEach(t => {
            console.log(`ID: ${t._id} | Name: ${t.name}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

findByCode();
