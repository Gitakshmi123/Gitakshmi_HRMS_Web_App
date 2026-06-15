require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function updatePassword() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    const result = await Tenant.updateOne(
      { code: 'gita001' },
      { $set: { 'meta.adminPassword': 'admin123' } }
    );

    console.log('✓ Password updated');
    console.log('Matched:', result.matchedCount);
    console.log('Modified:', result.modifiedCount);

    const tenant = await Tenant.findOne({ code: 'gita001' });
    console.log('\n✓ Login credentials:');
    console.log('  Company Code: gita001');
    console.log('  Email:', tenant.meta.email);
    console.log('  Password: admin123');

    await mongoose.connection.close();
    console.log('\n✓ Done!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

updatePassword();

