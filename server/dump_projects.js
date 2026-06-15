const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  
  const projects = await mongoose.connection.db.collection('projects').find().limit(20).toArray();
  console.log('Sample Projects:', projects.map(p => ({ name: p.name, id: p._id, tenantId: p.tenantId })));

  process.exit(0);
}

run().catch(console.error);
