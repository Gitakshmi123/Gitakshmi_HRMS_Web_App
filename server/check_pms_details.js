const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const dbName = 'GT_PMS_nitesh_legacy_442c114befbe';
  const db = mongoose.connection.useDb(dbName).db;
  
  const projects = await db.collection('projects').find({ name: 'PMS' }).toArray();
  if (projects.length > 0) {
     const p = projects[0];
     console.log('Project PMS details:', {
        id: p._id,
        ownerId: p.ownerId,
        members: p.members,
        workspaceId: p.workspaceId,
        tenantId: p.tenantId
     });
  }

  process.exit(0);
}

run().catch(console.error);
