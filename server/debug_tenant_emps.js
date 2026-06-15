
const mongoose = require('mongoose');
require('dotenv').config();

const Tenant = require('./models/Tenant');
const getTenantDB = require('./utils/tenantDB');

async function debugTenant(code) {
  try {
    const mongoUri = process.env.MONGO_URI;
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const tenant = await Tenant.findOne({ code });
    if (!tenant) {
      console.log(`Tenant ${code} not found.`);
      process.exit(1);
    }
    console.log(`Tenant ${code} ID: ${tenant._id}`);

    const db = await getTenantDB(tenant._id);
    const Employee = db.model("Employee");
    const employees = await Employee.find({}).lean();
    console.log(`Found ${employees.length} employees in tenant ${code}:`);
    for (const emp of employees) {
      console.log(`- ${emp.email} (${emp.firstName} ${emp.lastName})`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

debugTenant("tes001");
