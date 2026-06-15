const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI;

async function diagnose() {
  const results = {
    connected: false,
    tenantId: '69c56fa3d01f8b09a61759d4',
    tenant: null,
    error: null
  };

  try {
    await mongoose.connect(MONGO_URI);
    results.connected = true;

    const Tenant = mongoose.model('Tenant', new mongoose.Schema({}, { strict: false }));
    const t = await Tenant.findById(results.tenantId).lean();
    
    if (t) {
      results.tenant = { id: t._id, code: t.code, status: t.status };
    }

    fs.writeFileSync('diag_output_tenant.json', JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    fs.writeFileSync('diag_output_tenant.json', JSON.stringify({ error: err.message }, null, 2));
    process.exit(1);
  }
}

diagnose();
