const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const Tenant = require('../models/Tenant');
        const tenants = await Tenant.find({}).toArray ? await Tenant.find({}).toArray() : await Tenant.find({});
        console.log('All Tenants count:', tenants.length);
        tenants.forEach(t => {
            console.log(`- Code: ${t.code}, Email: ${t.meta?.email}, Password: ${t.meta?.adminPassword}`);
        });
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
});
