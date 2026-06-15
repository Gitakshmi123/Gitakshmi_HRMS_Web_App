const mongoose = require('mongoose');

/**
 * DOCUMENT AUDIT MODEL
 * 
 * Tracks all interactions with documents for compliance and security:
 * - Who created/accessed/downloaded documents
 * - When they accessed it
 * - IP address for security tracking
 * - Status changes and lifecycle events
 * 
 * ✅ Production-ready audit trail
 * ✅ Non-destructive (immutable records)
 * ✅ Multi-tenant isolation
 * ✅ Optimized for queries by document and time range
 */

const documentAuditSchema = new mongoose.Schema({
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
    
    // Related Entity
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
    
    // Action Tracking
    action: {
        type: String,
        enum: [
            'created',           // Letter generated
            'assigned',          // Assigned to employee/applicant
            'viewed',            // Document viewed
            'downloaded',        // Document downloaded
            'status_changed',    // Status updated
            'revoked',           // Document revoked
            'reinstated',        // Revocation cancelled
            'expired',           // Document expired
            'email_sent',        // Notification email sent
            'access_denied',     // Access attempt blocked
            'metadata_changed'   // Metadata updated
        ],
        required: true,
        index: true
    },
    
    // User Info (who performed action)
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    performedByRole: {
        type: String,
        enum: ['admin', 'hr', 'manager', 'employee', 'intern', 'super_admin'],
        required: false
    },
    
    // IP & Device Info (security)
    ipAddress: {
        type: String,
        required: false
    },
    userAgent: {
        type: String,
        required: false
    },
    
    // Status Transition (for status_changed events)
    oldStatus: {
        type: String,
        required: false
    },
    newStatus: {
        type: String,
        required: false
    },
    
    // Additional Context
    reason: {
        type: String,
        required: false,
        maxLength: 500
    },
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        required: false
    },
    
    // Timestamp (immutable)
    timestamp: {
        type: Date,
        default: Date.now,
        immutable: true,
        index: true
    }
}, { 
    timestamps: false,  // Don't add createdAt/updatedAt - timestamp is immutable
    collection: 'document_audits'
});

// Compound indexes for efficient querying
documentAuditSchema.index({ tenantId: 1, documentId: 1, timestamp: -1 });
documentAuditSchema.index({ tenantId: 1, action: 1, timestamp: -1 });
documentAuditSchema.index({ tenantId: 1, performedBy: 1, timestamp: -1 });
documentAuditSchema.index({ tenantId: 1, applicantId: 1, timestamp: -1 });
documentAuditSchema.index({ tenantId: 1, employeeId: 1, timestamp: -1 });

// Export only schema (multi-tenant pattern)
module.exports = documentAuditSchema;
