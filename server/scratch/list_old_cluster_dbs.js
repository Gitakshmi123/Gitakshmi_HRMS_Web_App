const mongoose = require('mongoose');
const dns = require('dns');

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

const OLD_CLUSTER_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/admin?retryWrites=true&w=majority&appName=Cluster0';

async function listDbs() {
  console.log('Connecting to OLD cluster...');
  await mongoose.connect(OLD_CLUSTER_URI);
  console.log('Connected!');
  
  const admin = mongoose.connection.useDb('admin').db.admin();
  const dbs = await admin.listDatabases();
  console.log('--- DATABASES ON OLD CLUSTER ---');
  dbs.databases.forEach(db => {
    console.log(`- ${db.name}`);
  });
  
  process.exit(0);
}

listDbs().catch(err => {
  console.error('Failed to connect to old cluster:', err);
  process.exit(1);
});
