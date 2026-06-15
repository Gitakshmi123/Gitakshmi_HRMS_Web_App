const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const THIRD_HRMS_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';

async function checkUsers() {
  await mongoose.connect(THIRD_HRMS_URI);
  console.log('Connected to gitakshmi-one on third cluster!');
  
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const count = await User.countDocuments();
  console.log('Total Users:', count);
  
  process.exit(0);
}

checkUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
