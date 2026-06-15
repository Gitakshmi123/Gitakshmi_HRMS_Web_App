const mongoose = require('mongoose');

/**
 * 🔐 BGV Email Log Model
 * 
 * Audit trail for all BGV-related emails sent
 * Every email must be logged for compliance and traceability
 * 
 * CRITICAL: BGV emails are legal communication and must be traceable
 */
const BGVEmailLogSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    // BGV Context
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
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        index: true
    },

    // Email Details
    emailType: {
        type: String,
        enum: [
            'DOCUMENT_PENDING',
            'BGV_IN_PROGRESS',
            'DISCREPANCY_RAISED',
            'BGV_COMPLETED_VERIFIED',
            'BGV_COMPLETED_FAILED',
            'SLA_REMINDER_VERIFIER',
            'ESCALATION_HR_ADMIN',
            'VERIFICATION_SUBMITTED',
            'VERIFICATION_APPROVED',
            'VERIFICATION_REJECTED',
            'CUSTOM'
        ],
        required: true,
        index: true
    },

    // Recipient Information
    recipientType: {
        type: String,
        enum: ['CANDIDATE', 'VERIFIER', 'HR_ADMIN', 'CHECKER', 'CUSTOM'],
        required: true
    },
    recipientEmail: {
        type: String,
        required: true
    },
    recipientName: {
        type: String
    },
    recipientUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Email Content
    subject: {
        type: String,
        required: true
    },
    htmlBody: {
        type: String,
        required: true
    },
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BGVEmailTemplate'
    },
    templateVersion: {
        type: Number
    },

    // Variables Used
    variablesInjected: {
        type: Object,
        // Stores the actual values used for template variables
        // e.g., { candidate_name: "John Doe", bgv_case_id: "BGV-2024-001" }
    },

    // Custom Message (if any)
    customMessage: {
        type: String
    },

    // Sender Information
    sentBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        userName: String,
        userRole: String
    },
    sentBySystem: {
        type: Boolean,
        default: false // True if sent by automated system (SLA reminders, etc.)
    },

    // Email Status
    status: {
        type: String,
        enum: ['PENDING', 'SENT', 'FAILED', 'BOUNCED'],
        default: 'PENDING',
        index: true
    },
    sentAt: {
        type: Date
    },
    failureReason: {
        type: String
    },
    messageId: {
        type: String // Email service message ID
    },

    // Audit Information
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },

    // Metadata
    metadata: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'bgv_email_logs'
});

// Indexes for performance
BGVEmailLogSchema.index({ caseId: 1, createdAt: -1 });
BGVEmailLogSchema.index({ candidateId: 1, emailType: 1 });
BGVEmailLogSchema.index({ status: 1, createdAt: -1 });
BGVEmailLogSchema.index({ tenant: 1, emailType: 1, status: 1 });

// Virtual for timeline display
BGVEmailLogSchema.virtual('timelineDescription').get(function () {
    return `Email sent to ${this.recipientName || this.recipientEmail}: ${this.subject}`;
});

module.exports = BGVEmailLogSchema;
