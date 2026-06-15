const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config({ path: 'server/.env' });
const Employee = require('./server/models/Employee');

async function check() {
  try {
     const uri = process.env.MONGO_URI;
     if (!uri) throw new Error('No MONGO_URI');
     
     await mongoose.connect(uri);
     
     const fiveMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
     const employees = await Employee.find({ createdAt: { $gte: fiveMinsAgo } })
        .select('firstName lastName status createdAt lastStep')
        .sort({ createdAt: -1 });
     
     const output = `Found ${employees.length} employees created in last 10 mins:\n` + 
                    JSON.stringify(employees, null, 2);
     
     fs.writeFileSync('db_output.txt', output);
     
     process.exit(0);
  } catch (e) {
    fs.writeFileSync('db_output.txt', 'Error: ' + e.message);
    process.exit(1);
  }
}

check();
