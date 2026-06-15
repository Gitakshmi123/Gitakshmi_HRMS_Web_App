const mongoose = require('mongoose');

async function check() {
  const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(uri);
  const LeavePolicy = mongoose.connection.collection('leavepolicies');
  const count = await LeavePolicy.countDocuments({ tenant: new mongoose.Types.ObjectId('69d626068560596a949a0010') });
  const all = await LeavePolicy.find({ tenant: new mongoose.Types.ObjectId('69d626068560596a949a0010') }).toArray();
  console.log('Count:', count);
  console.log('Policies IDs and Names:', all.map(p => ({ id: p._id, name: p.name })));
  process.exit(0);
}

check();
