const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB (hrmsmain)');

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections in hrmsmain:', collections.map(c => c.name));

  if (collections.some(c => c.name === 'companies')) {
    const companies = await mongoose.connection.db.collection('companies').find({}).toArray();
    console.log('Companies in hrmsmain:', companies.map(c => ({ code: c.code, id: c._id })));
  }

  await mongoose.disconnect();
}

check();
