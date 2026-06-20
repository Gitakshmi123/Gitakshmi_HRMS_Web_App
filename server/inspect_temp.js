const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
  await mongoose.connect(MONGO_URI);
  const dbName = 'company_gitakshmi_te_git002_f5c2a410';
  const tenantDb = mongoose.connection.useDb(dbName);
  
  const policies = await tenantDb.collection('leavepolicies').find({}).toArray();
  console.log('All Leave Policies in', dbName);
  for (const policy of policies) {
    console.log(`\nPolicy: ${policy.name} (${policy._id})`);
    console.log('Rules:', JSON.stringify(policy.rules, null, 2));
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
