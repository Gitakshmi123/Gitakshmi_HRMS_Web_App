const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const email = 'niteshbaldanitya@gmail.com';
  
  // Try to find in TMS AuthLookup
  const lookup = await mongoose.connection.db.collection('authlookups').findOne({ email });
  console.log('AuthLookup result:', lookup);

  if (lookup) {
     const company = await mongoose.connection.db.collection('companies').findOne({ _id: lookup.tenantId });
     console.log('Company found:', company?.name, company?.organizationId);
  }

  const allCompanies = await mongoose.connection.db.collection('companies').find().limit(10).toArray();
  console.log('Sample Companies:', allCompanies.map(c => ({ name: c.name, orgId: c.organizationId, id: c._id })));

  const hrmsCompanies = await mongoose.connection.useDb('hrms').db.collection('tenants').find().limit(10).toArray();
  console.log('Sample HRMS Tenants:', hrmsCompanies.map(t => ({ name: t.companyName, code: t.code, id: t._id, tenantId: t.tenantId })));

  process.exit(0);
}

run().catch(console.error);
