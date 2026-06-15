const mongoose = require('mongoose');

const WorkflowHistorySchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowInstance', required: true, index: true },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
  action: {
    type: String,
    enum: [
      'STARTED',
      'ASSIGNED',
      'APPROVED',
      'REJECTED',
      'SENT_BACK',
      'COMPLETED',
      'FAILED',
      'DELEGATED',
      'ESCALATED',
      'COMMENTED',
      'CANCELLED',
    ],
    required: true,
    index: true,
  },
  actorEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  stepKey: { type: String, trim: true, default: '' },
  fromStatus: { type: String, trim: true, default: '' },
  toStatus: { type: String, trim: true, default: '' },
  comment: { type: String, trim: true, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, trim: true, default: '' },
  userAgent: { type: String, trim: true, default: '' },
}, { timestamps: true });

WorkflowHistorySchema.index({ tenantId: 1, instanceId: 1, createdAt: 1 });

module.exports = WorkflowHistorySchema;
