const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET || "hrms_secret_key_123";

async function simulateLogin() {
  const results = {
    step: 'start',
    error: null,
    log: []
  };

  try {
    const identifier = 'git@gmail.com';
    const password = '123456';
    const companyCode = '';

    await mongoose.connect(MONGO_URI);
    results.log.push('Connected to MongoDB');

    const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
    const Tenant = mongoose.model('Tenant', new mongoose.Schema({ code: String, status: String }, { strict: false }));

    const cleanEmail = identifier.toLowerCase().trim();
    const activeTenants = await Tenant.find({ status: 'active' }).lean();
    results.log.push(`Found ${activeTenants.length} active tenants`);

    let authenticatedUser = null;
    let foundTenant = null;

    for (const t of activeTenants) {
        results.log.push(`Checking tenant ${t.code} (${t._id})`);
        const account = await User.findOne({ email: cleanEmail, tenant: t._id }).lean();
        if (account) {
            results.log.push(`  Found User record in tenant ${t.code}`);
            const ok = await bcrypt.compare(password, account.password);
            if (ok) {
                results.log.push('  Password MATCHED!');
                authenticatedUser = account;
                foundTenant = t;
                break;
            } else {
                results.log.push('  Password MISMATCH');
            }
        }
    }

    if (authenticatedUser) {
        results.step = 'success';
        results.tokenData = { id: authenticatedUser._id, tenant: foundTenant.code };
    } else {
        results.step = 'failed';
    }

    fs.writeFileSync('diag_sim_login.json', JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    fs.writeFileSync('diag_sim_login.json', JSON.stringify({ error: err.stack }, null, 2));
    process.exit(1);
  }
}

simulateLogin();
