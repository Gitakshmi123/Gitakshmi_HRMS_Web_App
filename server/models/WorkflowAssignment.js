const mongoose = require('mongoose');

const WorkflowAssignmentSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  instanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowInstance', required: true, index: true },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', index: true },
  workflowVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowVersion' },
  stepKey: { type: String, required: true, trim: true, index: true },
  stepName: { type: String, required: true, trim: true },
  stepOrder: { type: Number, required: true, index: true },
  assigneeEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
  assigneeUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'SKIPPED', 'DELEGATED', 'ESCALATED', 'CANCELLED'],
    default: 'PENDING',
    index: true,
  },
  actionByEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  actionByUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actionAt: { type: Date, default: null },
  comment: { type: String, trim: true, default: '' },
  rejectReason: { type: String, trim: true, default: '' },
  dueAt: { type: Date, default: null, index: true },
  delegatedFromEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
  escalationLevel: { type: Number, default: 0 },
  remindedAt: { type: Date, default: null },
  escalatedAt: { type: Date, default: null },
  assigneeEmail: { type: String, trim: true, index: true }, // For external approvers
  magicToken: { type: String, trim: true, index: true }, // For public external approval links
  emailOpenedAt: { type: Date, default: null } // Pixel tracking
}, { timestamps: true });

WorkflowAssignmentSchema.index({ tenantId: 1, assigneeEmployeeId: 1, status: 1, dueAt: 1 });
WorkflowAssignmentSchema.index({ tenantId: 1, instanceId: 1, stepOrder: 1, status: 1 });

module.exports = WorkflowAssignmentSchema;
