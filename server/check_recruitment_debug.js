
const mongoose = require('mongoose');
require('dotenv').config();

async function checkRecruitment() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const Tenant = require('./models/Tenant');
    const tenants = await Tenant.find({}).lean();
    tenants.forEach(t => {
      console.log(`Tenant: ${t.companyName} (${t.code})`);
      console.log(`- recruitment enabled: ${t.enabledModules?.recruitment}`);
      console.log(`- hr enabled: ${t.enabledModules?.hr}`);
      console.log(`- attendance enabled: ${t.enabledModules?.attendance}`);
      console.log(`- backgroundVerification enabled: ${t.enabledModules?.backgroundVerification}`);
    });
    process.exit(0);
  } catch (err) { console.error(err); process.exit(1); }
}
checkRecruitment();
