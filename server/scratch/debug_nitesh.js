const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function debugPermissions() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const User = mongoose.model('User', require('../models/User'));
    const Tenant = mongoose.model('Tenant', require('../models/Tenant'));

    // 1. Find Nitesh by email
    const email = 'nitesh@gmail.com';
    const users = await User.find({ email: new RegExp(email, 'i') }).lean();
    
    console.log(`\nFound ${users.length} user(s) with email "${email}":`);
    users.forEach(u => {
      console.log(`- ID: ${u._id}`);
      console.log(`  Role: ${u.role}`);
      console.log(`  mainCompanyId: ${u.mainCompanyId}`);
      console.log(`  Permissions Count: ${u.permissions?.length || 0}`);
      const orgPerm = u.permissions?.find(p => p.module === 'company.subCompanies');
      console.log(`  Organization Permission: ${JSON.stringify(orgPerm?.actions || 'NOT FOUND')}`);
    });

    // 2. Find All Tenants
    const tenants = await Tenant.find({}).select('_id name companyCode').lean();
    console.log('\nAvailable Tenants:');
    tenants.forEach(t => {
      console.log(`- ID: ${t._id} | Name: ${t.name} | Code: ${t.companyCode}`);
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

debugPermissions();
