
const mongoose = require('mongoose');
require('dotenv').config();
const mongoUri = process.env.MONGO_URI;

async function checkDb() {
  try {
    console.log(`Connecting to Atlas URI: ${mongoUri.replace(/:([^@]+)@/, ':****@')}...`);
    await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000
    });
    console.log('Connected.');
    process.exit(0);
  } catch (err) {
    console.error('Atlas Check failed:', err.message);
    if (err.reason) console.error('Reason:', JSON.stringify(err.reason, null, 2));
    process.exit(1);
  }
}

checkDb();
