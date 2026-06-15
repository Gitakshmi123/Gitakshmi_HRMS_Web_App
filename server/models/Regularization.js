const mongoose = require('mongoose');

const RegularizationSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    // Type of Regularization
    category: {
        type: String,
        enum: ['Attendance', 'Leave'],
        required: true
    },

    // Dates involved
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    // Issue Details
    issueType: { type: String, required: true }, // e.g., 'Missed Punch', 'Wrong Leave Type'

    // Audit Data (Snapshots)
    originalData: { type: mongoose.Schema.Types.Mixed }, // What it was before
    requestedData: { type: mongoose.Schema.Types.Mixed }, // What user wants (punches, leave type)

    reason: { type: String, required: true, trim: true },

    // Status
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending',
        index: true
    },

    // Approval Details
    approver: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    adminRemark: { type: String, trim: true },
    actionDate: { type: Date },

    attachment: { type: String } // URL to file if any
}, { timestamps: true });

RegularizationSchema.index({ tenant: 1, employee: 1 });
RegularizationSchema.index({ tenant: 1, status: 1 });

module.exports = RegularizationSchema;
