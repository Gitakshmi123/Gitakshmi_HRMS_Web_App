const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  
  const companies = await mongoose.connection.db.collection('companies').find({ name: /Nitesh/i }).toArray();
  console.log('Companies:', companies.map(c => ({ id: c._id, name: c.name, orgId: c.organizationId })));

  process.exit(0);
}

run().catch(console.error);
