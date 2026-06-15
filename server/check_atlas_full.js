
const mongoose = require('mongoose');
const mongoUri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrmsmain?retryWrites=true&w=majority&appName=Cluster0';

async function checkDb() {
  try {
    await mongoose.connect(mongoUri);
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
    const t = await Tenant.findOne({ status: { $ne: 'deleted' } }).lean();
    console.log('FULL_TENANT:' + JSON.stringify(t));
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
}
checkDb();
