const mongoose = require('mongoose');

const letterApprovalSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    letterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GeneratedLetter',
        required: true
    },
    approverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    comments: {
        type: String,
        trim: true
    },
    actionedAt: {
        type: Date
    }
}, { timestamps: true });

// Export schema for multi-tenant setup
module.exports = letterApprovalSchema;
