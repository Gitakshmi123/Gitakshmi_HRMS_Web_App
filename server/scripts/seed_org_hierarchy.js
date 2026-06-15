require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const getTenantDB = require('../utils/tenantDB');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/hrms';

async function seedOrgHierarchy() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    // Find or use a tenant (use gita001 if exists, otherwise first tenant)
    let tenant = await Tenant.findOne({ code: 'gita001' });
    if (!tenant) {
      tenant = await Tenant.findOne({ status: 'active' });
    }
    
    if (!tenant) {
      console.error('❌ No active tenant found. Please create a tenant first.');
      process.exit(1);
    }

    console.log(`✓ Using tenant: ${tenant.name} (${tenant.code})`);

    // Get tenant database
    const db = await getTenantDB(tenant._id);
    
    // Register models
    const DepartmentSchema = require('../models/Department');
    const EmployeeSchema = require('../models/Employee');
    
    const Department = db.model('Department', DepartmentSchema);
    const Employee = db.model('Employee', EmployeeSchema);

    // Clear existing data (optional - comment out to preserve)
    // await Department.deleteMany({ tenant: tenant._id });
    // await Employee.deleteMany({ tenant: tenant._id });

    console.log('\n📁 Creating Departments...');
    
    // Create departments
    const techDept = await Department.findOneAndUpdate(
      { name: 'Tech', tenant: tenant._id },
      {
        name: 'Tech',
        description: 'Technology and Development Department',
        tenant: tenant._id
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Created/Updated: ${techDept.name}`);

    const hrDept = await Department.findOneAndUpdate(
      { name: 'HR', tenant: tenant._id },
      {
        name: 'HR',
        description: 'Human Resources Department',
        tenant: tenant._id
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Created/Updated: ${hrDept.name}`);

    const accountsDept = await Department.findOneAndUpdate(
      { name: 'Accounts', tenant: tenant._id },
      {
        name: 'Accounts',
        description: 'Finance and Accounts Department',
        tenant: tenant._id
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Created/Updated: ${accountsDept.name}`);

    console.log('\n👥 Creating Employees...');

    // Create managers
    const techManager = await Employee.findOneAndUpdate(
      { employeeId: `${tenant.code.toUpperCase()}-TECH-001`, tenant: tenant._id },
      {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@company.com',
        employeeId: `${tenant.code.toUpperCase()}-TECH-001`,
        role: 'Dep Head',
        department: 'Tech',
        departmentId: techDept._id,
        password: 'manager123',
        contactNo: '9876543210',
        joiningDate: new Date('2023-01-15'),
        tenant: tenant._id
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Created/Updated Manager: ${techManager.firstName} ${techManager.lastName}`);

    const hrManager = await Employee.findOneAndUpdate(
      { employeeId: `${tenant.code.toUpperCase()}-HR-001`, tenant: tenant._id },
      {
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah.johnson@company.com',
        employeeId: `${tenant.code.toUpperCase()}-HR-001`,
        role: 'Dep Head',
        department: 'HR',
        departmentId: hrDept._id,
        password: 'manager123',
        contactNo: '9876543211',
        joiningDate: new Date('2023-02-01'),
        tenant: tenant._id
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Created/Updated Manager: ${hrManager.firstName} ${hrManager.lastName}`);

    // Set department heads
    techDept.head = techManager._id;
    await techDept.save();
    hrDept.head = hrManager._id;
    await hrDept.save();

    // Create employees under Tech Manager
    const emp1 = await Employee.findOneAndUpdate(
      { employeeId: `${tenant.code.toUpperCase()}-TECH-002`, tenant: tenant._id },
      {
        firstName: 'Alice',
        lastName: 'Williams',
        email: 'alice.williams@company.com',
        employeeId: `${tenant.code.toUpperCase()}-TECH-002`,
        role: 'Employee',
        department: 'Tech',
        departmentId: techDept._id,
        manager: techManager._id,
        password: 'emp123',
        contactNo: '9876543212',
        joiningDate: new Date('2023-03-10'),
        tenant: tenant._id
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Created/Updated Employee: ${emp1.firstName} ${emp1.lastName} (reports to ${techManager.firstName})`);

    const emp2 = await Employee.findOneAndUpdate(
      { employeeId: `${tenant.code.toUpperCase()}-TECH-003`, tenant: tenant._id },
      {
        firstName: 'Bob',
        lastName: 'Brown',
        email: 'bob.brown@company.com',
        employeeId: `${tenant.code.toUpperCase()}-TECH-003`,
        role: 'Employee',
        department: 'Tech',
        departmentId: techDept._id,
        manager: techManager._id,
        password: 'emp123',
        contactNo: '9876543213',
        joiningDate: new Date('2023-04-05'),
        tenant: tenant._id
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Created/Updated Employee: ${emp2.firstName} ${emp2.lastName} (reports to ${techManager.firstName})`);

    // Create employees under HR Manager
    const emp3 = await Employee.findOneAndUpdate(
      { employeeId: `${tenant.code.toUpperCase()}-HR-002`, tenant: tenant._id },
      {
        firstName: 'Emma',
        lastName: 'Davis',
        email: 'emma.davis@company.com',
        employeeId: `${tenant.code.toUpperCase()}-HR-002`,
        role: 'Employee',
        department: 'HR',
        departmentId: hrDept._id,
        manager: hrManager._id,
        password: 'emp123',
        contactNo: '9876543214',
        joiningDate: new Date('2023-05-20'),
        tenant: tenant._id
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Created/Updated Employee: ${emp3.firstName} ${emp3.lastName} (reports to ${hrManager.firstName})`);

    const emp4 = await Employee.findOneAndUpdate(
      { employeeId: `${tenant.code.toUpperCase()}-HR-003`, tenant: tenant._id },
      {
        firstName: 'Michael',
        lastName: 'Wilson',
        email: 'michael.wilson@company.com',
        employeeId: `${tenant.code.toUpperCase()}-HR-003`,
        role: 'Employee',
        department: 'HR',
        departmentId: hrDept._id,
        manager: hrManager._id,
        password: 'emp123',
        contactNo: '9876543215',
        joiningDate: new Date('2023-06-15'),
        tenant: tenant._id
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Created/Updated Employee: ${emp4.firstName} ${emp4.lastName} (reports to ${hrManager.firstName})`);

    // Create a top-level employee (no manager) in Accounts
    const emp5 = await Employee.findOneAndUpdate(
      { employeeId: `${tenant.code.toUpperCase()}-ACC-001`, tenant: tenant._id },
      {
        firstName: 'David',
        lastName: 'Miller',
        email: 'david.miller@company.com',
        employeeId: `${tenant.code.toUpperCase()}-ACC-001`,
        role: 'Dep Head',
        department: 'Accounts',
        departmentId: accountsDept._id,
        password: 'emp123',
        contactNo: '9876543216',
        joiningDate: new Date('2023-07-01'),
        tenant: tenant._id
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Created/Updated Employee: ${emp5.firstName} ${emp5.lastName} (Top-level, no manager)`);

    accountsDept.head = emp5._id;
    await accountsDept.save();

    console.log('\n✅ Organization hierarchy seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Departments: 3 (Tech, HR, Accounts)`);
    console.log(`  - Managers: 3 (John Smith, Sarah Johnson, David Miller)`);
    console.log(`  - Employees: 5 total`);
    console.log(`  - Hierarchy:`);
    console.log(`    Company`);
    console.log(`      ├── Tech (Head: John Smith)`);
    console.log(`      │     ├── Alice Williams`);
    console.log(`      │     └── Bob Brown`);
    console.log(`      ├── HR (Head: Sarah Johnson)`);
    console.log(`      │     ├── Emma Davis`);
    console.log(`      │     └── Michael Wilson`);
    console.log(`      └── Accounts (Head: David Miller)`);

    await mongoose.connection.close();
    console.log('\n✓ Done!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err);
    process.exit(1);
  }
}

seedOrgHierarchy();

