const mongoose = require('mongoose');
const Tenant = require('./models/Tenant');
const { createCompany } = require('./controllers/tenant.controller');
require('dotenv').config({ path: './.env' });

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');

  const User = mongoose.model('User', require('./models/User'));

  // Delete the incomplete one
  const email = 'gitakshmi@gmail.com';
  await Tenant.deleteMany({ companyEmail: email });
  await User.deleteMany({ email: email });

  console.log("Deleted old incomplete records.");

  // Now create properly via controller
  const req = {
    body: {
      companyName: 'gitakshmi technologies private limited',
      companyEmail: email,
      adminEmail: email,
      ownerName: 'Admin',
      adminName: 'Admin',
      password: '123456789',
      enabledModules: {
        hr: true, payroll: true, attendance: true, leave: true, recruitment: true,
        backgroundVerification: true, documentManagement: true, socialMediaIntegration: true,
        onboarding: true, employeePortal: true, reports: true, policy: true,
        customStudio: true, accessControl: true
      }
    },
    user: { email: 'superadmin@system.local' }
  };

  const res = {
    status: function(code) {
      console.log("Status:", code);
      return this;
    },
    json: function(data) {
      console.log("Response:", JSON.stringify(data, null, 2));
      process.exit(data.success ? 0 : 1);
    }
  };

  try {
    await createCompany(req, res);
  } catch(e) {
    console.error("Error calling createCompany:", e);
    process.exit(1);
  }
}
fix();
