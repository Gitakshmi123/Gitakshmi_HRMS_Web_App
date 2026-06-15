const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  
  const lookup = await mongoose.connection.db.collection('authlookups').findOne({ email: 'nitesh@gmail.com' });
  console.log('AuthLookup for nitesh@gmail.com:', lookup);

  const lookup2 = await mongoose.connection.db.collection('authlookups').findOne({ email: 'baldaniyanitesh2003@gmail.com' });
  console.log('AuthLookup for baldaniyanitesh2003@gmail.com:', lookup2);

  process.exit(0);
}

run().catch(console.error);
