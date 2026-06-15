const mongoose = require('mongoose');

async function check() {
  const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69d626068560596a949a0010?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(uri);
  const LeavePolicy = mongoose.connection.collection('leavepolicies');
  const policies = await LeavePolicy.find({}).toArray();
  console.log('Policies found:', JSON.stringify(policies, null, 2));
  process.exit(0);
}

check();
