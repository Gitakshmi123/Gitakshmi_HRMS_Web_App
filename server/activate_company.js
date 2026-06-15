const mongoose = require('mongoose');

async function fix() {
  try {
    await mongoose.connect('mongodb+srv://baldaniyanitesh2003_db_user:nitesh123@nitesh.mfy5jc4.mongodb.net/gitakshmi-one');
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }), 'companies');
    
    const res = await Tenant.updateOne(
      { _id: new mongoose.Types.ObjectId('6a01ac0817242e3c174ad6f2') },
      { 
        $set: { 
          status: 'active',
          'enabledModules.leave': true,
          'enabledModules.attendance': true,
          'enabledModules.employeePortal': true,
          'enabledModules.hr': true
        } 
      }
    );
    
    console.log('Update Result:', res);
    process.exit(0);
  } catch (err) {
    console.error('Fix Error:', err);
    process.exit(1);
  }
}

fix();
