const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to:', mongoose.connection.name);
    const employees = await mongoose.connection.collection('employees').find({}).toArray();
    console.log('Total employees in global DB:', employees.length);
    if (employees.length > 0) {
        const tenants = [...new Set(employees.map(e => e.mainCompanyId || e.tenant))];
        console.log('Tenants found in employees:', tenants);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

run();
