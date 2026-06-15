const mongoose = require('mongoose');
const crypto = require('crypto');

/**
 * DOCUMENT ACCESS MODEL
 * 
 * Manages secure tokenized access to documents:
 * - Generate unique access tokens for document sharing
 * - Track who has access to what documents
 * - Support time-limited access (expiration)
 * - Revoke access without deleting documents
 * - Role-based access control
 * 
 * ✅ Tokenized URL sharing
 * ✅ Expiring access links
 * ✅ Audit trail of access grants/revokes
 * ✅ Non-destructive (access records preserved)
 */

const documentAccessSchema = new mongoose.Schema({
    // Tenant & Reference
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    
    // Document Reference
    documentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GeneratedLetter',
        required: true,
        index: true
    },
    
    // Access Recipient
    grantedToUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    grantedToApplicantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Applicant',
        required: false
    },
    grantedToEmployeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: false
    },
    
    // Unique Access Token (for share links)
    accessToken: {
        type: String,
        unique: true,
        required: true,
        index: true,
        immutable: true
    },
    
    // Access Control
    accessLevel: {
        type: String,
        enum: ['view', 'download', 'share', 'none'],
        default: 'view'
    },
    
    // Access Validity
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    expiresAt: {
        type: Date,
        required: false
    },
    revokedAt: {
        type: Date,
        required: false
    },
    revokedReason: {
        type: String,
        required: false,
        maxLength: 500
    },
    
    // Grant Info
    grantedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    grantedAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    
    // Access Tracking
    accessCount: {
        type: Number,
        default: 0
    },
    lastAccessedAt: {
        type: Date,
        required: false
    },
    
    // Additional Context
    shareNotes: {
        type: String,
        required: false,
        maxLength: 1000
    }
}, { 
    timestamps: true,
    collection: 'document_access'
});

// Indexes
documentAccessSchema.index({ tenantId: 1, documentId: 1 });
documentAccessSchema.index({ tenantId: 1, grantedToUserId: 1 });
documentAccessSchema.index({ tenantId: 1, grantedToApplicantId: 1 });
documentAccessSchema.index({ tenantId: 1, grantedToEmployeeId: 1 });
documentAccessSchema.index({ accessToken: 1, isActive: 1 });
documentAccessSchema.index({ expiresAt: 1 }, { sparse: true });

// Virtual: Check if access is expired
documentAccessSchema.virtual('isExpired').get(function() {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
});

// Virtual: Check if access is valid (active and not expired)
documentAccessSchema.virtual('isValid').get(function() {
    return this.isActive && !this.isExpired;
});

// Pre-save hook: Generate access token if not provided
documentAccessSchema.pre('save', function(next) {
    if (!this.accessToken) {
        this.accessToken = crypto
            .randomBytes(32)
            .toString('hex')
            .substring(0, 24);
    }
    next();
});

// Export only schema (multi-tenant pattern)
module.exports = documentAccessSchema;
