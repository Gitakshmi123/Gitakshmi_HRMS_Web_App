const mongoose = require('mongoose');

const AccessControlSchema = new mongoose.Schema({
  role: { type: String, required: true },
  permissions: [{ type: String }],
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }
}, { timestamps: true });

// Multi-tenant fix: export ONLY schema
module.exports = AccessControlSchema;
