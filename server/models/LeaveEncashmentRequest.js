const mongoose = require('mongoose');

const LeaveEncashmentRequestSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveType: { type: String, required: true, trim: true },
    requestedDays: { type: Number, required: true },
    availableBalance: { type: Number, required: true },
    basicSalary: { type: Number, required: true },
    payoutAmount: { type: Number, required: true },
    formulaUsed: { type: String, required: true, trim: true },
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
        default: 'Pending',
        index: true
    },
    reason: { type: String, trim: true },
    adminRemark: { type: String, trim: true },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    cancelledAt: { type: Date },
    actionBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
}, { timestamps: true });

LeaveEncashmentRequestSchema.index({ tenant: 1, employee: 1 });
LeaveEncashmentRequestSchema.index({ tenant: 1, status: 1 });

module.exports = LeaveEncashmentRequestSchema;
