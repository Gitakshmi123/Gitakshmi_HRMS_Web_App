const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

async function checkTenants() {
  try {
    console.log('Connecting to:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const Tenant = require('./server/models/Tenant');
    const tenants = await Tenant.find({}).lean();
    
    console.log(`Total Tenants in DB: ${tenants.length}`);
    tenants.forEach(t => {
      console.log(`- ID: ${t._id}, Name: ${t.companyName}, parentCompanyId: ${t.parentCompanyId}, status: ${t.status}`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkTenants();
