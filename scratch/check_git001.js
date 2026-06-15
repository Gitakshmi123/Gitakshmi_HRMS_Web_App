const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');
  const git001 = await Tenant.findOne({ code: 'GIT001' }).lean();
  console.log('GIT001 Tenant:', git001);

  await mongoose.disconnect();
}

check();
