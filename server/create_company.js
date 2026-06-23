const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Tenant = require('./models/Tenant');
require('dotenv').config({ path: './.env' });

async function createCompany() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms');
    
    const companyEmail = 'gitakshmi@gmail.com';
    
    // Check if exists
    const existing = await Tenant.findOne({ companyEmail });
    if (existing) {
        console.log('Company already exists! Deleting or updating is required if you want a fresh one, but we will just update the password.');
        existing.password = await bcrypt.hash('123456789', 10);
        await existing.save();
        console.log('Password updated for existing company.');
        process.exit(0);
    }

    const passwordHash = await bcrypt.hash('123456789', 10);
    const tenantId = 'GT_' + crypto.randomBytes(4).toString('hex').toUpperCase();
    const apiKey = crypto.randomBytes(24).toString('hex');
    const code = 'GT_' + crypto.randomBytes(2).toString('hex').toUpperCase();

    const newTenant = await Tenant.create({
        companyName: 'gitakshmi technologies private limited',
        companyEmail: companyEmail,
        ownerName: 'Admin',
        password: passwordHash,
        adminEmail: companyEmail,
        adminName: 'Admin',
        tenantId: tenantId,
        apiKey: apiKey,
        code: code,
        status: 'active',
        enabledModules: {
            hr: true,
            payroll: true,
            attendance: true,
            leave: true,
            recruitment: true,
            backgroundVerification: true,
            documentManagement: true,
            socialMediaIntegration: true,
            onboarding: true,
            employeePortal: true,
            reports: true,
            policy: true,
            customStudio: true,
            accessControl: true
        },
    });

    console.log('Successfully created company:', newTenant.companyName);
    process.exit(0);
  } catch (err) {
    console.error('Error creating company:', err);
    process.exit(1);
  }
}

createCompany();
