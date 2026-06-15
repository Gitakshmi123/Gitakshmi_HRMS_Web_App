const mongoose = require('mongoose');
require('dotenv').config();

async function checkTenants() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms');
        const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false, collection: 'companies' }));
        
        const tenants = await Tenant.find({}).sort({ updatedAt: -1 }).lean();
        console.log(`Found ${tenants.length} tenants`);
        tenants.forEach(t => {
            console.log(`- ID: ${t._id} | Name: ${t.companyName || t.name} | Status: ${t.status} | Code: ${t.code}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkTenants();
