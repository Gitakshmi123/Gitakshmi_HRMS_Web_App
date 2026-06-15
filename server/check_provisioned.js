const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const dbName = 'GT_PMS_nitesh_legacy_442c114befbe';
  const db = mongoose.connection.useDb(dbName).db;
  
  const user = await db.collection('users').findOne({ email: 'baldaniyanitesh2003@gmail.com' });
  console.log('User found:', user);

  if (user) {
     const memberships = await db.collection('memberships').find({ userId: user._id }).toArray();
     console.log('Memberships found:', memberships);
  }

  process.exit(0);
}

run().catch(console.error);
