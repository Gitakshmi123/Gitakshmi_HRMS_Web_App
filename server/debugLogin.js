const mongoose = require('mongoose');
require('dotenv').config();

const bcrypt = require('bcryptjs');

// Copy pasting the exact code
const Tenant = mongoose.model('Tenant', new mongoose.Schema({ status: String, code: String }, {strict: false}), 'companies');
const User = mongoose.model('User', new mongoose.Schema({ email: String, role: String, password: String, tenant: mongoose.Schema.Types.ObjectId, mainCompanyId: mongoose.Schema.Types.ObjectId }, {strict: false}), 'users');

async function debugLogin() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("DB connected");

  const identifier = 'pnrpvt@gmail.com';
  const norm = String(identifier || '').trim().toLowerCase();

  let adminAccount = await User.findOne({ email: norm, role: { $in: ['hr', 'admin'] } }).lean();
  console.log("adminAccount:", adminAccount);
  let tenant = null;
  if (adminAccount) {
    const tenantId = adminAccount.tenant || adminAccount.mainCompanyId;
    console.log("Trying to find tenant with ID:", tenantId);
    if (tenantId && mongoose.Types.ObjectId.isValid(String(tenantId))) {
      tenant = await Tenant.findById(tenantId).lean();
      console.log("Found tenant:", tenant);
    }
  }

  if (!adminAccount || !tenant || tenant.status !== 'active') {
    console.log("Failed at account or tenant check:", { hasAdmin: !!adminAccount, hasTenant: !!tenant, tenantStatus: tenant?.status });
  } else {
    console.log("Everything looks perfect except password.");
  }
  process.exit(0);
}

debugLogin().catch(console.error);
