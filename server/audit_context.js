
const mongoose = require('mongoose');
require('dotenv').config();
const fs = require('fs');

async function auditContext() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const Tenant = require('./models/Tenant');
    const UserSchema = require('./models/User');
    const User = mongoose.model('User', UserSchema);
    
    const users = await User.find({}).lean();
    let result = '';
    for (const u of users) {
      const tenant = await Tenant.findById(u.tenant).lean();
      if (!tenant) continue;
      result += `User: ${u.email} | TenantID: ${u.tenant} | TenantCode: ${tenant.code}\n`;
      for (const [mod, enabled] of Object.entries(tenant.enabledModules || {})) {
        result += `  - ${mod}: ${enabled}\n`;
      }
    }
    fs.writeFileSync('audit_log_utf8.txt', result, 'utf8');
    process.exit(0);
  } catch (err) { console.error(err); process.exit(1); }
}
auditContext();
