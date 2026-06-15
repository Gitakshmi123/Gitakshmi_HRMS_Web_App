const mongoose = require('mongoose');

const WorkflowVersionSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  workflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
  version: { type: Number, required: true },
  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'],
    default: 'DRAFT',
    index: true,
  },
  definition: {
    steps: [{
      key: { type: String, required: true, trim: true },
      name: { type: String, required: true, trim: true },
      order: { type: Number, required: true },
      approvalMode: {
        type: String,
        enum: ['ANY', 'ALL', 'MAJORITY'],
        default: 'ANY',
      },
      minApprovals: { type: Number, default: 1 },
      slaHours: { type: Number, default: 24 },
      approver: {
        type: { type: String, required: true, trim: true },
        value: { type: mongoose.Schema.Types.Mixed, default: null },
      },
      fallbackApprover: {
        type: { type: String, trim: true },
        value: { type: mongoose.Schema.Types.Mixed, default: null },
      },
      conditions: { type: [mongoose.Schema.Types.Mixed], default: [] },
    }],
    rules: { type: [mongoose.Schema.Types.Mixed], default: [] },
    settings: {
      allowRequesterApproval: { type: Boolean, default: false },
      rejectPolicy: {
        type: String,
        enum: ['ANY_REJECTS', 'STEP_REJECTS'],
        default: 'ANY_REJECTS',
      },
    },
  },
  publishedAt: { type: Date, default: null },
  publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

WorkflowVersionSchema.index(
  { tenantId: 1, workflowId: 1, version: 1 },
  { unique: true, name: 'workflow_version_unique' }
);

module.exports = WorkflowVersionSchema;
