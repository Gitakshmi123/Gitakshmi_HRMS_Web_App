const mongoose = require('mongoose');

/**
 * LETTER REVOCATION MODEL
 * 
 * Tracks offer/letter revocation events:
 * - Who revoked the document
 * - When it was revoked
 * - Reason for revocation
 * - Who can reinstate it
 * - Full audit trail for compliance
 * 
 * ✅ Non-destructive (original document intact)
 * ✅ Fully reversible (with appropriate permissions)
 * ✅ Complete audit trail
 * ✅ Support for recovery/reinstatement
 */

const letterRevocationSchema = new mongoose.Schema({
    // Tenant & Reference
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    
    // Document Reference
    generatedLetterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GeneratedLetter',
        required: true,
        index: true
    },
    
    // Related Entities
    applicantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Applicant',
        required: false
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: false
    },
    
    // Revocation Details
    revokedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    revokedByRole: {
        type: String,
        enum: ['admin', 'hr', 'manager', 'super_admin'],
        required: true
    },
    revokedAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    
    // Revocation Reason (mandatory for compliance)
    reason: {
        type: String,
        enum: [
            'duplicate_offer',
            'candidate_rejected',
            'position_cancelled',
            'business_decision',
            'process_error',
            'compliance_issue',
            'other'
        ],
        required: true
    },
    reasonDetails: {
        type: String,
        required: false,
        maxLength: 1000
    },
    
    // Revocation Status
    status: {
        type: String,
        enum: ['revoked', 'reinstated'],
        default: 'revoked'
    },
    
    // Reinstatement (if applicable)
    reinstatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    reinstatedByRole: {
        type: String,
        enum: ['super_admin', 'admin'],
        required: false
    },
    reinstatedAt: {
        type: Date,
        required: false
    },
    reinstatedReason: {
        type: String,
        required: false,
        maxLength: 500
    },
    
    // Document State Snapshot (for recovery)
    letterSnapshot: {
        letterType: String,
        status: String,
        templateId: mongoose.Schema.Types.ObjectId,
        generatedAt: Date,
        pdfPath: String
    },
    
    // Notification Status
    notificationSent: {
        email: {
            type: Boolean,
            default: false
        },
        sentAt: Date,
        sentTo: {
            type: [String],
            default: []
        },
        emailError: String
    },
    
    // Soft Delete Support
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, { 
    timestamps: true,
    collection: 'letter_revocations'
});

// Indexes for efficient querying
letterRevocationSchema.index({ tenantId: 1, generatedLetterId: 1 });
letterRevocationSchema.index({ tenantId: 1, applicantId: 1, revokedAt: -1 });
letterRevocationSchema.index({ tenantId: 1, employeeId: 1, revokedAt: -1 });
letterRevocationSchema.index({ tenantId: 1, revokedBy: 1, revokedAt: -1 });
letterRevocationSchema.index({ tenantId: 1, status: 1 });
letterRevocationSchema.index({ tenantId: 1, isActive: 1 });

// Virtual: Check if revocation is active (not reinstated)
letterRevocationSchema.virtual('isCurrentlyRevoked').get(function() {
    return this.status === 'revoked' && this.isActive;
});

// Export only schema (multi-tenant pattern)
module.exports = letterRevocationSchema;
