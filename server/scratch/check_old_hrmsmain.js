const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const OLD_HRMS_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';

async function checkOldData() {
  await mongoose.connect(OLD_HRMS_URI);
  console.log('Connected to hrmsmain on old cluster!');
  
  const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }), 'companies');
  const companies = await Company.find({});
  console.log('Total Companies in hrmsmain:', companies.length);
  companies.slice(0, 5).forEach(c => {
    console.log(`- ${c.companyName} (${c.code})`);
  });
  
  process.exit(0);
}

checkOldData().catch(err => {
  console.error(err);
  process.exit(1);
});
