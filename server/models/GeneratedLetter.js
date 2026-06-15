const mongoose = require('mongoose');

const GeneratedLetterSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    applicantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Applicant'
    },
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LetterTemplate'
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },

    // Letter Metadata
    letterIndex: {
        type: String,
        index: true
    },
    issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Type info
    letterType: {
        type: String, // generic type string
        required: true
    },

    // Snapshot of the data used to generate this specific letter
    snapshotData: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },

    // Template Info (Immutable Snapshot)
    templateSnapshot: {
        name: String,
        bodyContent: String,
        headerContent: String,
        footerContent: String,
        version: Number
    },

    // PDF Info
    pdfPath: String,
    pdfUrl: String,
    templateType: String,
    docxPath: String,
    htmlPath: String,
    generatedHtml: String,
    generatedPdf: String,
    generatedDocx: String,
    generatedVariables: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    },
    missingVariables: [{ type: String }],
    signedPdfPath: String,
    fileName: String,
    fileSize: Number,

    // Status Flow
    status: {
        type: String,
        enum: ['Pending', 'Signed', 'Accepted', 'draft', 'pending', 'approved', 'rejected', 'changes_requested', 'generated', 'issued', 'sent', 'viewed', 'accepted', 'rejected_by_candidate', 'expired', 'revoked'],
        default: 'Pending'
    },
    approvalStatus: {
        type: String,
        enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'],
        default: undefined
    },
    acceptedAt: Date,

    // ====== JOINING LETTER EXPIRY & ACCEPTANCE WORKFLOW ======
    joiningLetterExpiryDate: {
        type: Date,
        default: null
    },
    joiningLetterStatus: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'expired', 'revision_requested'],
        default: 'pending'
    },
    joiningLetterRequestedAgain: {
        type: Boolean,
        default: false
    },
    rejectedAt: {
        type: Date,
        default: null
    },
    revisionRequestedAt: {
        type: Date,
        default: null
    },
    revisionNote: {
        type: String,
        default: ''
    },
    hrRevisionNote: {
        type: String,
        default: ''
    },
    // ====== END JOINING LETTER WORKFLOW ======

    // Dynamic Generation Mode (Architecture Refactor)
    generationMode: {
        type: String,
        enum: ['static', 'dynamic'],
        default: 'static'
    },
    pdfVersion: {
        type: Number,
        default: 1
    },

    // Tracking info
    tracking: {
        ip: String,
        userAgent: String,
        viewCount: { type: Number, default: 0 },
        lastViewedAt: Date
    },

    // Signature Configuration (Placement for Candidate)
    signaturePosition: {
        alignment: {
            type: String,
            enum: ['left', 'center', 'right'],
            default: 'right'
        },
        coordinates: {
            x: { type: Number, default: 0 },
            y: { type: Number, default: 0 }
        },
        useCustomCoords: {
            type: Boolean,
            default: false
        }
    },

    approverEmail: {
        type: String,
        default: null
    },

    // Company Approval Details (Phase 2 & 3)
    companyApproval: {
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: Date,
        signatureImage: String, // Base64 or Path
        stampImage: String,     // Base64 or Path
        isApproved: { type: Boolean, default: false }
    },

    // Universal Workflow Engine Integration
    workflowInstanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkflowInstance'
    },
    workflowStatus: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'FAILED']
    }

}, { timestamps: true });

// Pre-save to generate letterIndex if not exist
GeneratedLetterSchema.pre('save', function (next) {
    if (!this.letterIndex) {
        this.letterIndex = 'LTR-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '-' + Date.now();
    }
    next();
});

module.exports = GeneratedLetterSchema;
