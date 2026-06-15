const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  
  console.log('--- USERS ---');
  const users = await db.collection('users').find({}).limit(10).toArray();
  console.log(users.map(u => ({ name: u.name, email: u.email, role: u.role, isActive: u.isActive, mainCompanyId: u.mainCompanyId })));
  
  console.log('--- EMPLOYEES ---');
  const employees = await db.collection('employees').find({}).limit(10).toArray();
  console.log(employees.map(e => ({ name: e.name || e.firstName, email: e.email, status: e.status, mainCompanyId: e.mainCompanyId })));
  
  process.exit(0);
}
check();
