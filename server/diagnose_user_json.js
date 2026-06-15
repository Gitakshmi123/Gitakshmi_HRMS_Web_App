const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

async function diagnose() {
  const results = {
    connected: false,
    emailSearch: 'git@gmail.com',
    usersFound: [],
    employeesFound: [],
    error: null
  };

  try {
    await mongoose.connect(MONGO_URI);
    results.connected = true;

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));

    const users = await User.find({ email: /git@gmail\.com/i }).lean();
    results.usersFound = users.map(u => ({ id: u._id, name: u.name, role: u.role, tenant: u.tenant }));

    const tenants = await Tenant.find({ status: 'active' }).lean();
    for (const t of tenants) {
      try {
        const tenantDb = mongoose.connection.useDb(`tenant_${t._id}`);
        // We don't know the exact collection name, try 'employees'
        const Employee = tenantDb.collection('employees');
        const emp = await Employee.findOne({ email: /git@gmail\.com/i });
        if (emp) {
          results.employeesFound.push({ tenant: t.code, id: emp._id, name: emp.firstName, role: emp.role });
        }
      } catch (e) {}
    }

    fs.writeFileSync('diag_output.json', JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    fs.writeFileSync('diag_output.json', JSON.stringify({ error: err.message }, null, 2));
    process.exit(1);
  }
}

diagnose();
