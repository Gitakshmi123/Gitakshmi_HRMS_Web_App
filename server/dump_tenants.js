const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  
  const dbs = await mongoose.connection.db.admin().listDatabases();
  console.log('Databases:', dbs.databases.map(d => d.name));
  
  const tenants = await mongoose.connection.db.collection('tenants').find().limit(20).toArray();
  console.log('Central Database Tenants:', tenants.map(t => ({ id: t._id, name: t.companyName || t.name, code: t.code })));

  process.exit(0);
}

run().catch(console.error);
