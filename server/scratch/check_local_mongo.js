const mongoose = require('mongoose');

async function run() {
  try {
      await mongoose.connect('mongodb://127.0.0.1:27017/gitakshmi-one');
      console.log('Connected to LOCAL MongoDB');
      const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
      const tenants = await Tenant.find({}).lean();
      console.log('Tenants:', tenants.map(t => ({ id: t._id, code: t.code, status: t.status })));
  } catch (err) {
      console.error('Local MongoDB connection failed:', err.message);
  }
  process.exit(0);
}

run();
