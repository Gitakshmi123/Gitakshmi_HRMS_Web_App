const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const CURRENT_URI = 'mongodb+srv://ivaharpal_db_user:ivah1801%40%23@cluster0.ikbybhd.mongodb.net/pms_db?retryWrites=true&w=majority&appName=Cluster0';

async function checkUsers() {
  await mongoose.connect(CURRENT_URI);
  console.log('Connected to pms_db on current cluster!');
  
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const users = await User.find({});
  console.log('Total Users:', users.length);
  users.forEach(u => console.log(`- ${u.email} (${u.role})`));
  
  process.exit(0);
}

checkUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
