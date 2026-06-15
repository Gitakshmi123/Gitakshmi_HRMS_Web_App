const mongoose = require('mongoose');

const LeaveRequestSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

  leaveType: { type: String, required: true, trim: true },

  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },

  reason: { type: String, trim: true },

  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
    default: 'Pending',
    index: true
  },

  appliedBy: { type: String, enum: ['Employee', 'HR'], default: 'Employee' },
  hrComment: { type: String, trim: true },

  approver: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },

  // existing field for rejection - keeping for backward compatibility
  rejectionReason: { type: String, trim: true },

  // New generic remark for local audit (Approve or Reject)
  adminRemark: { type: String, trim: true },

  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  cancelledAt: { type: Date },
  actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },

  daysCount: { type: Number },
  paidLeaveDays: { type: Number, default: 0 },
  unpaidLeaveDays: { type: Number, default: 0 },

  isHalfDay: { type: Boolean, default: false },
  halfDayTarget: { type: String, enum: ['Start', 'End'], default: 'Start' },
  halfDaySession: { type: String, enum: ['First Half', 'Second Half'], trim: true },

  meta: { type: Object, default: {} }
}, { timestamps: true });

// Compound indexes for common queries
LeaveRequestSchema.index({ tenant: 1, status: 1 });
LeaveRequestSchema.index({ tenant: 1, employee: 1 });
LeaveRequestSchema.index({ tenant: 1, startDate: -1 });

module.exports = LeaveRequestSchema;
