const mongoose = require('mongoose');

async function check() {
  const MONGO_URI = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/hrms?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const admin = mongoose.connection.db.admin();
  const dbs = await admin.listDatabases();
  const dbNames = dbs.databases.map(d => d.name);

  const email = 'baldaniyanitesh2003@gmail.com';
  
  for (const dbName of dbNames) {
    if (dbName === 'admin' || dbName === 'local') continue;
    try {
      const db = mongoose.connection.useDb(dbName);
      const collections = await db.db.listCollections().toArray();
      const colNames = collections.map(c => c.name);
      
      if (colNames.includes('employees')) {
        const emp = await db.db.collection('employees').findOne({ email: new RegExp(`^${email}$`, 'i') });
        if (emp) console.log(`Found Employee in ${dbName}:`, emp.employeeId);
      }
      
      if (colNames.includes('users')) {
        const user = await db.db.collection('users').findOne({ email: new RegExp(`^${email}$`, 'i') });
        if (user) console.log(`Found User in ${dbName}:`, user.role);
      }
    } catch (e) {}
  }

  await mongoose.disconnect();
}

check();
