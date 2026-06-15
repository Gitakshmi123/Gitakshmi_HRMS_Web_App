const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const emailRegex = /nitesh/i;
  
  // Check main users collection
  const users = await mongoose.connection.db.collection('users').find({ email: emailRegex }).toArray();
  console.log('Main users found:', users.map(u => ({ email: u.email, role: u.role, tenantId: u.tenantId })));
  
  // Check all tenants
  const tenants = await mongoose.connection.db.collection('tenants').find({ ownerName: emailRegex }).toArray();
  console.log('Tenants found by ownerName:', tenants.map(t => ({ name: t.companyName, id: t._id, code: t.code })));

  process.exit(0);
}

run().catch(console.error);
