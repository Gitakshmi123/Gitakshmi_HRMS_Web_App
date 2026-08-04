const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const Tenant = require('../models/Tenant');
const getTenantDB = require('../utils/tenantDB');

// Schemas
const EmployeeSchema = require('../models/Employee');
const DepartmentSchema = require('../models/Department');
const LeaveRequestSchema = require('../models/LeaveRequest');
const ActivitySchema = require('../models/Activity');
const AttendanceSchema = require('../models/Attendance');
const UserSchema = require('../models/User');

require('dotenv').config({ path: './.env' });

async function create() {
  try {
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hrms';
    await mongoose.connect(MONGO_URI);
    
    // Register models on main mongoose connection if they aren't already
    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    const companyEmail = 'gitakshmi@gmail.com';
    const password = '123456789';

    // Delete existing company & user with this email to prevent duplicate keys
    await Tenant.deleteMany({ companyEmail });
    await User.deleteMany({ email: companyEmail });
    console.log('Cleaned up existing gitakshmi company/user.');

    const hashedPassword = await bcrypt.hash(password, 10);
    const tenantId = "tenant_" + crypto.randomUUID();
    const apiKey = "key_" + crypto.randomUUID();
    const code = 'gt';

    const company = new Tenant({
      companyName: 'gitakshmi technologies private limited',
      companyEmail: companyEmail,
      adminEmail: companyEmail,
      ownerName: 'Admin',
      adminName: 'Admin',
      phone: '9999999999',
      password: hashedPassword,
      logo: null,
      tenantId,
      apiKey,
      code,
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
      modules: [
        'HR', 'Payroll', 'Attendance', 'Leave', 'Hiring', 'BGV', 'Documents', 
        'Social Media', 'Onboarding', 'Employee Portal', 'Reports', 'Policy'
      ],
      status: 'active',
      isVerified: true,
      meta: { primaryEmail: companyEmail, ownerName: 'Admin', adminPassword: password }
    });

    // Generate safe db name
    const safeName = 'company_gitakshmi_technologies_pvt_ltd';
    company.databaseName = safeName;

    // Create Admin User in MAIN database
    const adminUser = new User({
      name: 'Admin',
      email: companyEmail,
      password: hashedPassword,
      role: 'hr', // Let's use 'hr' as standard Main Company Admin role
      tenant: company._id,
      mainCompanyId: company._id,
      companyId: company._id
    });
    await adminUser.save();

    company.adminUser = adminUser._id;
    await company.save();

    console.log('Created Tenant and main database User document.');

    // Initialize tenant-specific DB metadata
    const db = await getTenantDB(company._id);
    db.model("Employee", EmployeeSchema);
    db.model("Department", DepartmentSchema);
    db.model("LeaveRequest", LeaveRequestSchema);
    db.model("Attendance", AttendanceSchema);
    db.model("User", UserSchema);
    db.model('Activity', ActivitySchema);

    await db.db.collection('tenant_metadata').updateOne(
      { key: 'tenant' },
      {
        $setOnInsert: {
          key: 'tenant',
          tenantObjectId: company._id,
          tenantId: company.tenantId,
          companyCode: company.code,
          companyName: company.companyName,
          databaseName: company.databaseName,
          initializedAt: new Date(),
          isolated: true
        }
      },
      { upsert: true }
    );

    const Activity = db.model('Activity');
    await Activity.create({
      action: 'Tenant initialized',
      company: company.companyName,
      tenant: company._id,
      meta: { seeded: true, databaseName: company.databaseName }
    });

    console.log('Tenant database initialized successfully.');
    console.log('--- COMPANY CREDENTIALS ---');
    console.log(`Email: ${companyEmail}`);
    console.log(`Password: ${password}`);
    console.log(`Company Code: ${code}`);
    console.log('---------------------------');
    
    process.exit(0);
  } catch (err) {
    console.error('Error creating company:', err);
    process.exit(1);
  }
}

create();
