const mongoose = require('mongoose');

const WorkflowDelegationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  fromEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  toEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  moduleKey: { type: String, trim: true, lowercase: true, default: '', index: true },
  reason: { type: String, trim: true, default: '' },
  startDate: { type: Date, required: true, index: true },
  endDate: { type: Date, required: true, index: true },
  isEmergency: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

WorkflowDelegationSchema.index({ tenantId: 1, fromEmployeeId: 1, isActive: 1, startDate: 1, endDate: 1 });

module.exports = WorkflowDelegationSchema;
