const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const dbName = 'GT_PMS_nitesh_legacy_442c114befbe';
  const db = mongoose.connection.useDb(dbName).db;
  
  const users = await db.collection('users').find().toArray();
  console.log('Users:', users.map(u => ({ email: u.email, role: u.role, id: u._id })));

  const memberships = await db.collection('memberships').find().toArray();
  console.log('Memberships:', memberships.map(m => ({ userId: m.userId, workspaceId: m.workspaceId })));

  const workspaces = await db.collection('workspaces').find().toArray();
  console.log('Workspaces:', workspaces.map(w => ({ name: w.name, id: w._id })));

  process.exit(0);
}

run().catch(console.error);
