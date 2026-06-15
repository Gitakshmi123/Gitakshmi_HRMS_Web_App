const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.useDb('company_69ddd0f7800b442c114befbe').db;
  const emp = await db.collection('employees').findOne({ email: 'baldaniyanitesh2003@gmail.com' });
  console.log('EmployeeId in HRMS:', emp?.employeeId);

  process.exit(0);
}

run().catch(console.error);
