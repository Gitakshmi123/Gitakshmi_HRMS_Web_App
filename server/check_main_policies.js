const mongoose = require('mongoose');

async function check() {
  const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(uri);
  const LeavePolicy = mongoose.connection.collection('leavepolicies');
  const policies = await LeavePolicy.find({}).toArray();
  console.log('Policies found in MAIN DB:', JSON.stringify(policies, null, 2));
  process.exit(0);
}

check();
