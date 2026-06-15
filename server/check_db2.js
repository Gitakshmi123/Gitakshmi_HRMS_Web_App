const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0');
  
  const Employee = mongoose.model('Employee', new mongoose.Schema({}, { strict: false }));
  
  const emps = await Employee.find({ geofence: { $exists: true, $not: {$size: 0} } }).lean();
  console.log('Employees with geofence:', emps.length);

  process.exit(0);
}

run().catch(console.error);
