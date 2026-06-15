require('dotenv').config();
const mongoose = require('mongoose');
const TenantSchema = require('./models/Tenant').schema;
const Tenant = mongoose.model('Tenant', TenantSchema);

async function run() {
    await mongoose.connect(process.env.MONGO_URI);
    const res = await Tenant.updateOne({ code: 'tes001' }, { $set: { 'enabledModules.reports': true } });
    console.log('Update result:', res);
    process.exit(0);
}

run();
