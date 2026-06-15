const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const MONGO_URI = 'mongodb+srv://ivaharpal_db_user:ivah1801%40%23@cluster0.ikbybhd.mongodb.net/pms_db?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected!');
  
  // PSA uses 'Tenant' model but the collection name might be 'companies' or 'tenants'
  // Let's check 'companies' first as it was in the list
  const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }), 'companies');
  const companies = await Company.find({});
  console.log('Companies:', JSON.stringify(companies, null, 2));
  
  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const userCount = await User.countDocuments();
  console.log('User Count:', userCount);
  
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
