const mongoose = require('mongoose');
const { unifiedLogin } = require('./controllers/auth.controller');
const dotenv = require('dotenv');
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/gt_hrms_main');
  mongoose.model('User', require('./models/User')); // Register User model
  
  // Tenant is already registered in its own file
  require('./models/Tenant');
  
  const req = { body: { identifier: 'superadmin@hrms.com', password: 'password123' }, get: () => 'test-agent' };
  const res = {
    status: (code) => { console.log('Status:', code); return res; },
    json: (data) => { console.log('JSON:', data); return res; }
  };
  
  try {
    await unifiedLogin(req, res);
  } catch(e) {
    console.error('Exception caught:', e);
  }
  process.exit(0);
}
test();
