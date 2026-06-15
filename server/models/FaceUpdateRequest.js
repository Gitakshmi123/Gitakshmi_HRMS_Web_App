const mongoose = require('mongoose');

const FaceUpdateRequestSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'used'],
        default: 'pending',
        index: true
    },
    reason: {
        type: String,
        required: true
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    actionedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    actionedAt: {
        type: Date
    },
    rejectionReason: {
        type: String
    }
}, { timestamps: true });

FaceUpdateRequestSchema.index({ tenant: 1, employee: 1, status: 1 });

module.exports = FaceUpdateRequestSchema;
