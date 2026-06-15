const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    // Polymorphic association
  },
  entityModel: {
    type: String,
    enum: ['OfferLetter', 'GeneratedLetter', 'LeaveRequest', 'Expense', 'Travel', 'Promotion', 'Asset', 'SalaryRevision'],
    required: true,
  },
  workflowId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ApprovalWorkflow',
    required: true,
  },
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  currentLevel: {
    type: Number,
    default: 1,
  },
  status: {
    type: String,
    enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'EXPIRED', 'SENT_TO_CANDIDATE', 'ACCEPTED', 'DECLINED'],
    default: 'PENDING_APPROVAL',
  },
  currentApprovers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
  dueDate: {
    type: Date,
  },
}, { timestamps: true });

approvalSchema.index({ tenantId: 1, entityId: 1, entityModel: 1 });
approvalSchema.index({ currentApprovers: 1, status: 1 });
approvalSchema.index({ requesterId: 1 });

module.exports = approvalSchema;
