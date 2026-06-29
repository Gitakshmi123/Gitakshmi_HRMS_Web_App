require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  try {
    console.log("Connecting to:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully!");

    const Tenant = require('./models/Tenant');
    const firstTenant = await Tenant.findOne({ status: 'active' }).lean();
    if (!firstTenant) {
      console.log("No active tenant found.");
      return;
    }
    const tenantId = firstTenant._id;
    console.log("Active tenant found:", firstTenant.companyName, "ID:", tenantId);

    // Get DB name or create tenant DB connection
    const dbName = `tenant_${tenantId}`;
    const tenantDB = mongoose.connection.useDb(dbName, { useCache: true });

    // Models
    const Employee = tenantDB.model('Employee', require('./models/Employee'));
    const Payslip = tenantDB.model('Payslip', require('./models/Payslip'));
    const PayrollAdjustment = tenantDB.model('PayrollAdjustment', require('./models/PayrollAdjustment'));
    const PayrollInputBatch = tenantDB.model('PayrollInputBatch', require('./models/PayrollInputBatch'));
    const EmployeeDeduction = tenantDB.model('EmployeeDeduction', require('./models/EmployeeDeduction'));
    const EmployeeTaxProfile = tenantDB.model('EmployeeTaxProfile', require('./models/EmployeeTaxProfile'));

    console.log("Employees Count:", await Employee.countDocuments({}));
    console.log("Payslips Count:", await Payslip.countDocuments({}));
    console.log("PayrollAdjustment Count:", await PayrollAdjustment.countDocuments({}));
    console.log("PayrollInputBatch Count:", await PayrollInputBatch.countDocuments({}));
    console.log("EmployeeDeduction Count:", await EmployeeDeduction.countDocuments({}));
    console.log("EmployeeTaxProfile Count:", await EmployeeTaxProfile.countDocuments({}));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
