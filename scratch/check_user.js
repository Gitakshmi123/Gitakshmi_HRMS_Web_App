const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');

  const email = 'n84258106@gmail.com';
  const user = await User.findOne({ email: new RegExp(`^${email}$`, 'i') }).lean();
  console.log('User found:', user ? { _id: user._id, email: user.email, tenant: user.tenant, role: user.role } : 'None');

  const tenants = await Tenant.find({ status: 'active' }).lean();
  console.log('Total active tenants:', tenants.length);

  await mongoose.disconnect();
}

check();
