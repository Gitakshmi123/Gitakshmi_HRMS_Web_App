const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');
  const tenant = await Tenant.findById('69e5f99adf4500b49490248e').lean();
  console.log('Tenant for ID 69e5f99adf4500b49490248e:', tenant ? tenant.code : 'None');

  await mongoose.disconnect();
}

check();
