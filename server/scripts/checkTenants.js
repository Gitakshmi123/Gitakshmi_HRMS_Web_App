const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function check() {
    const uri = process.env.MONGO_URI;
    console.log('Connecting to:', uri);
    await mongoose.connect(uri);
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({ code: String, tenantId: String, status: String }));
    const ts = await Tenant.find({}).lean();
    console.log('Tenants found:', ts.length);
    console.log(JSON.stringify(ts, null, 2));
    process.exit(0);
}
check().catch(err => {
    console.error(err);
    process.exit(1);
});
