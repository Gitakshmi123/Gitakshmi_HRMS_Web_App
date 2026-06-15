const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const companyId = '69ddfde2fadc0eb02a19dc44';
  const dbName = `company_${companyId}`;
  
  const employees = await mongoose.connection.useDb(dbName).db.collection('employees').find().project({ email: 1, firstName: 1, lastName: 1 }).toArray();
  console.log(`Employees in ${dbName}:`, employees);
  
  process.exit(0);
}

run().catch(console.error);
