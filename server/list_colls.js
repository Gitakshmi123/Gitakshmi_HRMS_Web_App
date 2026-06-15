const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const companyId = '69d532bf973fa61b3a27b80a';
  const db = mongoose.connection.useDb(`company_${companyId}`).db;
  const collections = await db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));
  
  process.exit(0);
}

run().catch(console.error);
