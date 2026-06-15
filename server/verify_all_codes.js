const mongoose = require('mongoose');
require('dotenv').config();

async function listAll() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const Tenant = require('./models/Tenant');
        const tenants = await Tenant.find({ status: { $ne: 'deleted' } }, 'companyName code tenantId');

        console.log('--- Current Companies in DB ---');
        tenants.forEach(t => {
            console.log(`Company: ${t.companyName}`);
            console.log(`Code:    ${t.code}`);
            console.log(`ID:      ${t.tenantId}`);
            console.log('----------------------------');
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listAll();
