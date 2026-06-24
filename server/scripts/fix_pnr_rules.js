/**
 * fix_pnr_rules.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URL;

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB');

  const dbName = 'company_pnr';
  const tenantDB = mongoose.connection.useDb(dbName, { useCache: true });

  const LeavePolicySchema = require('../models/LeavePolicy');
  const LeavePolicy = tenantDB.models.LeavePolicy || tenantDB.model('LeavePolicy', LeavePolicySchema.schema || LeavePolicySchema);

  // Add default rules to the template and the assignment
  const defaultRules = [
    { leaveType: 'EL', totalPerYear: 21, color: '#3b82f6', isPaid: true },
    { leaveType: 'CL', totalPerYear: 7, color: '#10b981', isPaid: true },
    { leaveType: 'SL', totalPerYear: 7, color: '#f59e0b', isPaid: true }
  ];

  await LeavePolicy.updateMany({}, { 
    $set: { 
        rules: defaultRules,
        leaveTypes: ['EL', 'CL', 'SL']
    } 
  });
  console.log('Updated policies in PNR with default rules.');

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
