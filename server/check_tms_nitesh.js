const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const companyId = '69ddd0f7800b442c114befbe';
  
  const workspaces = await mongoose.connection.db.collection('workspaces').find({ tenantId: new mongoose.Types.ObjectId(companyId) }).toArray();
  console.log('Workspaces:', workspaces.map(w => ({ name: w.name, id: w._id })));

  if (workspaces.length > 0) {
     const wsId = workspaces[0]._id;
     const projects = await mongoose.connection.db.collection('projects').find({ workspaceId: wsId }).toArray();
     console.log('Projects in first workspace:', projects.map(p => ({ name: p.name, id: p._id })));
  }

  process.exit(0);
}

run().catch(console.error);
