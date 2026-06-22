const mongoose = require('mongoose');
const Tenant = require('./models/Tenant');
const User = require('./models/User');
require('dotenv').config({ path: './.env' });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
  
  const users = await User.find({ role: { $in: ['super_admin', 'psa'] } }).lean();
  console.log("Super Admins found: ", users.length);
  console.log(users.map(u => ({ email: u.email, role: u.role, tenantId: u.tenantId })));
  
  process.exit(0);
}
check();
