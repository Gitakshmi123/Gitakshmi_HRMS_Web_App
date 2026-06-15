const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');

async function check() {
  if (fs.existsSync('.env')) dotenv.config({ path: '.env' });
  else if (fs.existsSync('server/.env')) dotenv.config({ path: 'server/.env' });

  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;

  const tenants = await db.collection('tenants').find({}).toArray();
  console.log('Documents in "tenants" collection:', tenants.length);
  tenants.forEach(t => {
    console.log(`- Code: ${t.code || t.companyCode}, ID: ${t._id}, Email: ${t.companyEmail || t.email}`);
  });

  const companies = await db.collection('companies').find({}).toArray();
  console.log('Documents in "companies" collection:', companies.length);
  companies.forEach(t => {
    console.log(`- Code: ${t.code || t.companyCode}, ID: ${t._id}, Email: ${t.companyEmail || t.email}`);
  });

  await mongoose.disconnect();
}

check();
