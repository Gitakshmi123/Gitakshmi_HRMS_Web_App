const mongoose = require('mongoose');

async function check() {
  const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(uri);
  const User = mongoose.connection.collection('users');
  const user = await User.findOne({ email: 'test@test.com' });
  console.log('Main DB User:', user);
  
  if (user && user.tenant) {
      console.log('Resolving Tenant:', user.tenant);
      const Tenant = mongoose.connection.collection('tenants');
      const tenant = await Tenant.findOne({ _id: user.tenant });
      console.log('Tenant:', tenant);
  }
  
  process.exit(0);
}

check();
