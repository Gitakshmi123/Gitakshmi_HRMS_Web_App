const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  
  const dbs = await mongoose.connection.db.admin().listDatabases();
  const pmsDbs = dbs.databases.filter(d => d.name.toUpperCase().includes('GT_PMS'));
  console.log('PMS Databases:', pmsDbs.map(d => d.name));
  
  for (const dbInfo of pmsDbs) {
     const db = mongoose.connection.useDb(dbInfo.name).db;
     const projects = await db.collection('projects').find().toArray();
     if (projects.length > 0) {
        console.log(`Projects in ${dbInfo.name}:`, projects.map(p => p.name));
     }
  }

  process.exit(0);
}

run().catch(console.error);
