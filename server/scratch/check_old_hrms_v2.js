const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const OLD_HRMS_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';

async function checkOldData() {
  await mongoose.connect(OLD_HRMS_URI);
  console.log('Connected to hrms on old cluster!');
  
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));
  
  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'tenants');
  const tenants = await Tenant.find({});
  console.log('Total Tenants (tenants coll):', tenants.length);
  tenants.forEach(t => console.log(`- ${t.companyName || t.name}`));
  
  const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }), 'companies');
  const companies = await Company.find({});
  console.log('Total Companies (companies coll):', companies.length);
  
  process.exit(0);
}

checkOldData().catch(err => {
  console.error(err);
  process.exit(1);
});
