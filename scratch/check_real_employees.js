const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB (gitakshmi-one)');

  const targetDbName = 'company_69e7cc21e1bb34e2e53190d8';
  const targetDb = mongoose.connection.useDb(targetDbName);
  
  const employees = await targetDb.db.collection('employees').find({}).toArray();
  console.log(`Employees in ${targetDbName}:`, employees.map(e => ({ email: e.email, id: e.employeeId })));

  await mongoose.disconnect();
}

check();
