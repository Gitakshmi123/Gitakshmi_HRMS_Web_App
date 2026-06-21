const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function debugLogin() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  
  const email = 'baldaniyanitesh2003@gmail.com';
  const password = 'balnit@2004';
  
  const users = await db.collection('users').find({ email }).toArray();
  console.log('User found:', users.length);
  const portalUser = users[0];
  
  if (!portalUser) return console.log('No portal user');
  
  console.log('portalUser.password exists?', !!portalUser.password);
  const match = await bcrypt.compare(password, portalUser.password);
  console.log('bcrypt compare portalUser.password:', match);
  
  // Now check employee collection!
  const tenants = await db.collection('tenants').find({}).toArray();
  for (let t of tenants) {
    const tdb = mongoose.connection.client.db('company_' + t._id.toString());
    const emps = await tdb.collection('employees').find({ email }).toArray();
    if (emps.length > 0) {
      console.log(`Employee found in tenant ${t.companyName}`);
      const emp = emps[0];
      if (emp.password) {
        console.log('emp.password exists!', !!emp.password);
        const empMatch = await bcrypt.compare(password, emp.password);
        console.log('bcrypt compare emp.password:', empMatch);
      } else {
        console.log('emp.password is missing or null');
      }
    }
  }
  process.exit(0);
}
debugLogin();
