const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
require('dotenv').config();

async function run() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');

    const tenants = await Tenant.find({});
    console.log(`Found ${tenants.length} tenants`);

    // Use updateMany to bypass validation on existing docs that might be missing other required fields
    const result = await Tenant.updateMany(
      { status: 'active' },
      { 
        $set: { "enabledModules.onboarding": true },
        $addToSet: { modules: "onboarding" }
      }
    );
    
    console.log(`Updated ${result.modifiedCount} tenants.`);

    console.log('Migration complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
