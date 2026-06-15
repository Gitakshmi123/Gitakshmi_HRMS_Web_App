const mongoose = require('mongoose');
require('dotenv').config();

const getTenantDB = require('./utils/tenantDB');

async function checkEmployee() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("DB connected");

  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, {strict: false}), 'companies');
  const tenant = await Tenant.findOne({ code: 'pnr002' });
  
  if (tenant) {
    const tenantDB = await getTenantDB(tenant._id);
    const Employee = tenantDB.model('Employee');
    const emp = await Employee.findOne({ email: 'pnrpvt@gmail.com' });
    console.log("Employee in tenant DB:", emp);
  } else {
    console.log("Tenant not found");
  }

  process.exit(0);
}

checkEmployee().catch(console.error);
