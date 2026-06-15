// One-time migration to assign slug+3-digit codes to tenants missing/using non-standard codes
// Run from server folder: node scripts/migrate_tenant_codes.js

require('dotenv').config();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI not set in environment. Aborting.');
  process.exit(1);
}

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const makeSlug = (s) => {
      if (!s || typeof s !== 'string') return '';
      const cleaned = s.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleaned.slice(0, 3) || cleaned;
    };

    // regex for desired code format: 3 alnum + 3 digits
    const desiredRe = /^[a-z0-9]{3}\d{3}$/i;

    const tenants = await Tenant.find().sort({ createdAt: 1 }).lean();
    console.log(`Found ${tenants.length} tenants`);

    for (const t of tenants) {
      if (t.code && desiredRe.test(t.code)) {
        console.log(`Skipping ${t._id} (${t.name}) — code already valid: ${t.code}`);
        continue;
      }

      const slug = makeSlug(t.name) || `c${Date.now()}`;
      // find existing codes starting with slug
      const matches = await Tenant.find({ code: { $regex: `^${slug}\\d+$`, $options: 'i' } }).select('code').lean();
      let maxNum = 0;
      const regex = new RegExp(`^${slug}(\\d+)$`, 'i');
      for (const m of matches) {
        const mo = m.code.match(regex);
        if (mo && mo[1]) {
          const n = parseInt(mo[1], 10);
          if (!Number.isNaN(n) && n > maxNum) maxNum = n;
        }
      }
      const next = maxNum + 1;
      const padded = String(next).padStart(3, '0');
      const newCode = `${slug}${padded}`;

      // update this tenant
      console.log(`Updating ${t._id} (${t.name}) => ${newCode}`);
      await Tenant.updateOne({ _id: t._id }, { $set: { code: newCode } });
    }

    console.log('Migration complete');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
})();
