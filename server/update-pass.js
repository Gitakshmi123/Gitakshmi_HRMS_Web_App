const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function updatePasswords() {
  await mongoose.connect('mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one?retryWrites=true&w=majority&appName=Cluster0');
  
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash('123456789', salt);

  const tenantDB = mongoose.connection.useDb('company_pnr');
  const Employee = tenantDB.model('Employee', new mongoose.Schema({}, { strict: false }));
  
  const updateDoc = {};
  updateDoc['$set'] = { password: hashedPassword };

  await Employee.updateMany({}, updateDoc);

  const User = mongoose.connection.useDb('gitakshmi-one').model('User', new mongoose.Schema({}, { strict: false }));
  
  const userQuery = {};
  userQuery['email'] = { '$in': ['pinko@gmail.com', 'dhiren.makwana@gitakshmi.com'] };
  await User.updateMany(userQuery, updateDoc);

  console.log('Updated passwords to 123456789 for existing test employees!');
  process.exit(0);
}
updatePasswords();
