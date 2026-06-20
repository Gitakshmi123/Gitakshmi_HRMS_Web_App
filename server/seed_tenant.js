const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const uri = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(uri)
  .then(async () => {
    const db = mongoose.connection.useDb('gitakshmi-one');
    
    const user = await db.collection('users').findOne({ email: 'gitakshmi@gmail.com' });
    if (!user) {
      console.log('User not found');
      process.exit(1);
    }
    const tenantIdObj = user.mainCompanyId;
    
    const hash = await bcrypt.hash('123456789', 10);
    
    // Create an active tenant in 'companies' collection!
    await db.collection('companies').updateOne(
      { _id: tenantIdObj },
      { $set: {
        companyName: 'Gitakshmi', 
        name: 'Gitakshmi',
        companyEmail: 'gitakshmi@gmail.com',
        ownerName: 'Gitakshmi Owner',
        password: hash,
        tenantId: tenantIdObj.toString(),
        apiKey: 'api_' + tenantIdObj.toString(),
        code: 'GIT001', 
        status: 'active', 
        createdAt: new Date(),
        enabledModules: { hr: true, attendance: true, employeePortal: true }
      }},
      { upsert: true }
    );
    
    console.log('Successfully seeded tenant into companies collection!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
