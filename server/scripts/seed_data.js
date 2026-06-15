require('dotenv').config();
const mongoose = require('mongoose');

// Models
const Tenant = require('../models/Tenant');
const Employee = require('../models/Employee');
const Counter = require('../models/Counter');
const getTenantDB = require('../utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Clear existing data (optional - comment out to preserve)
    // await Tenant.deleteMany({});
    // await Employee.deleteMany({});
    // await Counter.deleteMany({});

    // Create sample tenants with proper admin credentials
    const tenants = [
      {
        name: 'Google India',
        code: 'goo001',
        emailDomain: 'google.com',
        plan: 'premium',
        status: 'active',
        modules: ['hr', 'payroll', 'ess'],
        meta: {
          email: 'google@gmail.com',
          adminPassword: 'admin123',
          ownerName: 'Google Admin',
          phone: '+91-9876543210',
          address: 'Bangalore, India',
        },
      },
      {
        name: 'TCS Limited',
        code: 'tcs001',
        emailDomain: 'tcs.com',
        plan: 'premium',
        status: 'active',
        modules: ['hr', 'payroll', 'ess'],
        meta: {
          email: 'admin@tcs.com',
          adminPassword: 'tcs@123',
          ownerName: 'TCS HR Manager',
          phone: '+91-8765432109',
          address: 'Mumbai, India',
        },
      },
      {
        name: 'Infosys Technologies',
        code: 'inf001',
        emailDomain: 'infosys.com',
        plan: 'basic',
        status: 'active',
        modules: ['hr'],
        meta: {
          email: 'hr@infosys.com',
          adminPassword: 'infosys456',
          ownerName: 'Infosys HR Lead',
          phone: '+91-7654321098',
          address: 'Pune, India',
        },
      },
    ];

    // Insert tenants
    const createdTenants = [];
    for (const tenantData of tenants) {
      const existing = await Tenant.findOne({ code: tenantData.code });
      if (!existing) {
        const tenant = await Tenant.create(tenantData);
        createdTenants.push(tenant);
        console.log(`✓ Created tenant: ${tenant.name} (${tenant.code})`);
      } else {
        createdTenants.push(existing);
        console.log(`- Tenant already exists: ${existing.name} (${existing.code})`);
      }
    }

    // Create sample employees for the first tenant
    if (createdTenants.length > 0) {
      const tenantId = createdTenants[0]._id;
      const tenantDB = await getTenantDB(tenantId);

      // Employee model should already be registered by dbManager
      const EmployeeModel = tenantDB.model('Employee');

      const employees = [
        {
          tenant: tenantId,
          firstName: 'Rajesh',
          lastName: 'Kumar',
          email: 'rajesh@google.com',
          employeeId: 'goo0001', // Will be auto-generated
          password: 'emp123',
          department: 'Engineering',
          position: 'Senior Developer',
          status: 'Active',
        },
        {
          tenant: tenantId,
          firstName: 'Priya',
          lastName: 'Sharma',
          email: 'priya@google.com',
          employeeId: 'goo0002',
          password: 'emp123',
          department: 'HR',
          position: 'HR Manager',
          status: 'Active',
        },
        {
          tenant: tenantId,
          firstName: 'Amit',
          lastName: 'Patel',
          email: 'amit@google.com',
          employeeId: 'goo0003',
          password: 'emp123',
          department: 'Sales',
          position: 'Sales Executive',
          status: 'Active',
        },
      ];

      for (const empData of employees) {
        const existing = await EmployeeModel.findOne({ email: empData.email });
        if (!existing) {
          const emp = await EmployeeModel.create(empData);
          console.log(`✓ Created employee: ${emp.firstName} ${emp.lastName} (${emp.email})`);
        } else {
          console.log(`- Employee already exists: ${empData.email}`);
        }
      }
    }

    console.log('\n✓ Database seeding completed successfully!');
    console.log('\nYou can now login with:');
    console.log('- Super Admin: superadmin@hrms.com / admin123');
    console.log('- Tenant (Google): Company Code: goo001, Email: google@gmail.com, Password: admin123');
    console.log('- Employee: Employee ID: goo0001, Password: emp123');

    await mongoose.connection.close();
    console.log('\n✓ Database connection closed');
  } catch (err) {
    console.error('❌ Seeding error:', err.message);
    process.exit(1);
  }
}

seedDatabase();
