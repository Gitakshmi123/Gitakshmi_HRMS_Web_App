const mongoose = require('mongoose');

const WorkflowSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  moduleKey: { type: String, required: true, trim: true, lowercase: true, index: true },
  entityType: { type: String, required: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  isGlobal: { type: Boolean, default: true, index: true },
  applicableUnitIds: [{ type: mongoose.Schema.Types.ObjectId }],
  status: {
    type: String,
    enum: ['DRAFT', 'PUBLISHED', 'DISABLED', 'ARCHIVED'],
    default: 'DRAFT',
    index: true,
  },
  activeVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkflowVersion', default: null },
  activeVersion: { type: Number, default: 0 },
  isActive: { type: Boolean, default: false, index: true },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

WorkflowSchema.index(
  { tenantId: 1, moduleKey: 1, entityType: 1, isActive: 1, isDeleted: 1 },
  { name: 'workflow_active_lookup' }
);

module.exports = WorkflowSchema;
