require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Tenant = require('../models/Tenant');
const getTenantDB = require('../utils/tenantDB');

function usage() {
  console.log('Usage: node scripts/resetEmployeePassword.js <emailOrEmployeeId> <newPassword>');
}

async function connectDb() {
  const primaryUri = process.env.MONGO_URI;
  const fallbackUri = process.env.MONGO_FALLBACK_URI || 'mongodb://localhost:27017/hrms';

  try {
    await mongoose.connect(primaryUri);
    return;
  } catch (error) {
    console.warn(`Primary DB connect failed (${error.message}). Trying fallback...`);
    await mongoose.connect(fallbackUri);
  }
}

async function run() {
  const identifier = String(process.argv[2] || '').trim();
  const newPassword = String(process.argv[3] || '');

  if (!identifier || !newPassword) {
    usage();
    process.exit(1);
  }

  const normalizedIdentifier = identifier.toLowerCase();
  const isEmail = normalizedIdentifier.includes('@');
  const nextHash = await bcrypt.hash(newPassword, 10);

  await connectDb();
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const tenants = await Tenant.find({ status: 'active' }).select('_id code').lean();

  let employeeUpdates = 0;
  let userUpdates = 0;

  for (const tenant of tenants) {
    try {
      const tenantDB = await getTenantDB(tenant._id);
      const Employee = tenantDB.model('Employee');

      const employeeQuery = isEmail
        ? { email: normalizedIdentifier }
        : {
            $or: [
              { employeeId: { $regex: new RegExp(`^${identifier}$`, 'i') } },
              { employeeCode: { $regex: new RegExp(`^${identifier}$`, 'i') } },
            ],
          };

      const employee = await Employee.findOne(employeeQuery).lean();
      if (!employee) continue;

      await Employee.updateOne({ _id: employee._id }, { $set: { password: nextHash } });
      employeeUpdates += 1;

      const email = String(employee.email || '').trim().toLowerCase();
      if (email) {
        const userResult = await User.updateMany(
          { email, tenant: tenant._id, role: { $in: ['employee', 'Employee'] } },
          { $set: { password: nextHash } }
        );
        userUpdates += Number(userResult.modifiedCount || 0);
      }

      console.log(
        `Updated tenant=${tenant.code} employeeId=${employee.employeeId || ''} email=${email || '-'}`
      );
    } catch (error) {
      console.warn(`Skipped tenant ${tenant.code}: ${error.message}`);
    }
  }

  await mongoose.disconnect();

  if (employeeUpdates === 0) {
    console.log('No employee found with the given identifier.');
    process.exit(2);
  }

  console.log(`Done. Employee password updated in ${employeeUpdates} tenant record(s).`);
  console.log(`Global employee user records updated: ${userUpdates}`);
}

run().catch(async (error) => {
  console.error('Reset failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_err) {
    // ignore
  }
  process.exit(1);
});
