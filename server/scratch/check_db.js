const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const db = mongoose.connection.useDb('gitakshmi-one');
    const EmployeeSchema = require('./models/Employee');
    const Employee = db.model('Employee', EmployeeSchema);

    const emp = await Employee.findOne({});
    if (emp) {
      console.log('Employee found:');
      console.log(JSON.stringify(emp.toObject(), null, 2));
    } else {
      console.log('No employees found.');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
