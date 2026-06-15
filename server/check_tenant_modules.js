const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const Tenant = require('./models/Tenant');

async function checkTenant() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');
        
        const tenant = await Tenant.findOne({ code: 'GIT001' }); // Assuming default code
        if (!tenant) {
            console.log('Tenant GIT001 not found');
            const allTenants = await Tenant.find({}).limit(5);
            console.log('Available tenants:', allTenants.map(t => t.code));
            return;
        }
        
        console.log('Tenant:', tenant.code);
        console.log('Enabled Modules:', tenant.enabledModules);
        
        await mongoose.disconnect();
    } catch (err) {
        console.error(err);
    }
}

checkTenant();
