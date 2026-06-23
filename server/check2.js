const mongoose = require('mongoose');
const Tenant = require('./models/Tenant');
require('dotenv').config({ path: './.env' });

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
  
  // same query as getParentCompanies
  const query = {
    parentCompanyId: null,
    status: { $ne: 'deleted' }
  };
  const parents = await Tenant.find(query).sort({ createdAt: -1 }).lean();
  console.log("Total parents found: ", parents.length);
  
  const gitakshmi = parents.find(p => p.companyEmail === 'gitakshmi@gmail.com');
  if (gitakshmi) {
      console.log("Gitakshmi is in the results.");
  } else {
      console.log("Gitakshmi NOT FOUND in the results!");
  }
  process.exit(0);
}
check();
