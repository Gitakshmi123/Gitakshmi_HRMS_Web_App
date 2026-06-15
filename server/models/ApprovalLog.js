const mongoose = require('mongoose');

const approvalLogSchema = new mongoose.Schema({
  approvalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Approval',
    required: true,
  },
  actionBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  action: {
    type: String,
    enum: ['INITIATED', 'APPROVED', 'REJECTED', 'REQUESTED_CHANGES', 'DELEGATED', 'ESCALATED', 'REMINDER_SENT'],
    required: true,
  },
  level: {
    type: Number,
  },
  comments: {
    type: String,
    trim: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
  }
}, { timestamps: true });

approvalLogSchema.index({ approvalId: 1 });

module.exports = approvalLogSchema;
