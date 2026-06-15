const mongoose = require('mongoose');

async function findCurrentTenant() {
    try {
        await mongoose.connect('mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0');
        const db = mongoose.connection.db;
        const ids = ["69ae76d0d0a86653c8f75c29", "695d4a6c409f9301a0df9a1d"];
        for (const id of ids) {
            try {
                const tenant = await db.collection('tenants').findOne({ _id: new mongoose.Types.ObjectId(id) });
                if (tenant) {
                    console.log(`Tenant Found with ID ${id}: ${tenant.name || tenant.companyName}`);
                } else {
                    console.log(`Tenant NOT found with ID ${id}`);
                }
            } catch(e) {
                console.log(`Error looking up ID ${id}: ${e.message}`);
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        mongoose.disconnect();
    }
}

findCurrentTenant();
