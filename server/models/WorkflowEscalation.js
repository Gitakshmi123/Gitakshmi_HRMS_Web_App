const mongoose = require('mongoose');

const WorkflowEscalationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowInstance', required: true, index: true },
  assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowAssignment', required: true, index: true },
  level: { type: Number, default: 1 },
  action: {
    type: String,
    enum: ['REMINDER', 'ESCALATE_TO_MANAGER', 'ESCALATE_TO_HR', 'ESCALATE_TO_ADMIN'],
    required: true,
  },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSED', 'FAILED'],
    default: 'PENDING',
    index: true,
  },
  scheduledAt: { type: Date, required: true, index: true },
  processedAt: { type: Date, default: null },
  error: { type: String, trim: true, default: '' },
}, { timestamps: true });

WorkflowEscalationSchema.index({ tenantId: 1, status: 1, scheduledAt: 1 });

module.exports = WorkflowEscalationSchema;
