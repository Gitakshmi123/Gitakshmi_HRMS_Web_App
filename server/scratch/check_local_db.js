const mongoose = require('mongoose');

async function checkLocal() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/development_pms', { serverSelectionTimeoutMS: 2000 });
    console.log('Connected to local development_pms!');
    const Company = mongoose.model('Company', new mongoose.Schema({}, { strict: false }), 'companies');
    const companies = await Company.find({});
    console.log('Count:', companies.length);
    companies.forEach(c => console.log(`- ${c.companyName || c.name} (${c.code || c.tenantId})`));
  } catch (err) {
    console.error('Local failed:', err.message);
  }
  
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/hrms', { serverSelectionTimeoutMS: 2000 });
    console.log('Connected to local hrms!');
    const Company = mongoose.model('Company2', new mongoose.Schema({}, { strict: false }), 'companies');
    const companies = await Company.find({});
    console.log('Count:', companies.length);
    companies.forEach(c => console.log(`- ${c.companyName || c.name} (${c.code || c.tenantId})`));
  } catch (err) {
    console.error('Local hrms failed:', err.message);
  }
  
  process.exit(0);
}

checkLocal();
