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
    results.usersFound = users.map(u => ({ id: u._id, email: u.email, role: u.role, tenant: u.tenant }));

    const tenants = await Tenant.find({ status: 'active' }).lean();
    for (const t of tenants) {
      try {
        const dbName = `company_${t._id}`;
        const tenantDb = mongoose.connection.useDb(dbName);
        const Employee = tenantDb.collection('employees');
        const emp = await Employee.findOne({ email: /git@gmail\.com/i });
        if (emp) {
          results.employeesFound.push({ tenant: t.code, tenantId: t._id, id: emp._id, email: emp.email, role: emp.role });
        }
      } catch (e) {}
    }

    fs.writeFileSync('diag_output_v2.json', JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    fs.writeFileSync('diag_output_v2.json', JSON.stringify({ error: err.message }, null, 2));
    process.exit(1);
  }
}

diagnose();
