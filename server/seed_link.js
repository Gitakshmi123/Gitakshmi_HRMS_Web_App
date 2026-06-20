const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const uri = 'mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0';

mongoose.connect(uri)
  .then(async () => {
    const db = mongoose.connection.useDb('gitakshmi-one');
    
    // Find the existing company
    const company = await db.collection('companies').findOne({ companyEmail: 'gitakshmi@gmail.com' });
    if (!company) {
      console.log('Company not found');
      process.exit(1);
    }
    
    // Update company status to active to ensure login succeeds
    await db.collection('companies').updateOne(
      { _id: company._id },
      { $set: { status: 'active', code: 'GIT001' } }
    );
    
    // Create/update user to link to this existing company
    const hash = await bcrypt.hash('123456789', 10);
    await db.collection('users').updateOne(
      { email: 'gitakshmi@gmail.com' },
      { $set: { 
        password: hash, 
        role: 'hr', 
        tenant: company._id, 
        mainCompanyId: company._id, 
        isActive: true 
      }},
      { upsert: true }
    );
    
    console.log('Successfully linked user to existing company and updated password!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
