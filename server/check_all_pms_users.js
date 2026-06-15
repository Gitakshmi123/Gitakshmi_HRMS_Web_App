const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const dbName = 'GT_PMS_nitesh_legacy_442c114befbe';
  const db = mongoose.connection.useDb(dbName).db;
  
  const users = await db.collection('users').find().toArray();
  console.log('All users in DB:', users.map(u => ({ email: u.email, id: u._id, role: u.role })));

  process.exit(0);
}

run().catch(console.error);
