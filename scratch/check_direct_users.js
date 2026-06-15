const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const users = await mongoose.connection.db.collection('users').find({}).toArray();
  console.log('Total users in collection:', users.length);
  console.log('Users:', users.map(u => ({ email: u.email, role: u.role, tenant: u.tenant })));

  await mongoose.disconnect();
}

check();
