
const mongoose = require('mongoose');
require('dotenv').config();

const Tenant = require('./models/Tenant');
const getTenantDB = require('./utils/tenantDB');

async function testQuery() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const tenant = await Tenant.findOne({ code: "tes001" });
    const db = await getTenantDB(tenant._id);
    const Employee = db.model("Employee");

    const emailToTest = "hello@gmain.com";
    const emp1 = await Employee.findOne({ email: emailToTest });
    console.log(`Query for "${emailToTest}": ${emp1 ? 'FOUND' : 'NOT FOUND'}`);

    const emailToTest2 = "Hello@gmain.com";
    const emp2 = await Employee.findOne({ email: emailToTest2 });
    console.log(`Query for "${emailToTest2}": ${emp2 ? 'FOUND' : 'NOT FOUND'}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testQuery();
