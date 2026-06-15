
const mongoose = require('mongoose');
require('dotenv').config();

async function checkTenants() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({}).lean();
    console.log(JSON.stringify(tenants.map(t => ({ 
        id: t._id, 
        name: t.companyName, 
        code: t.code, 
        enabled: t.enabledModules,
        status: t.status
    })), null, 2));
    process.exit(0);
  } catch (err) { console.error(err); process.exit(1); }
}
checkTenants();
