const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://techdhruv16_db_user:FpXqAuXiuyi51JLx@cluster0.cpfocff.mongodb.net/?appName=Cluster0';

async function main() {
  console.log('Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected!');

  // Get list of all databases
  const admin = mongoose.connection.db.admin();
  const dbList = await admin.listDatabases();
  console.log('Databases on cluster:', dbList.databases.map(d => `${d.name} (${d.sizeOnDisk} bytes)`));

  // Connect to the 'test' database or core DB and look at the Tenant collection
  console.log('\n--- Tenants in core database ---');
  const TenantSchema = new mongoose.Schema({}, { strict: false, collection: 'companies' });
  const Tenant = mongoose.model('Tenant', TenantSchema);
  const tenants = await Tenant.find({}).lean();
  console.log(`Found ${tenants.length} tenants:`);
  for (const t of tenants) {
    console.log(`- ID: ${t._id}, Name: ${t.name}, Code: ${t.code}, DB Name: ${t.databaseName}`);
  }

  const UserSchema = new mongoose.Schema({}, { strict: false, collection: 'users' });
  const User = mongoose.model('User', UserSchema);
  const users = await User.find({}).lean();
  console.log(`\nFound ${users.length} global users:`);
  for (const u of users) {
    console.log(`- ID: ${u._id}, Email: ${u.email}, Role: ${u.role}, CompanyId: ${u.companyId || u.mainCompanyId}`);
  }

  // Check each company/tenant database
  for (const t of tenants) {
    const dbName = t.databaseName || `company_${t._id}`;
    console.log(`\n--- Inspecting database: ${dbName} ---`);
    const dbConn = mongoose.connection.useDb(dbName);

    const EmployeeModel = dbConn.model('Employee', new mongoose.Schema({}, { strict: false, collection: 'employees' }));
    const DeptModel = dbConn.model('Department', new mongoose.Schema({}, { strict: false, collection: 'departments' }));
    const GradeModel = dbConn.model('Grade', new mongoose.Schema({}, { strict: false, collection: 'grades' }));

    const employees = await EmployeeModel.find({}).lean();
    console.log(`- Employees count: ${employees.length}`);
    for (const e of employees) {
      console.log(`  * ID: ${e._id}, Name: ${e.firstName} ${e.lastName}, Code/Id: ${e.employeeCode || e.employeeId}, Email: ${e.email}`);
      console.log(`    Dept Name: ${e.department}, Dept ID: ${e.departmentId}`);
      console.log(`    Manager: ${e.manager}, ReportingManagerId: ${e.reportingManagerId}`);
      console.log(`    Created At: ${e.createdAt}`);
    }

    const depts = await DeptModel.find({}).lean();
    console.log(`- Departments count: ${depts.length}`);
    for (const d of depts) {
      console.log(`    * ID: ${d._id}, Name: ${d.name}, Code: ${d.code}, mainCompanyId: ${d.mainCompanyId}`);
    }

    const grades = await GradeModel.find({}).lean();
    console.log(`- Grades count: ${grades.length}`);
    for (const g of grades) {
      console.log(`    * ${g.name} (${g.code})`);
    }
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
