require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Tenant = require('../models/Tenant');
const getTenantDB = require('../utils/tenantDB');

async function run() {
  const emailArg = String(process.argv[2] || '').trim().toLowerCase();
  const passwordArg = String(process.argv[3] || '');

  if (!emailArg || !passwordArg) {
    console.error('Usage: node scripts/checkEmployeeLogin.js <email> <password>');
    process.exit(1);
  }

  const primaryUri = process.env.MONGO_URI;
  const fallbackUri = process.env.MONGO_FALLBACK_URI || 'mongodb://localhost:27017/hrms';
  try {
    await mongoose.connect(primaryUri);
  } catch (error) {
    console.warn(`Primary DB connect failed (${error.message}). Trying fallback...`);
    await mongoose.connect(fallbackUri);
  }

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find({ email: emailArg }).lean();
  console.log(`Global users found: ${users.length}`);
  for (const u of users) {
    let match = false;
    if (String(u.password || '').startsWith('$2')) {
      match = await bcrypt.compare(passwordArg, u.password);
    } else {
      match = String(u.password || '') === passwordArg;
    }
    console.log(
      `User: id=${u._id} role=${u.role || ''} tenant=${u.tenant || ''} passwordMatch=${match}`
    );
  }

  const activeTenants = await Tenant.find({ status: 'active' }).select('_id code').lean();
  let foundEmployees = 0;

  for (const tenant of activeTenants) {
    try {
      const tenantDB = await getTenantDB(tenant._id);
      const Employee = tenantDB.model('Employee');
      const employee = await Employee.findOne({ email: emailArg }).lean();
      if (!employee) continue;

      foundEmployees += 1;
      let match = false;
      if (String(employee.password || '').startsWith('$2')) {
        match = await bcrypt.compare(passwordArg, employee.password);
      } else {
        match = String(employee.password || '') === passwordArg;
      }
      console.log(
        `Employee: tenant=${tenant.code} id=${employee._id} empId=${employee.employeeId || ''} passwordMatch=${match}`
      );
    } catch (_err) {
      // Skip broken tenant connections and continue diagnostics.
    }
  }

  console.log(`Tenant employee records found: ${foundEmployees}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Diagnosis failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_err) {
    // Ignore disconnect errors.
  }
  process.exit(1);
});
