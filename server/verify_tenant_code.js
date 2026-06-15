const mongoose = require('mongoose');
require('dotenv').config();
const Tenant = require('./models/Tenant');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const code = 'tes001';
        const tenant = await Tenant.findOne({ code });
        console.log('Result for code:', code);
        if (tenant) {
            console.log('Tenant Found:', tenant.name, tenant._id);
        } else {
            console.log('Tenant NOT FOUND');
            // List all tenants to see what codes exist
            const all = await Tenant.find({}, 'name code');
            console.log('All Tenants:', all.map(t => `${t.name} (${t.code})`));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

run();
