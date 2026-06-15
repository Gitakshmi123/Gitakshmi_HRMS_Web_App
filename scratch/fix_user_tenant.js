const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');

async function fix() {
  if (fs.existsSync('.env')) dotenv.config({ path: '.env' });
  else if (fs.existsSync('server/.env')) dotenv.config({ path: 'server/.env' });

  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI not found');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');

  const email = 'baldaniyanitesh2003@gmail.com';
  const tenantCode = 'GIT001';

  const tenant = await Tenant.findOne({ code: tenantCode }).lean();
  if (!tenant) {
    console.error('Tenant GIT001 not found');
    process.exit(1);
  }

  const result = await User.updateMany(
    { email: new RegExp(`^${email}$`, 'i') },
    { 
      $set: { 
        tenant: tenant._id,
        role: 'company_admin'
      } 
    }
  );

  console.log('Update result:', result);

  await mongoose.disconnect();
}

fix();
