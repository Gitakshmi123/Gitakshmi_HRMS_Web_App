const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB (hrmsmain)');

  const employees = await mongoose.connection.db.collection('employees').find({}).toArray();
  console.log('Employees in hrmsmain:', employees.map(e => ({ email: e.email, id: e.employeeId })));

  await mongoose.disconnect();
}

check();
