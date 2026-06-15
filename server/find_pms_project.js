const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  
  const projects = await mongoose.connection.db.collection('projects').find({ name: /PMS/i }).toArray();
  console.log('PMS Projects found:', projects.map(p => ({ name: p.name, id: p._id, workspaceId: p.workspaceId, tenantId: p.tenantId })));

  for (const p of projects) {
     const company = await mongoose.connection.db.collection('companies').findOne({ _id: p.tenantId });
     console.log(`Project "${p.name}" belongs to company:`, company?.name, company?.organizationId);
  }

  process.exit(0);
}

run().catch(console.error);
