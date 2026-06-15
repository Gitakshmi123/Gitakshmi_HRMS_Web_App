const mongoose = require('mongoose');

async function fix() {
  const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB (gitakshmi-one)');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');

  const git001 = await Tenant.findOne({ code: 'GIT001' }).lean();
  if (!git001) {
    console.log('GIT001 not found');
    return;
  }
  console.log('Found GIT001:', git001._id);

  // 1. Link baldaniyanitesh2003@gmail.com to GIT001 as Admin
  const emailAdmin = 'baldaniyanitesh2003@gmail.com';
  await User.updateOne(
    { email: new RegExp(`^${emailAdmin}$`, 'i') },
    { $set: { tenant: git001._id, role: 'company_admin' } },
    { upsert: false }
  );
  console.log(`Linked ${emailAdmin} to GIT001 as company_admin`);

  // 2. Check n84258106@gmail.com
  const emailEmp = 'n84258106@gmail.com';
  const empUser = await User.findOne({ email: new RegExp(`^${emailEmp}$`, 'i') }).lean();
  console.log('Employee User:', empUser ? { email: empUser.email, tenant: empUser.tenant, role: empUser.role } : 'None');

  // 3. Ensure PSA user exists if needed
  const psaEmail = 'superadmin@hrms.com';
  const psaUser = await User.findOne({ email: new RegExp(`^${psaEmail}$`, 'i') }).lean();
  if (!psaUser) {
    // We don't necessarily need a User row for PSA because of the bypass logic, 
    // but having one makes getMe cleaner.
    await User.create({
      email: psaEmail,
      role: 'psa',
      name: 'System Super Admin',
      status: 'active'
    });
    console.log('Created PSA user row');
  } else {
    await User.updateOne({ _id: psaUser._id }, { $set: { role: 'psa' } });
    console.log('Updated PSA user role');
  }

  await mongoose.disconnect();
}

fix();
