const mongoose = require('mongoose');

async function check() {
  const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(uri);
  const User = mongoose.connection.collection('users');
  const users = await User.find({ email: 'test@test.com' }).toArray();
  console.log('All users for test@test.com:', users);
  
  const tenants = await mongoose.connection.collection('tenants').find({ companyEmail: 'test@test.com' }).toArray();
  console.log('All tenants for test@test.com:', tenants);
  
  process.exit(0);
}

check();
