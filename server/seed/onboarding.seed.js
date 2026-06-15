const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const getTenantDB = require('../utils/tenantDB');

async function run() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/hrms');

  const User = mongoose.models.User || mongoose.model('User', require('../models/User'));
  const OnboardingTemplate = mongoose.models.OnboardingTemplate || mongoose.model('OnboardingTemplate', require('../models/OnboardingTemplate'));

  let tenant = await Tenant.findOne({ code: 'DEMOHR' });
  if (!tenant) {
    const password = await bcrypt.hash('Demo@123', 10);
    tenant = await Tenant.create({
      companyName: 'Demo HR Labs',
      companyEmail: 'admin@demohr.com',
      ownerName: 'Demo Admin',
      phone: '9999999999',
      password,
      adminEmail: 'admin@demohr.com',
      tenantId: 'tenant_demohr',
      apiKey: 'key_demohr',
      code: 'DEMOHR',
      status: 'active',
      isVerified: true,
      enabledModules: {
        hr: true,
        payroll: true,
        attendance: true,
        leave: true,
        recruitment: true,
        backgroundVerification: true,
        documentManagement: true,
        socialMediaIntegration: false,
        employeePortal: true,
        reports: true,
      },
    });
  }

  let hrUser = await User.findOne({ tenant: tenant._id, email: 'hr@demohr.com' });
  if (!hrUser) {
    hrUser = await User.create({
      name: 'Demo HR',
      email: 'hr@demohr.com',
      password: await bcrypt.hash('Demo@123', 10),
      role: 'hr',
      tenant: tenant._id,
    });
  }

  const tenantDB = await getTenantDB(tenant._id.toString());
  const Employee = tenantDB.model('Employee');
  let employee = await Employee.findOne({ tenant: tenant._id, email: 'employee@demohr.com' });
  if (!employee) {
    employee = await Employee.create({
      tenant: tenant._id,
      firstName: 'Anaya',
      lastName: 'Patel',
      employeeId: 'EMP001',
      email: 'employee@demohr.com',
      password: await bcrypt.hash('Demo@123', 10),
      role: 'employee',
      designation: 'Software Engineer',
      department: 'Engineering',
      joiningDate: new Date(),
    });
  }

  const exists = await OnboardingTemplate.findOne({ tenant: tenant._id, code: 'ENG-ONB' });
  if (!exists) {
    await OnboardingTemplate.create({
      tenant: tenant._id,
      name: 'Engineering New Hire Journey',
      code: 'ENG-ONB',
      description: 'Standard multi-role onboarding for engineering hires.',
      targetRoles: ['employee'],
      createdBy: hrUser._id,
      steps: [
        { title: 'Accept offer', description: 'Employee confirms the offer.', type: 'offer', order: 1, assignedRole: 'employee', dueInDays: 0, slaHours: 8 },
        { title: 'Upload KYC documents', description: 'Upload PAN and Aadhaar.', type: 'document', order: 2, assignedRole: 'employee', dueInDays: 1, slaHours: 24, requiresDocument: true, documentType: 'KYC' },
        { title: 'Verify documents', description: 'HR validates the documents.', type: 'approval', order: 3, assignedRole: 'hr', dueInDays: 2, slaHours: 12 },
        { title: 'Provision laptop and email', description: 'IT completes setup.', type: 'setup', order: 4, assignedRole: 'it', dueInDays: 3, slaHours: 24 },
        { title: 'Manager orientation', description: 'Manager shares team plan.', type: 'orientation', order: 5, assignedRole: 'manager', dueInDays: 4, slaHours: 24 },
      ],
    });
  }

  console.log('Onboarding seed complete');
  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
