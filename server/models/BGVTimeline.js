const mongoose = require('mongoose');

/**
 * BGV Timeline Model
 * Immutable audit log for all BGV activities
 * Provides complete traceability of verification process
 */
const BGVTimelineSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    caseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BGVCase',
        required: true,
        index: true
    },
    checkId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BGVCheck'
    },

    // Event Information
    eventType: {
        type: String,
        enum: [
            'CASE_INITIATED',
            'CHECK_ASSIGNED',
            'DOCUMENT_UPLOADED',
            'DOCUMENT_VERIFIED',
            'DOCUMENT_REJECTED',
            'CHECK_STARTED',
            'CHECK_IN_PROGRESS',
            'CHECK_VERIFIED',
            'CHECK_FAILED',
            'CHECK_DISCREPANCY',
            'VENDOR_REQUEST_SENT',
            'VENDOR_RESPONSE_RECEIVED',
            'CASE_COMPLETED',
            'CASE_CLOSED',
            'CASE_REOPENED',
            'REPORT_GENERATED',
            'NOTIFICATION_SENT',
            'EMAIL_SENT',
            'EMAIL_FAILED',
            'COMMENT_ADDED',
            'STATUS_CHANGED',
            'CONSENT_CAPTURED',
            'CONSENT_WITHDRAWN',
            'OTHER'
        ],
        required: true,
        index: true
    },

    title: {
        type: String,
        required: true
    },

    description: {
        type: String
    },

    // Actor Information
    performedBy: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: String,
        userRole: String,
        userEmail: String
    },

    // Status Transition
    oldStatus: {
        type: String
    },
    newStatus: {
        type: String
    },

    // Visibility Control
    visibleTo: {
        type: [String],
        enum: ['CANDIDATE', 'HR', 'VERIFIER', 'ADMIN', 'ALL'],
        default: ['ALL']
    },

    // Additional Context
    remarks: {
        type: String
    },

    metadata: {
        type: Object,
        default: {}
    },

    // Audit Information
    timestamp: {
        type: Date,
        default: Date.now,
        index: true,
        immutable: true
    },

    ipAddress: {
        type: String
    },

    userAgent: {
        type: String
    },

    // Immutability Flag
    isImmutable: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: false, // We use custom timestamp field
    collection: 'bgv_timeline'
});

// Indexes for performance
BGVTimelineSchema.index({ tenant: 1, caseId: 1, timestamp: -1 });
BGVTimelineSchema.index({ tenant: 1, eventType: 1, timestamp: -1 });
BGVTimelineSchema.index({ 'performedBy.userId': 1, timestamp: -1 });

// Prevent updates to immutable records
BGVTimelineSchema.pre('save', function (next) {
    if (!this.isNew && this.isImmutable) {
        return next(new Error('Timeline entries are immutable and cannot be modified'));
    }
    next();
});

// Prevent deletion
BGVTimelineSchema.pre('remove', function (next) {
    next(new Error('Timeline entries cannot be deleted'));
});

module.exports = BGVTimelineSchema;
