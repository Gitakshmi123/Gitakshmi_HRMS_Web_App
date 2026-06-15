const mongoose = require('mongoose');

async function check() {
  const uri = 'mongodb+srv://nitesh_waytocode:nodejs123@cluster0.ojqnvgi.mongodb.net/company_69d626068560596a949a0010?retryWrites=true&w=majority&appName=Cluster0';
  await mongoose.connect(uri);
  const Employee = mongoose.connection.collection('employees');
  const employee = await Employee.findOne({ email: 'test@test.com' });
  console.log('Main Tenant Employee:', employee);
  
  if (employee) {
      const bcrypt = require('bcryptjs');
      const match = await bcrypt.compare('123456789', employee.password);
      console.log('Password Match:', match);
  }
  
  process.exit(0);
}

check();
