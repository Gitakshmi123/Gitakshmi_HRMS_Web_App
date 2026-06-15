
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Try finding .env manually to be safe
let envPath = path.resolve(__dirname, 'server/.env');
if (!fs.existsSync(envPath)) {
  envPath = path.resolve(__dirname, '.env');
}

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) process.env[key.trim()] = value.trim();
  });
}

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/gt_hrms';

async function checkDb() {
  try {
    console.log('Connecting to:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected to DB');
    
    // Define minimal schema
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
    
    const count = await Tenant.countDocuments({ status: { $ne: 'deleted' } });
    const all = await Tenant.find({ status: { $ne: 'deleted' } }).select('companyName name parentCompanyId status');
    
    console.log(`Total non-deleted tenants: ${count}`);
    all.forEach(t => {
      console.log(`- ID: ${t._id}, Name: ${t.companyName || t.name}, ParentID: ${t.parentCompanyId}, Status: ${t.status}`);
    });
    
    process.exit(0);
  } catch (err) {
    console.error('DB Check failed:', err.message);
    process.exit(1);
  }
}

checkDb();
