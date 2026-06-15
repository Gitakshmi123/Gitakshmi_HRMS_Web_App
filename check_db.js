const mongoose = require('mongoose');
require('dotenv').config({ path: 'server/.env' });
const Employee = require('./server/models/Employee');
const Tenant = require('./server/models/Tenant');

async function check() {
  try {
     const uri = process.env.MONGO_URI;
     if (!uri) throw new Error('No MONGO_URI');
     
     await mongoose.connect(uri);
     console.log('Connected to DB');
     
     // Find 1 active tenant with credentials
     const tenant = await Tenant.findOne({ status: 'active' }).sort({ createdAt: -1 });
     if (tenant) {
         console.log('--- CREDENTIALS ---');
         console.log('Company Code:', tenant.code);
         console.log('Email:', tenant.meta?.email || tenant.meta?.primaryEmail);
         console.log('Password:', tenant.meta?.adminPassword); // Note: In real app this might be hashed, but code says comparison is simple string if not startsWith $2
         console.log('Hashed:', tenant.meta?.adminPassword && tenant.meta.adminPassword.startsWith('$2')); 
         console.log('-------------------');
     } else {
         console.log('No active tenant found.');
     }
     
     process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

check();
