const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const THIRD_HRMS_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';

async function checkOldData() {
  await mongoose.connect(THIRD_HRMS_URI);
  console.log('Connected to gitakshmi-one on third cluster!');
  
  const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }), 'companies');
  const companies = await Company.find({});
  console.log('Total Companies (companies coll):', companies.length);
  companies.forEach(c => console.log(`- ${c.companyName} (${c.code})`));
  
  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants');
  const tenants = await Tenant.find({});
  console.log('Total Tenants (tenants coll):', tenants.length);
  tenants.forEach(t => console.log(`- ${t.companyName || t.name}`));
  
  process.exit(0);
}

checkOldData().catch(err => {
  console.error(err);
  process.exit(1);
});
