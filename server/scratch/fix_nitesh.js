const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function fixNitesh() {
  try {
    console.log('Connecting...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected.');

    const User = mongoose.model('User', require('../models/User'));
    
    // Find Nitesh
    const nitesh = await User.findOne({ email: 'nitesh@gmail.com' });
    if (!nitesh) {
      console.log('Nitesh not found!');
      return;
    }

    console.log('Current mainCompanyId:', nitesh.mainCompanyId);
    
    // Update to the correct ID from logs (6a01ac0817242e3c174ad6f2)
    const correctTenantId = '6a01ac0817242e3c174ad6f2';
    const res = await User.updateOne(
      { email: 'nitesh@gmail.com' },
      { $set: { mainCompanyId: new mongoose.Types.ObjectId(correctTenantId) } }
    );
    
    console.log('Update Result:', res);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

fixNitesh();
