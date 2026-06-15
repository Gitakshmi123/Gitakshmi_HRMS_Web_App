const mongoose = require('mongoose');

async function fix() {
  const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(uri);
  const User = mongoose.connection.collection('users');
  
  // Update the user role to company_admin so they can access the management dashboard
  await User.updateOne(
      { _id: new mongoose.Types.ObjectId('69d626068560596a949a0011') },
      { $set: { role: 'company_admin' } }
  );
  
  console.log('Fixed User Role to company_admin');
  process.exit(0);
}

fix();
