require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const getTenantDB = require('../utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const tenants = await Tenant.find({}).lean();
  
  // Find microsoft tenant
  const microsoftTenant = tenants.find(t => t.name === 'microsoft');
  if (!microsoftTenant) {
    console.error('Microsoft tenant not found');
    process.exit(1);
  }

  const tenantId = microsoftTenant._id.toString();
  const tenantDB = await getTenantDB(tenantId);
  const Attendance = tenantDB.model('Attendance');

  // Check statuses in attendance for January 2026
  const startDate = new Date(2026, 0, 1);
  const endDate = new Date(2026, 0, 31);

  const records = await Attendance.find({
    date: { $gte: startDate, $lte: endDate }
  }).select('status date -_id').lean();

  console.log('Sample attendance records in Jan 2026:');
  records.slice(0, 10).forEach(r => {
    console.log(`  ${r.date.toISOString().slice(0,10)}: "${r.status}"`);
  });

  // Count by status
  const statusCounts = {};
  records.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  console.log('\nStatus distribution:');
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  "${status}": ${count}`);
  });

  await mongoose.connection.close();
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
