const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const tenantId = '69ef69abc435c6f025c87bbf';
  const getTenantDB = require('./utils/tenantDB');
  const db = await getTenantDB(tenantId);
  const Employee = db.model('Employee');

  const employees = await Employee.find({}).lean();
  console.log('Employees in GIT001:', employees.map(e => ({ email: e.email, id: e.employeeId, hasPassword: !!e.password })));

  await mongoose.disconnect();
}

check();
