const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const Tenant = require('./models/Tenant');
  const tenants = await Tenant.find({}).lean();
  console.log(JSON.stringify(tenants, null, 2));
  process.exit(0);
}
check();
