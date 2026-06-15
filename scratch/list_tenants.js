const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');

async function check() {
  if (fs.existsSync('.env')) dotenv.config({ path: '.env' });
  else if (fs.existsSync('server/.env')) dotenv.config({ path: 'server/.env' });

  await mongoose.connect(process.env.MONGO_URI);
  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));

  const tenants = await Tenant.find({}).lean();
  console.log('Total tenants:', tenants.length);
  tenants.forEach(t => {
    console.log(`- Tenant: ${t.code}, ID: ${t._id}, Status: ${t.status}`);
  });

  await mongoose.disconnect();
}

check();
