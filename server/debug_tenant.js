const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const Tenant = require('./models/Tenant');
  const t = await Tenant.findOne({ code: 'git001' }).lean();
  
  if (!t) { console.log('TENANT NOT FOUND'); process.exit(); }
  
  console.log('=== TENANT git001 ===');
  console.log('adminEmail:', t.adminEmail);
  console.log('email:', t.email);
  console.log('ownerEmail:', t.ownerEmail);
  console.log('status:', t.status);
  console.log('meta:', JSON.stringify(t.meta || {}));

  const UserSchema = new mongoose.Schema({}, { strict: false });
  const User = mongoose.models.User || mongoose.model('User', UserSchema);
  
  const users = await User.find({ tenant: t._id }).select('email role name').lean();
  console.log('\n=== USERS in tenant ===');
  console.log('Total:', users.length);
  users.forEach(u => console.log('  -', u.email, '| role:', u.role, '| name:', u.name));
  
  // Check specifically for git@gmail.com
  const specificUser = await User.findOne({ email: 'git@gmail.com', tenant: t._id }).lean();
  console.log('\n=== git@gmail.com user ===');
  if (specificUser) {
    console.log('Found! role:', specificUser.role);
  } else {
    console.log('NOT FOUND in User collection');
    console.log('=> Login will use meta/tenant password fallback');
    console.log('=> Tenant adminEmail matches git@gmail.com?', t.adminEmail === 'git@gmail.com');
  }
  
  process.exit(0);
}).catch(e => { console.error('Error:', e.message); process.exit(1); });
