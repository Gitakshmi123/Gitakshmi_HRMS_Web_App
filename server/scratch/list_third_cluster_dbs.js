const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const THIRD_CLUSTER_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0';

async function listDbs() {
  console.log('Connecting to THIRD cluster (nitesh)...');
  await mongoose.connect(THIRD_CLUSTER_URI);
  console.log('Connected!');
  
  const admin = mongoose.connection.useDb('admin').db.admin();
  const dbs = await admin.listDatabases();
  console.log('--- DATABASES ON THIRD CLUSTER ---');
  dbs.databases.forEach(db => {
    console.log(`- ${db.name}`);
  });
  
  process.exit(0);
}

listDbs().catch(err => {
  console.error('Failed to connect to third cluster:', err);
  process.exit(1);
});
