const mongoose = require('mongoose');
require('dotenv').config();

async function testLogin() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("DB connected");

  const email = 'pnrpvt@gmail.com';
  
  const User = mongoose.model('User', new mongoose.Schema({}, {strict: false}), 'users');
  const user = await User.findOne({ email: email });
  console.log("User:", user);
  
  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, {strict: false}), 'companies');
  const tenants = await Tenant.find({});
  console.log("Tenants:", tenants.map(t => ({id: t._id, code: t.code, status: t.status})));

  process.exit(0);
}

testLogin().catch(console.error);
