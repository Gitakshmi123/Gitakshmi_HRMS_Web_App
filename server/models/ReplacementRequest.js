const mongoose = require('mongoose');

const ReplacementRequestSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, required: true },
    oldEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', required: true },
    reason: { type: String, required: true },
    urgency: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    requestDate: { type: Date, default: Date.now },
    approvedDate: { type: Date },
    approvalStatus: {
        type: String,
        enum: ['draft', 'pending', 'approved', 'rejected'],
        default: 'pending'
    },
    replacementStatus: {
        type: String,
        enum: ['open', 'hiring', 'hired', 'closed'],
        default: 'open'
    },
    hiredEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    timeToHire: { type: Number }, // in days
    costToHire: { type: Number, default: 0 },
    slaDays: { type: Number, default: 30 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    meta: { type: Object, default: {} }
}, { timestamps: true });

ReplacementRequestSchema.index({ tenant: 1, approvalStatus: 1 });
ReplacementRequestSchema.index({ tenant: 1, replacementStatus: 1 });

module.exports = ReplacementRequestSchema;
