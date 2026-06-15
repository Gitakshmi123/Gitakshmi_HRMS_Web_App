const mongoose = require('mongoose');
const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
  const tenants = await Tenant.find({}).lean();
  console.log('--- TENANTS ---');
  tenants.forEach(t => {
      console.log(`ID: ${t._id}, Code: ${t.code}, Status: ${t.status}, Modules: ${t.modules?.join(', ')}`);
  });

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const niteshUser = await User.findOne({ email: /nitesh/i }).lean();
  console.log('\n--- NITESH USER ---');
  console.log(niteshUser);

  if (niteshUser && niteshUser.tenant) {
      const tenantId = niteshUser.tenant;
      const dbName = `company_${tenantId}`;
      console.log(`\n--- NITESH EMPLOYEE IN ${dbName} ---`);
      const Employee = mongoose.connection.useDb(dbName).model('Employee', new mongoose.Schema({}, { strict: false }));
      const niteshEmp = await Employee.findOne({ email: /nitesh/i }).lean();
      console.log(niteshEmp);
  }

  process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
