const mongoose = require('mongoose');
require('dotenv').config();

async function listTenants() {
  try {
    const mongoUri = process.env.MONGO_URI;
    const connection = await mongoose.createConnection(mongoUri).asPromise();
    const db = connection.useDb('hrms_tenants_data');

    // Use any to avoid schema issues
    const tenants = await db.collection('tenants').find({}).toArray();
    console.log(`Active Tenants in Master DB: ${tenants.length}`);
    tenants.forEach(t => {
      console.log(`- ${t.companyName} (ID: ${t._id}) -> DB: company_${t._id}`);
    });

    await connection.close();
  } catch (err) {
    console.error("Error listing tenants:", err);
  }
}

listTenants();
