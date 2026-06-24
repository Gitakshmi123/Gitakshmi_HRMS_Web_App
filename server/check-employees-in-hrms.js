const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' });

async function run() {
  const uri = process.env.MONGO_URI;
  console.log("Connecting to:", uri);
  await mongoose.connect(uri);

  const adminDb = mongoose.connection.useDb('admin');
  const dbs = await adminDb.db.admin().listDatabases();
  console.log("All databases:");
  for (const d of dbs.databases) {
    if (d.name.includes('company_') || d.name.includes('git') || d.name.includes('hrms')) {
      console.log(`- Database: ${d.name}`);
      const conn = mongoose.connection.useDb(d.name);
      try {
        const Employee = conn.collection('employees');
        const count = await Employee.countDocuments({});
        console.log(`  Employees: ${count}`);
        const sample = await Employee.find({}).limit(3).toArray();
        console.log(`  Sample:`, sample.map(s => `${s.firstName} ${s.lastName} (ID: ${s.employeeId || s.employeeCode})`));
      } catch (err) {
        console.log(`  Error: ${err.message}`);
      }
    }
  }

  await mongoose.disconnect();
}

run().catch(console.error);
