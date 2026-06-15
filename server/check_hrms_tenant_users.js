const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const companyId = '69ddd0f7800b442c114befbe';
  const db = mongoose.connection.useDb(`company_${companyId}`).db;
  
  const users = await db.collection('users').find().toArray();
  console.log('HRMS Tenant Users:', users.map(u => ({ email: u.email, role: u.role })));

  process.exit(0);
}

run().catch(console.error);
