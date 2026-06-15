const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  
  const tenants = await mongoose.connection.db.collection('tenants').find({ companyName: /Nitesh/i }).toArray();
  console.log('Tenants:', tenants.map(t => ({ id: t._id, name: t.companyName, code: t.code })));

  process.exit(0);
}

run().catch(console.error);
