const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const getTenantDB = require('../utils/tenantDB');

async function checkUsers() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);

  const mainDb = mongoose.connection;

  // Let's print the list of users
  const User = mainDb.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const users = await User.find({}).lean();
  console.log('\n--- USERS IN SYSTEM ---');
  users.forEach(u => {
    console.log(`Email: ${u.email}, Role: ${u.role}, CompanyId/Tenant: ${u.companyId || u.tenantId}`);
  });

  // Let's print the list of tenants
  const Tenant = mainDb.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants');
  const tenants = await Tenant.find({}).lean();
  console.log('\n--- TENANTS IN SYSTEM ---');
  tenants.forEach(t => {
    console.log(`ID: ${t._id}, Name: ${t.name}, Code: ${t.code}`);
  });

  await mongoose.disconnect();
}

checkUsers();
