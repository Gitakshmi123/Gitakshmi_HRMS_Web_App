/**
 * Seed script to create sample organizational structure data
 * 
 * Usage: node backend/scripts/seed_org_data.js
 * 
 * This script creates a sample hierarchy:
 * - CEO/Founder (Top Level)
 * - HR Managers
 * - Department Heads (Tech, Marketing, Finance)
 * - Team Leads
 * - Employees/Interns
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const EmployeeSchema = require('../models/Employee');
const DepartmentSchema = require('../models/Department');

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('Error: MONGO_URI not set in environment');
  process.exit(1);
}

async function seedOrgData() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    // Get first tenant (or create one for testing)
    let tenant = await Tenant.findOne();
    if (!tenant) {
      console.log('No tenant found. Please create a tenant first.');
      process.exit(1);
    }

    const tenantId = tenant._id;
    const db = mongoose.connection.useDb(`tenant_${tenantId}`);
    
    const Employee = db.model('Employee', EmployeeSchema);
    const Department = db.model('Department', DepartmentSchema);

    // Clear existing employees (optional - comment out if you want to keep existing data)
    // await Employee.deleteMany({ tenant: tenantId });
    // console.log('Cleared existing employees');

    // Create Departments
    const departments = [
      { name: 'Technology', description: 'Software Development and IT' },
      { name: 'Marketing', description: 'Marketing and Communications' },
      { name: 'Finance', description: 'Finance and Accounting' },
      { name: 'Human Resources', description: 'HR and People Operations' }
    ];

    const createdDepts = [];
    for (const dept of departments) {
      const existing = await Department.findOne({ tenant: tenantId, name: dept.name });
      if (!existing) {
        const newDept = await Department.create({ ...dept, tenant: tenantId });
        createdDepts.push(newDept);
        console.log(`Created department: ${dept.name}`);
      } else {
        createdDepts.push(existing);
        console.log(`Department already exists: ${dept.name}`);
      }
    }

    const techDept = createdDepts.find(d => d.name === 'Technology');
    const marketingDept = createdDepts.find(d => d.name === 'Marketing');
    const financeDept = createdDepts.find(d => d.name === 'Finance');
    const hrDept = createdDepts.find(d => d.name === 'Human Resources');

    // Create Employees in hierarchy
    const employees = [];

    // 1. CEO/Founder (Top Level)
    const ceo = await Employee.create({
      tenant: tenantId,
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@company.com',
      employeeId: 'CEO-001',
      role: 'CEO / Founder',
      department: 'Executive',
      manager: null,
      jobType: 'Full-Time'
    });
    employees.push(ceo);
    console.log('Created CEO:', ceo.firstName, ceo.lastName);

    // 2. HR Manager
    const hrManager = await Employee.create({
      tenant: tenantId,
      firstName: 'Sarah',
      lastName: 'Johnson',
      email: 'sarah.johnson@company.com',
      employeeId: 'HRM-001',
      role: 'HR Manager',
      department: hrDept?.name || 'Human Resources',
      manager: ceo._id,
      jobType: 'Full-Time'
    });
    employees.push(hrManager);
    console.log('Created HR Manager:', hrManager.firstName, hrManager.lastName);

    // 3. Department Heads
    const techHead = await Employee.create({
      tenant: tenantId,
      firstName: 'Michael',
      lastName: 'Chen',
      email: 'michael.chen@company.com',
      employeeId: 'TECH-001',
      role: 'Head of Technology',
      department: techDept?.name || 'Technology',
      manager: ceo._id,
      jobType: 'Full-Time'
    });
    employees.push(techHead);
    console.log('Created Tech Head:', techHead.firstName, techHead.lastName);

    const marketingHead = await Employee.create({
      tenant: tenantId,
      firstName: 'Emily',
      lastName: 'Davis',
      email: 'emily.davis@company.com',
      employeeId: 'MKT-001',
      role: 'Head of Marketing',
      department: marketingDept?.name || 'Marketing',
      manager: ceo._id,
      jobType: 'Full-Time'
    });
    employees.push(marketingHead);
    console.log('Created Marketing Head:', marketingHead.firstName, marketingHead.lastName);

    const financeHead = await Employee.create({
      tenant: tenantId,
      firstName: 'David',
      lastName: 'Wilson',
      email: 'david.wilson@company.com',
      employeeId: 'FIN-001',
      role: 'Head of Finance',
      department: financeDept?.name || 'Finance',
      manager: ceo._id,
      jobType: 'Full-Time'
    });
    employees.push(financeHead);
    console.log('Created Finance Head:', financeHead.firstName, financeHead.lastName);

    // 4. Team Leads (under Tech Head)
    const backendLead = await Employee.create({
      tenant: tenantId,
      firstName: 'Alex',
      lastName: 'Rodriguez',
      email: 'alex.rodriguez@company.com',
      employeeId: 'TECH-002',
      role: 'Backend Team Lead',
      department: techDept?.name || 'Technology',
      manager: techHead._id,
      jobType: 'Full-Time'
    });
    employees.push(backendLead);
    console.log('Created Backend Lead:', backendLead.firstName, backendLead.lastName);

    const frontendLead = await Employee.create({
      tenant: tenantId,
      firstName: 'Jessica',
      lastName: 'Martinez',
      email: 'jessica.martinez@company.com',
      employeeId: 'TECH-003',
      role: 'Frontend Team Lead',
      department: techDept?.name || 'Technology',
      manager: techHead._id,
      jobType: 'Full-Time'
    });
    employees.push(frontendLead);
    console.log('Created Frontend Lead:', frontendLead.firstName, frontendLead.lastName);

    // 5. Employees (under Team Leads)
    const backendDev1 = await Employee.create({
      tenant: tenantId,
      firstName: 'Ryan',
      lastName: 'Thompson',
      email: 'ryan.thompson@company.com',
      employeeId: 'TECH-004',
      role: 'Senior Backend Developer',
      department: techDept?.name || 'Technology',
      manager: backendLead._id,
      jobType: 'Full-Time'
    });
    employees.push(backendDev1);

    const backendDev2 = await Employee.create({
      tenant: tenantId,
      firstName: 'Lisa',
      lastName: 'Anderson',
      email: 'lisa.anderson@company.com',
      employeeId: 'TECH-005',
      role: 'Backend Developer',
      department: techDept?.name || 'Technology',
      manager: backendLead._id,
      jobType: 'Full-Time'
    });
    employees.push(backendDev2);

    const frontendDev1 = await Employee.create({
      tenant: tenantId,
      firstName: 'Kevin',
      lastName: 'Brown',
      email: 'kevin.brown@company.com',
      employeeId: 'TECH-006',
      role: 'Frontend Developer',
      department: techDept?.name || 'Technology',
      manager: frontendLead._id,
      jobType: 'Full-Time'
    });
    employees.push(frontendDev1);

    const frontendDev2 = await Employee.create({
      tenant: tenantId,
      firstName: 'Amanda',
      lastName: 'Taylor',
      email: 'amanda.taylor@company.com',
      employeeId: 'TECH-007',
      role: 'Junior Frontend Developer',
      department: techDept?.name || 'Technology',
      manager: frontendLead._id,
      jobType: 'Full-Time'
    });
    employees.push(frontendDev2);

    // Marketing Employees
    const marketingSpecialist1 = await Employee.create({
      tenant: tenantId,
      firstName: 'Robert',
      lastName: 'Lee',
      email: 'robert.lee@company.com',
      employeeId: 'MKT-002',
      role: 'Marketing Specialist',
      department: marketingDept?.name || 'Marketing',
      manager: marketingHead._id,
      jobType: 'Full-Time'
    });
    employees.push(marketingSpecialist1);

    const marketingSpecialist2 = await Employee.create({
      tenant: tenantId,
      firstName: 'Nicole',
      lastName: 'White',
      email: 'nicole.white@company.com',
      employeeId: 'MKT-003',
      role: 'Content Marketing Manager',
      department: marketingDept?.name || 'Marketing',
      manager: marketingHead._id,
      jobType: 'Full-Time'
    });
    employees.push(marketingSpecialist2);

    // Finance Employees
    const accountant1 = await Employee.create({
      tenant: tenantId,
      firstName: 'James',
      lastName: 'Harris',
      email: 'james.harris@company.com',
      employeeId: 'FIN-002',
      role: 'Senior Accountant',
      department: financeDept?.name || 'Finance',
      manager: financeHead._id,
      jobType: 'Full-Time'
    });
    employees.push(accountant1);

    const accountant2 = await Employee.create({
      tenant: tenantId,
      firstName: 'Maria',
      lastName: 'Garcia',
      email: 'maria.garcia@company.com',
      employeeId: 'FIN-003',
      role: 'Accountant',
      department: financeDept?.name || 'Finance',
      manager: financeHead._id,
      jobType: 'Full-Time'
    });
    employees.push(accountant2);

    // Interns
    const intern1 = await Employee.create({
      tenant: tenantId,
      firstName: 'Tom',
      lastName: 'Miller',
      email: 'tom.miller@company.com',
      employeeId: 'INT-001',
      role: 'Software Engineering Intern',
      department: techDept?.name || 'Technology',
      manager: frontendLead._id,
      jobType: 'Internship'
    });
    employees.push(intern1);

    const intern2 = await Employee.create({
      tenant: tenantId,
      firstName: 'Sophia',
      lastName: 'Clark',
      email: 'sophia.clark@company.com',
      employeeId: 'INT-002',
      role: 'Marketing Intern',
      department: marketingDept?.name || 'Marketing',
      manager: marketingHead._id,
      jobType: 'Internship'
    });
    employees.push(intern2);

    // Update department heads
    if (techDept) {
      techDept.head = techHead._id;
      await techDept.save();
    }
    if (marketingDept) {
      marketingDept.head = marketingHead._id;
      await marketingDept.save();
    }
    if (financeDept) {
      financeDept.head = financeHead._id;
      await financeDept.save();
    }
    if (hrDept) {
      hrDept.head = hrManager._id;
      await hrDept.save();
    }

    console.log('\n✅ Successfully seeded organizational structure!');
    console.log(`Total employees created: ${employees.length}`);
    console.log('\nHierarchy:');
    console.log('  CEO/Founder');
    console.log('    ├── HR Manager');
    console.log('    ├── Head of Technology');
    console.log('    │   ├── Backend Team Lead');
    console.log('    │   │   ├── Senior Backend Developer');
    console.log('    │   │   └── Backend Developer');
    console.log('    │   └── Frontend Team Lead');
    console.log('    │       ├── Frontend Developer');
    console.log('    │       ├── Junior Frontend Developer');
    console.log('    │       └── Software Engineering Intern');
    console.log('    ├── Head of Marketing');
    console.log('    │   ├── Marketing Specialist');
    console.log('    │   ├── Content Marketing Manager');
    console.log('    │   └── Marketing Intern');
    console.log('    └── Head of Finance');
    console.log('        ├── Senior Accountant');
    console.log('        └── Accountant');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

seedOrgData();

