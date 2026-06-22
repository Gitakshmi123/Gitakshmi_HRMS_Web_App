const mongoose = require('mongoose');
const Tenant = require('./models/Tenant');
require('dotenv').config({ path: './.env' });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
  const t = await Tenant.findOne({ companyEmail: 'gitakshmi@gmail.com' }).lean();
  console.log(JSON.stringify(t, null, 2));
  process.exit(0);
}
check();
