const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB (gitakshmi-one)');

  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');
  const tenants = await Tenant.find({ status: 'active' }).lean();
  console.log('Active Tenants:', tenants.map(t => ({ code: t.code, id: t._id })));

  await mongoose.disconnect();
}

check();
