const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    try {
        const Tenant = require('../models/Tenant');
        const tenant = await Tenant.findOne({ code: { $regex: /^pnr$/i } });
        if (tenant) {
            console.log('Tenant code PNR found:');
            console.log('Code:', tenant.code);
            console.log('Email:', tenant.meta?.email);
            console.log('Password:', tenant.meta?.adminPassword);
        } else {
            console.log('Tenant PNR not found');
        }
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
});
