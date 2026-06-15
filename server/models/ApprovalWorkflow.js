const mongoose = require('mongoose');

const approvalStepSchema = new mongoose.Schema({
  level: {
    type: Number,
    required: true,
  },
  approverType: {
    type: String,
    enum: ['ROLE', 'RELATIONSHIP', 'SPECIFIC_USER'],
    required: true,
  },
  approverRole: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Role',
    required: function() {
      return this.approverType === 'ROLE';
    }
  },
  approverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.approverType === 'SPECIFIC_USER';
    }
  },
  relationshipType: {
    type: String,
    enum: ['REPORTING_MANAGER', 'DEPARTMENT_HEAD'],
    required: function() {
      return this.approverType === 'RELATIONSHIP';
    }
  }
});

const approvalWorkflowSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  entityType: {
    type: String,
    enum: ['OfferLetter', 'GeneratedLetter', 'LeaveRequest', 'Expense', 'Travel', 'Promotion', 'Asset', 'SalaryRevision'],
    required: true,
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  steps: [approvalStepSchema],
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Prevent duplicate active workflows for the same entity type in a tenant
approvalWorkflowSchema.index({ tenantId: 1, entityType: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = approvalWorkflowSchema;
