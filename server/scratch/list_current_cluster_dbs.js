const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const CURRENT_CLUSTER_URI = 'mongodb+srv://ivaharpal_db_user:ivah1801%40%23@cluster0.ikbybhd.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0';

async function listDbs() {
  console.log('Connecting to CURRENT cluster (ikbybhd)...');
  await mongoose.connect(CURRENT_CLUSTER_URI);
  console.log('Connected!');
  
  const admin = mongoose.connection.useDb('admin').db.admin();
  const dbs = await admin.listDatabases();
  console.log('--- DATABASES ON CURRENT CLUSTER ---');
  dbs.databases.forEach(db => {
    console.log(`- ${db.name}`);
  });
  
  process.exit(0);
}

listDbs().catch(err => {
  console.error('Failed to connect to current cluster:', err);
  process.exit(1);
});
