const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
  time: { type: Date, default: Date.now },
  action: { type: String, required: true },
  company: { type: String },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  meta: { type: Object },
}, { timestamps: true });

// Multi-tenant fix: Export ONLY Schema
module.exports = ActivitySchema;
