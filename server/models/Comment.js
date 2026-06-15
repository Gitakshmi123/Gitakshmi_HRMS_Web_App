const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    entityType: { type: String, required: true }, // e.g., 'Leave', 'Attendance', 'Payroll'
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },

    message: { type: String, required: true },
    commentedBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'commentedByModel'
    },
    commentedByModel: {
        type: String,
        required: true,
        enum: ['Employee', 'User', 'Tenant'],
        default: 'Employee'
    },
    commentedByRole: {
        type: String,
        enum: ['employee', 'manager', 'hr', 'psa'],
        required: true
    },

    // Denormalized for performance and cross-DB support (HR is in master DB)
    commenterName: { type: String },
    commenterPhoto: { type: String },

    createdAt: { type: Date, default: Date.now }
});

// Index for fast retrieval per entity
CommentSchema.index({ tenant: 1, entityType: 1, entityId: 1, createdAt: -1 });

module.exports = CommentSchema;
