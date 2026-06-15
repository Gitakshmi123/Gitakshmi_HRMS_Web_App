const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://sso:sso123@sso.ixvhkmk.mongodb.net/hrms?retryWrites=true&w=majority&appName=SSO';

async function run() {
  await mongoose.connect(MONGO_URI);
  const email = 'baldaniyanitesh2003@gmail.com';
  
  const dbs = await mongoose.connection.db.admin().listDatabases();
  const companyDbs = dbs.databases.filter(d => d.name.startsWith('company_'));
  
  for (const dbInfo of companyDbs) {
    const db = mongoose.connection.useDb(dbInfo.name).db;
    const emp = await db.collection('employees').findOne({ 
       $or: [
         { email: email },
         { email: { $regex: new RegExp(`^${email}$`, 'i') } }
       ]
    });
    if (emp) {
      console.log(`FOUND in ${dbInfo.name}:`, emp.firstName, emp.lastName, emp.email);
    }
  }
  
  process.exit(0);
}

run().catch(console.error);
