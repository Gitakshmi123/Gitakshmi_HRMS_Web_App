const mongoose = require('mongoose');

async function check() {
  const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69d626068560596a949a0010?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(uri);
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections:', collections.map(c => c.name));
  process.exit(0);
}

check();
