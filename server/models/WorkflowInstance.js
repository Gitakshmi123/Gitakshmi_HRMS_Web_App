const mongoose = require('mongoose');

const WorkflowInstanceSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
  workflowVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowVersion', required: true, index: true },
  workflowVersion: { type: Number, required: true },
  moduleKey: { type: String, required: true, trim: true, lowercase: true, index: true },
  entityType: { type: String, required: true, trim: true, index: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  requesterEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  requesterUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'CANCELLED', 'FAILED'],
    default: 'PENDING',
    index: true,
  },
  currentStepKey: { type: String, trim: true, default: null, index: true },
  currentStepOrder: { type: Number, default: 0 },
  contextSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  startedAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  finalActionError: { type: String, trim: true, default: '' },
}, { timestamps: true });

WorkflowInstanceSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });
WorkflowInstanceSchema.index({ tenantId: 1, status: 1, updatedAt: -1 });

module.exports = WorkflowInstanceSchema;
