const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const dbName = 'GT_PMS_nitesh_legacy_442c114befbe';
  const db = mongoose.connection.useDb(dbName).db;
  
  const projects = await db.collection('projects').find().toArray();
  console.log('Projects:', projects.map(p => ({ name: p.name, workspaceId: p.workspaceId })));

  const workspaces = await db.collection('workspaces').find().toArray();
  console.log('Workspaces:', workspaces.map(w => ({ name: w.name, id: w._id })));

  process.exit(0);
}

run().catch(console.error);
