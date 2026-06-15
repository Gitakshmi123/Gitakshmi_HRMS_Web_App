
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Tenant = require('./models/Tenant');
const getTenantDB = require('./utils/tenantDB');

async function testPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const tenant = await Tenant.findOne({ code: "tes001" });
    const db = await getTenantDB(tenant._id);
    const Employee = db.model("Employee");

    const email = "Hello@gmain.com";
    const passwordToTest = "123456789";

    const emp = await Employee.findOne({ email: email });
    if (!emp) {
      console.log(`User ${email} NOT FOUND in tenant tes001`);
      process.exit(1);
    }

    console.log(`Found user ${email}`);
    console.log(`Stored password: ${emp.password}`);

    let ok = false;
    if (emp.password.startsWith("$2")) {
       ok = await bcrypt.compare(passwordToTest, emp.password);
    } else {
       ok = (emp.password === passwordToTest);
    }

    console.log(`Password Match: ${ok}`);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testPassword();
