const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections in hrms:', collections.map(c => c.name));

  process.exit(0);
}

run().catch(console.error);
