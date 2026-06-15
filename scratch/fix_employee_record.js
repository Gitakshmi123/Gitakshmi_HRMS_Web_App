const mongoose = require('mongoose');

async function fix() {
  const MONGO_URI = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB (gitakshmi-one)');

  const targetDbName = 'company_69e7cc21e1bb34e2e53190d8';
  const targetDb = mongoose.connection.useDb(targetDbName);
  
  const email = 'n84258106@gmail.com';
  const existing = await targetDb.db.collection('employees').findOne({ email: new RegExp(`^${email}$`, 'i') });
  
  if (!existing) {
    await targetDb.db.collection('employees').insertOne({
      firstName: 'Nitesh',
      lastName: 'Baldaniya',
      email: email,
      employeeId: 'EMP-GIT-001',
      status: 'Active',
      employmentStatus: 'Active',
      isActive: true,
      role: 'employee',
      tenant: new mongoose.Types.ObjectId('69e7cc21e1bb34e2e53190d8'),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    console.log(`Created employee record for ${email} in ${targetDbName}`);
  } else {
    console.log(`Employee record for ${email} already exists in ${targetDbName}`);
  }

  await mongoose.disconnect();
}

fix();
