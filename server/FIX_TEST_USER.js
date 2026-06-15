const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function fix() {
  const password = '123456789';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  console.log('Generated Hash:', hash);

  const mainUri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';
  const tenantUri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69d626068560596a949a0010?retryWrites=true&w=majority&appName=Cluster0';

  // Fix Main User
  const conn1 = await mongoose.createConnection(mainUri).asPromise();
  await conn1.collection('users').updateOne({ email: 'test@test.com' }, { $set: { password: hash } });
  console.log('Fixed Main DB User');
  await conn1.close();

  // Fix Tenant Employee
  const conn2 = await mongoose.createConnection(tenantUri).asPromise();
  await conn2.collection('employees').updateOne({ email: 'test@test.com' }, { $set: { password: hash } });
  console.log('Fixed Tenant DB Employee');
  await conn2.close();

  console.log('All fixed! Please try login again.');
  process.exit(0);
}

fix();
