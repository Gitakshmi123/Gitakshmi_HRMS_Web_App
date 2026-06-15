require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function fixTenantCredentials() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Fix the goo001 tenant
    const result = await Tenant.updateOne(
      { code: 'goo001' },
      {
        $set: {
          'meta.email': 'google@gmail.com',
          'meta.adminPassword': 'google1123',
          modules: ['hr', 'payroll', 'ess'],
        },
      }
    );

    console.log('✓ Updated tenant credentials:');
    console.log('  - Email: google@gmail.com (removed trailing space)');
    console.log('  - Password: google1123 (keeping original)');
    console.log('  - Modules: hr, payroll, ess');
    console.log('\nMatched:', result.matchedCount, 'document(s)');
    console.log('Modified:', result.modifiedCount, 'document(s)');

    // Verify the update
    const tenant = await Tenant.findOne({ code: 'goo001' });
    console.log('\n✓ Verified update:');
    console.log('  Email:', tenant.meta.email);
    console.log('  Password:', tenant.meta.adminPassword);
    console.log('  Modules:', tenant.modules);

    console.log('\n✓ You can now login with:');
    console.log('  - Company Code: goo001');
    console.log('  - Email: google@gmail.com');
    console.log('  - Password: google1123');

    await mongoose.connection.close();
    console.log('\n✓ Done!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

fixTenantCredentials();
