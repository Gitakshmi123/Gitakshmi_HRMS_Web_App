const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const users = await User.find({}).limit(10).lean();
  console.log('Total Users:', await User.countDocuments({}));
  console.log('Sample Users (Active):', await User.countDocuments({ isActive: { $ne: false } }));
  console.log('Sample Users JSON:', JSON.stringify(users.map(u => ({ name: u.name, email: u.email, role: u.role, isActive: u.isActive, mainCompanyId: u.mainCompanyId })), null, 2));
  process.exit(0);
}
check();
