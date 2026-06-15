const mongoose = require('mongoose');

async function check() {
  const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/tenant_a8e2f92a-4ddb-4f33-ace3-88ee43874da3?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(uri);
  const Employee = mongoose.connection.collection('employees');
  const employee = await Employee.findOne({ email: 'test@test.com' });
  console.log('Tenant DB Employee:', employee);
  process.exit(0);
}

check();
