const mongoose = require('mongoose');

async function fix() {
  const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(uri);
  const User = mongoose.connection.collection('users');
  
  // Update permVersion to trigger a frontend refresh of permissions
  const newVersion = Date.now();
  await User.updateOne(
      { _id: new mongoose.Types.ObjectId('69d626068560596a949a0011') },
      { $set: { permVersion: newVersion, permissions: [] } }
  );
  
  console.log(`Updated permVersion to ${newVersion} for test@test.com`);
  process.exit(0);
}

fix();
