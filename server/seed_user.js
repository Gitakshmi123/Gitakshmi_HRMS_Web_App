const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const uri = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(uri)
  .then(async () => {
    const db = mongoose.connection.useDb('gitakshmi-one');
    const tenantId = new mongoose.Types.ObjectId();
    
    // Create an active tenant
    await db.collection('tenants').insertOne({
      _id: tenantId, 
      name: 'Gitakshmi', 
      code: 'GIT001', 
      companyName: 'Gitakshmi', 
      status: 'active', 
      createdAt: new Date()
    });
    
    // Hash password and recreate/update the gitakshmi@gmail.com user
    const hash = await bcrypt.hash('123456789', 10);
    await db.collection('users').updateOne(
      { email: 'gitakshmi@gmail.com' }, 
      { $set: { password: hash, role: 'hr', tenant: tenantId, mainCompanyId: tenantId, isActive: true } }, 
      { upsert: true }
    );
    
    console.log('Successfully seeded tenant and user!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
