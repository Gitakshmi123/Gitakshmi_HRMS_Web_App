const mongoose = require('mongoose');

const BGVCaseSchema = new mongoose.Schema({
    caseId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    applicationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Applicant',
        required: false,
        default: null,
        index: true
    },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        required: false,
        default: null,
        index: true,
        sparse: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },

    // Verification Configuration (REFACTORED: No more fixed packages)
    checksRequested: [{
        type: { type: String, required: true },
        checkId: { type: mongoose.Schema.Types.ObjectId, ref: 'BGVCheck' },
        status: { type: String, default: 'PENDING' }
    }],

    // Status Management
    overallStatus: {
        type: String,
        enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CLOSED', 'VERIFIED', 'VERIFIED_WITH_DISCREPANCIES'],
        default: 'PENDING',
        index: true
    },
    overallResult: {
        type: String,
        enum: ['PENDING', 'CLEAR', 'FAILED', 'REVIEW_REQUIRED'],
        default: 'PENDING'
    },
    riskScore: {
        type: String,
        enum: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'],
        default: 'LOW'
    },

    // Decision Workflow
    decision: {
        type: String,
        enum: ['PENDING', 'APPROVED', 'REJECTED', 'RECHECK_REQUIRED'],
        default: 'PENDING'
    },
    decisionBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    decisionAt: {
        type: Date
    },
    decisionRemarks: {
        type: String
    },

    // SLA Tracking
    sla: {
        targetDays: { type: Number, default: 7 },
        dueDate: { type: Date },
        isOverdue: { type: Boolean, default: false }
    },

    // Assigned Personnel
    initiatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    assignedVerifiers: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        checkType: { type: String },
        assignedAt: { type: Date, default: Date.now }
    }],

    // Timeline
    initiatedAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    completedAt: {
        type: Date
    },
    closedAt: {
        type: Date
    },
    closedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Reports
    finalReport: {
        path: String,
        generatedAt: Date,
        generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },

    // Immutability & Compliance
    isImmutable: {
        type: Boolean,
        default: false
    },
    isClosed: {
        type: Boolean,
        default: false,
        index: true
    },

    // Comprehensive Audit Trail
    logs: [{
        action: String,
        performedBy: String,
        performedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        oldStatus: String,
        newStatus: String,
        remarks: String,
        timestamp: { type: Date, default: Date.now },
        ip: String,
        userAgent: String,
        metadata: { type: Object }
    }],

    // Metadata
    meta: {
        type: Object,
        default: {}
    },

    // Consent Management
    consentCaptured: {
        type: Boolean,
        default: false
    },
    consentCapturedAt: {
        type: Date
    },

    // Retention Policy
    retainedAfterDeletion: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'bgv_cases'
});

// Indexes for performance and uniqueness
BGVCaseSchema.index({ tenant: 1, overallStatus: 1 });
BGVCaseSchema.index({ tenant: 1, isClosed: 1 });
BGVCaseSchema.index({ tenant: 1, createdAt: -1 });
BGVCaseSchema.index({ tenant: 1, applicationId: 1 });

// Compound unique index: per-tenant unique candidateId (sparse = null values are allowed)
// This ensures only one ACTIVE BGV case per candidate per tenant
BGVCaseSchema.index(
    { tenant: 1, candidateId: 1, isClosed: 1 },
    {
        unique: true,
        sparse: true,
        partialFilterExpression: { isClosed: false }
    }
);

// Similarly for employeeId
BGVCaseSchema.index(
    { tenant: 1, employeeId: 1, isClosed: 1 },
    {
        unique: true,
        sparse: true,
        partialFilterExpression: { isClosed: false }
    }
);

// Middleware to prevent updates if immutable or closed
BGVCaseSchema.pre('save', function (next) {
    // Calculate SLA due date on creation
    if (this.isNew && this.sla.targetDays) {
        const dueDate = new Date(this.initiatedAt);
        dueDate.setDate(dueDate.getDate() + this.sla.targetDays);
        this.sla.dueDate = dueDate;
    }

    // Check if overdue
    if (this.sla.dueDate && !this.completedAt) {
        this.sla.isOverdue = new Date() > this.sla.dueDate;
    }

    // Prevent modification if closed
    if (this.isClosed && !this.isNew) {
        const allowedFields = ['logs', 'meta']; // Only audit fields can be updated
        const modifiedFields = this.modifiedPaths();
        const hasProtectedChanges = modifiedFields.some(field =>
            !allowedFields.some(allowed => field.startsWith(allowed))
        );

        if (hasProtectedChanges) {
            return next(new Error('Cannot modify a closed BGV case. BGV data is immutable after closure.'));
        }
    }

    // Prevent modification if immutable
    if (this.isImmutable && this.isModified()) {
        const protectedFields = ['overallStatus', 'candidateId', 'applicationId', 'checksRequested'];
        const isChangingProtected = protectedFields.some(field => this.isModified(field));
        if (isChangingProtected) {
            return next(new Error('Cannot modify an immutable BGV Case (linked to active employee)'));
        }
    }

    next();
});

// Virtual for progress percentage
BGVCaseSchema.virtual('progressPercentage').get(function () {
    // This will be calculated based on checks in the controller
    return 0;
});

module.exports = BGVCaseSchema;
