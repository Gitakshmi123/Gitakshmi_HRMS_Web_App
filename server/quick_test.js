require('dotenv').config();
const mongoose = require('mongoose');

async function test() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms');
    console.log('✓ Connected');

    console.log('Getting first tenant...');
    const Tenant = mongoose.model('Tenant');
    const tenant = await Tenant.findOne().lean();
    if (!tenant) {
      console.log('✗ No tenants found');
      process.exit(1);
    }

    console.log(`✓ Found tenant: ${tenant.name}`);
    const tenantId = tenant._id.toString();

    console.log('Initializing tenant DB...');
    const { getTenantDB } = require('./config/dbManager');
    const tenantDB = getTenantDB(tenantId);

    console.log('Getting SalaryTemplate model...');
    const SalaryTemplate = tenantDB.model('SalaryTemplate');
    
    console.log('Fetching templates...');
    const templates = await SalaryTemplate.find({ tenantId }).limit(1).lean();
    console.log(`✓ Found ${templates.length} templates`);

    if (templates.length > 0) {
      console.log(`Template: ${templates[0].templateName}`);
      console.log(`CTC: ₹${templates[0].annualCTC}`);
      console.log(`Earnings: ${templates[0].earnings ? templates[0].earnings.length : 0} components`);
    }

    console.log('\n✓ All checks passed!');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

test();
