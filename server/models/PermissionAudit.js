/**
 * PermissionAudit.js
 * Records every permission change for compliance + debugging.
 * Stored in the GLOBAL database (not tenant DB) alongside User model.
 */
const mongoose = require('mongoose');

const PermissionAuditSchema = new mongoose.Schema({
  // Who was changed
  targetUserId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetEmail:   { type: String, required: true },
  targetRole:    { type: String },

  // Who made the change
  changedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  changedByEmail: { type: String },
  changedByRole:  { type: String },

  // Tenant isolation
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },

  // What changed
  action: {
    type: String,
    enum: ['PERMISSIONS_UPDATED', 'PERMISSIONS_RESET', 'USER_CREATED_WITH_PERMISSIONS'],
    required: true
  },

  // Snapshot before and after
  permsBefore:   { type: mongoose.Schema.Types.Mixed },  // previous permissions array
  permsAfter:    { type: mongoose.Schema.Types.Mixed },  // new permissions array
  permVersion:   { type: Number },                       // new version number after change

  // Summary of what actually changed (derived, for quick display)
  summary: { type: String },   // e.g. "Enabled: people.employees.create | Disabled: payroll.stats.view"

}, { timestamps: true });

// Indexes for fast audit queries
PermissionAuditSchema.index({ tenantId: 1, createdAt: -1 });         // Tenant audit timeline
PermissionAuditSchema.index({ targetUserId: 1, createdAt: -1 });     // Per-user audit history
PermissionAuditSchema.index({ changedBy: 1, createdAt: -1 });        // Per-admin activity

module.exports = PermissionAuditSchema;
