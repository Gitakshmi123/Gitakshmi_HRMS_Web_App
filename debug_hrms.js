const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to Main DB");

    // Let's find all tenant IDs
    const getTenantDB = require('./server/utils/tenantDB');
    
    // We can query the main DB for companies or tenants to see what is there
    // Typically there's a Company or Tenant model or we can see from the database list.
    const dbs = await mongoose.connection.db.admin().listDatabases();
    console.log("Databases:", dbs.databases.map(d => d.name));

    // Let's query the User collection in the main DB if it exists, or look at the collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log("Main DB Collections:", collections.map(c => c.name));

    // Let's find a user/tenant from the main database
    const UserGlobal = mongoose.connection.model('User', new mongoose.Schema({}, { strict: false }), 'users');
    const firstUser = await UserGlobal.findOne().lean();
    if (firstUser) {
      console.log("First User from main DB:", {
        id: firstUser._id,
        email: firstUser.email,
        role: firstUser.role,
        tenantId: firstUser.tenantId || firstUser.mainCompanyId,
        companyId: firstUser.companyId
      });
      
      const tenantId = firstUser.tenantId || firstUser.mainCompanyId || firstUser.companyId || '696b2e33265b093e28c2419b';
      console.log("Using tenant ID:", tenantId);
      
      const tenantDB = await getTenantDB(tenantId);
      console.log("Connected to Tenant DB");

      // Check Employees
      const Employee = tenantDB.model('Employee', new mongoose.Schema({}, { strict: false }), 'employees');
      const employees = await Employee.find({ isDeleted: { $ne: true } }).lean();
      console.log(`\n--- EMPLOYEES (${employees.length}) ---`);
      employees.forEach(emp => {
        console.log(`- ${emp.firstName} ${emp.lastName} | Role: ${emp.role} | Email: ${emp.email} | Dept: ${emp.departmentId} | Manager: ${emp.manager}`);
      });

      // Check Users
      const TenantUser = tenantDB.model('User', new mongoose.Schema({}, { strict: false }), 'users');
      const users = await TenantUser.find().lean();
      console.log(`\n--- TENANT USERS (${users.length}) ---`);
      users.forEach(u => {
        console.log(`- ${u.name} | Role: ${u.role} | Email: ${u.email} | Active: ${u.isActive}`);
      });

      // Check Departments
      const Department = tenantDB.model('Department', new mongoose.Schema({}, { strict: false }), 'departments');
      const depts = await Department.find().lean();
      console.log(`\n--- DEPARTMENTS (${depts.length}) ---`);
      depts.forEach(d => {
        console.log(`- Name: ${d.name} | Head ID: ${d.departmentHeadId} | Head Emp ID: ${d.headEmployeeId}`);
      });

      // Check Applicants
      const Applicant = tenantDB.model('Applicant', new mongoose.Schema({}, { strict: false }), 'applicants');
      const applicants = await Applicant.find().populate('requirementId').lean();
      console.log(`\n--- APPLICANTS (${applicants.length}) ---`);
      applicants.forEach(app => {
        console.log(`- Name: ${app.name} | Status: ${app.status} | Dept in job: ${app.requirementId?.department}`);
      });
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
