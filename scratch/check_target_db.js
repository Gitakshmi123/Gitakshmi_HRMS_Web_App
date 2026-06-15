const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const admin = mongoose.connection.db.admin();
  const dbs = await admin.listDatabases();
  console.log('Databases:', dbs.databases.map(d => d.name));

  const targetDbName = 'company_69ef69abc435c6f025c87bbf';
  const targetDb = mongoose.connection.useDb(targetDbName);
  const collections = await targetDb.db.listCollections().toArray();
  console.log(`Collections in ${targetDbName}:`, collections.map(c => c.name));

  if (collections.some(c => c.name === 'employees')) {
    const employees = await targetDb.db.collection('employees').find({}).toArray();
    console.log(`Employees in ${targetDbName}:`, employees.map(e => ({ email: e.email, id: e.employeeId })));
  }

  await mongoose.disconnect();
}

check();
