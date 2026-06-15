/**
 * ═══════════════════════════════════════════════════════════════════════
 * APPLICATION MODEL - Central Entity for Recruitment Workflow
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * This is the CORE entity that connects Job → Candidate → Interview → Offer → Employee
 * 
 * Status Flow:
 * APPLIED → SHORTLISTED → INTERVIEW → SELECTED → OFFERED → JOINED / REJECTED
 * 
 * Business Rules:
 * - One candidate can apply to one job only once
 * - Status transitions are strictly controlled
 * - Interview scheduling requires SHORTLISTED status
 * - Offer creation requires SELECTED status
 * - Employee creation requires OFFERED + ACCEPTED status
 * 
 * @version 2.0
 */

const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
    // ═══════════════════════════════════════════════════════════════════
    // CORE IDENTIFIERS
    // ═══════════════════════════════════════════════════════════════════

    applicationId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        immutable: true, // Cannot be changed once set
        // Format: APP-2026-0001
    },

    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true,
        immutable: true
    },

    // ═══════════════════════════════════════════════════════════════════
    // RELATIONSHIPS
    // ═══════════════════════════════════════════════════════════════════

    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Requirement', // Your Job/Requirement model
        required: true,
        index: true,
        immutable: true
    },

    jobOpeningId: {
        type: String, // Human-readable: JOB-2026-0001
        required: true,
        index: true,
        immutable: true
    },

    gradeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Grade',
        default: null,
        index: true
    },

    gradeSnapshot: {
        id: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null },
        name: { type: String, trim: true, default: '' },
        code: { type: String, trim: true, default: '' },
        level: { type: Number, default: null }
    },

    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        required: true,
        index: true,
        immutable: true
    },

    candidateReadableId: {
        type: String, // Human-readable: CAN-2026-0001
        index: true
    },

    // ═══════════════════════════════════════════════════════════════════
    // STATUS MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    status: {
        type: String,
        enum: [
            'APPLIED',      // Initial state
            'SHORTLISTED',  // HR reviewed and shortlisted
            'INTERVIEW',    // Interview scheduled/in-progress
            'SELECTED',     // Passed all interviews
            'OFFERED',      // Offer letter sent
            // ===== Strict Hiring Workflow (v3) =====
            'OFFER_PENDING',
            'OFFER_ACCEPTED',
            'OFFER_SIGNED',
            'JOINING_ISSUED',
            'JOINED',       // Offer accepted + employee created
            'REJECTED',     // Rejected at any stage
            'WITHDRAWN',    // Candidate withdrew
            'ON_HOLD'       // Temporarily paused
        ],
        default: 'APPLIED',
        required: true,
        index: true
    },

    previousStatus: {
        type: String,
        // Tracks last status for rollback scenarios
    },

    // ═══════════════════════════════════════════════════════════════════
    // DYNAMIC PIPELINE TRACKING
    // ═══════════════════════════════════════════════════════════════════

    currentStageId: {
        type: String, // Matches stageId in Requirement.pipelineStages
        required: true,
        default: 'applied_stage', // Default entry stage
        index: true
    },

    stageHistory: [{
        stageId: { type: String, required: true },
        stageName: { type: String }, // Snapshot for display
        movedAt: { type: Date, default: Date.now },
        movedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

        // Feedback summary for this stage transition
        isCompleted: { type: Boolean, default: false },
        decision: { type: String, enum: ['Advance', 'Reject', 'Hold', 'Offer'], default: 'Advance' },
        comments: { type: String },
        rating: { type: Number }
    }],

    // ═══════════════════════════════════════════════════════════════════
    // CANDIDATE INFORMATION (Snapshot from Application Form)
    // ═══════════════════════════════════════════════════════════════════

    candidateInfo: {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        mobile: { type: String, required: true, trim: true },
        fatherName: { type: String, trim: true },
        dob: { type: Date },
        address: { type: String, trim: true },

        // Professional
        experience: { type: String, trim: true },
        currentCompany: { type: String, trim: true },
        currentDesignation: { type: String, trim: true },
        currentCTC: { type: String, trim: true },
        expectedCTC: { type: String, trim: true },
        noticePeriod: { type: String, trim: true },

        // Documents
        resume: { type: String, trim: true }, // File path
        coverLetter: { type: String, trim: true },
    },

    // ═══════════════════════════════════════════════════════════════════
    // INTERVIEW TRACKING
    // ═══════════════════════════════════════════════════════════════════

    interviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interview'
    }],

    currentInterviewRound: {
        type: Number,
        default: 0
    },

    totalInterviewRounds: {
        type: Number,
        default: 0
    },

    // ═══════════════════════════════════════════════════════════════════
    // OFFER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════

    offerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Offer',
        default: null
    },

    offerReadableId: {
        type: String, // OFF-2026-0001
        index: true
    },

    offerStatus: {
        type: String,
        enum: ['PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
        default: null
    },

    offerSentDate: { type: Date },
    offerAcceptedDate: { type: Date },
    offerRejectedDate: { type: Date },
    offerExpiryDate: { type: Date },
  offerRevisionRequested: { type: Boolean, default: false },
  revisionRequestedAt: { type: Date },

    // ═══════════════════════════════════════════════════════════════════
    // EMPLOYEE CONVERSION
    // ═══════════════════════════════════════════════════════════════════

    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },

    employeeReadableId: {
        type: String, // EMP-HR-0001
        index: true
    },

    joiningDate: { type: Date },
    actualJoiningDate: { type: Date }, // Actual date they joined (may differ from planned)

    // ═══════════════════════════════════════════════════════════════════
    // REJECTION & WITHDRAWAL
    // ═══════════════════════════════════════════════════════════════════

    rejectionReason: { type: String, trim: true },
    rejectedBy: { type: String, trim: true }, // HR user who rejected
    rejectedAt: { type: Date },
    rejectionStage: { type: String }, // At which stage was rejection

    withdrawalReason: { type: String, trim: true },
    withdrawnAt: { type: Date },

    // ═══════════════════════════════════════════════════════════════════
    // EVALUATION & SCORING
    // ═══════════════════════════════════════════════════════════════════

    overallScore: {
        type: Number,
        min: 0,
        max: 10,
        default: null
    },

    reviews: [{
        stage: { type: String, required: true },
        rating: { type: Number, min: 0, max: 5 },
        feedback: { type: String, trim: true },
        scorecard: { type: Object },
        reviewerName: { type: String },
        reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
    }],

    // ═══════════════════════════════════════════════════════════════════
    // AUDIT TRAIL
    // ═══════════════════════════════════════════════════════════════════

    statusHistory: [{
        from: { type: String },
        to: { type: String, required: true },
        changedBy: { type: String },
        changedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String },
        timestamp: { type: Date, default: Date.now }
    }],

    // ═══════════════════════════════════════════════════════════════════
    // METADATA
    // ═══════════════════════════════════════════════════════════════════

    source: {
        type: String,
        enum: ['CAREER_PORTAL', 'REFERRAL', 'LINKEDIN', 'NAUKRI', 'DIRECT', 'OTHER'],
        default: 'CAREER_PORTAL'
    },

    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },

    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },

    tags: [{ type: String, trim: true }],

    notes: [{
        text: { type: String, required: true },
        addedBy: { type: String },
        addedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        createdAt: { type: Date, default: Date.now }
    }],

    isActive: {
        type: Boolean,
        default: true,
        index: true
    },

    meta: { type: Object, default: {} }

}, {
    timestamps: true,
    collection: 'applications'
});

// ═══════════════════════════════════════════════════════════════════
// INDEXES FOR PERFORMANCE
// ═══════════════════════════════════════════════════════════════════

// Unique constraint: One candidate can apply to one job only once
ApplicationSchema.index({ tenant: 1, jobId: 1, candidateId: 1 }, { unique: true });

// Query optimization
ApplicationSchema.index({ tenant: 1, status: 1, createdAt: -1 });
ApplicationSchema.index({ tenant: 1, jobOpeningId: 1, status: 1 });
ApplicationSchema.index({ tenant: 1, candidateId: 1, status: 1 });
ApplicationSchema.index({ tenant: 1, offerStatus: 1 });

// ═══════════════════════════════════════════════════════════════════
// VIRTUAL FIELDS
// ═══════════════════════════════════════════════════════════════════

ApplicationSchema.virtual('canScheduleInterview').get(function () {
    return ['SHORTLISTED', 'INTERVIEW'].includes(this.status);
});

ApplicationSchema.virtual('canCreateOffer').get(function () {
    return ['SELECTED', 'OFFER_PENDING'].includes(this.status) && !this.offerId;
});

ApplicationSchema.virtual('canConvertToEmployee').get(function () {
    return this.status === 'OFFERED' &&
        this.offerStatus === 'ACCEPTED' &&
        !this.employeeId;
});

ApplicationSchema.virtual('isInProgress').get(function () {
    return ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'OFFERED'].includes(this.status);
});

ApplicationSchema.virtual('isClosed').get(function () {
    return ['JOINED', 'REJECTED', 'WITHDRAWN'].includes(this.status);
});

// ═══════════════════════════════════════════════════════════════════
// INSTANCE METHODS
// ═══════════════════════════════════════════════════════════════════

/**
 * Change application status with validation
 */
ApplicationSchema.methods.changeStatus = function (newStatus, userId, userName, reason = null) {
    const { isStrictHiringStatus, validateHiringFlow } = require('../utils/validateHiringFlow');

    // If an application is inside strict workflow, block switching to legacy statuses
    if (isStrictHiringStatus(this.status) && !isStrictHiringStatus(newStatus)) {
        throw new Error('Invalid workflow transition');
    }

    const validTransitions = {
        'APPLIED': ['SHORTLISTED', 'REJECTED', 'WITHDRAWN', 'ON_HOLD'],
        'SHORTLISTED': ['INTERVIEW', 'REJECTED', 'WITHDRAWN', 'ON_HOLD'],
        'INTERVIEW': ['SELECTED', 'REJECTED', 'WITHDRAWN', 'ON_HOLD', 'OFFER_PENDING'],
        'SELECTED': ['OFFERED', 'REJECTED', 'WITHDRAWN'],
        'OFFERED': ['JOINED', 'REJECTED', 'WITHDRAWN'],
        // ===== Strict Hiring Workflow (v3) =====
        'OFFER_PENDING': ['OFFER_ACCEPTED', 'REJECTED'],
        'OFFER_ACCEPTED': ['OFFER_SIGNED', 'REJECTED'],
        'OFFER_SIGNED': ['JOINING_ISSUED', 'REJECTED'],
        'JOINING_ISSUED': ['JOINED', 'REJECTED'],
        'ON_HOLD': ['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'REJECTED'],
        'REJECTED': [], // Terminal state
        'JOINED': [], // Terminal state
        'WITHDRAWN': [] // Terminal state
    };

    const allowedTransitions = validTransitions[this.status] || [];

    if (!allowedTransitions.includes(newStatus)) {
        throw new Error(
            `Invalid status transition: ${this.status} → ${newStatus}. ` +
            `Allowed transitions: ${allowedTransitions.join(', ') || 'None'}`
        );
    }

    // Enforce strict workflow when strict statuses are used
    if (isStrictHiringStatus(this.status) && isStrictHiringStatus(newStatus)) {
        validateHiringFlow(this.status, newStatus);
    }

    // Record in history
    this.statusHistory.push({
        from: this.status,
        to: newStatus,
        changedBy: userName,
        changedById: userId,
        reason: reason,
        timestamp: new Date()
    });

    this.previousStatus = this.status;
    this.status = newStatus;

    // Update rejection fields if applicable
    if (newStatus === 'REJECTED') {
        this.rejectedAt = new Date();
        this.rejectedBy = userName;
        this.rejectionReason = reason;
        this.rejectionStage = this.previousStatus;
    }

    if (newStatus === 'WITHDRAWN') {
        this.withdrawnAt = new Date();
        this.withdrawalReason = reason;
    }

    return this;
};

/**
 * Add interview to application
 */
ApplicationSchema.methods.addInterview = function (interviewId) {
    if (!this.canScheduleInterview) {
        throw new Error(`Cannot schedule interview. Current status: ${this.status}`);
    }

    this.interviews.push(interviewId);
    this.totalInterviewRounds = this.interviews.length;
    this.currentInterviewRound = this.interviews.length;

    // Auto-update status to INTERVIEW if not already
    if (this.status === 'SHORTLISTED') {
        this.status = 'INTERVIEW';
    }

    return this;
};

/**
 * Link offer to application
 */
ApplicationSchema.methods.linkOffer = function (offerId, offerReadableId) {
    if (!this.canCreateOffer) {
        throw new Error(`Cannot create offer. Current status: ${this.status}, Existing offer: ${this.offerId}`);
    }

    this.offerId = offerId;
    this.offerReadableId = offerReadableId;
    this.offerStatus = 'PENDING';
    this.status = 'OFFERED';

    return this;
};

/**
 * Link revised offer (when previous expired/rejected)
 */
ApplicationSchema.methods.linkRevisedOffer = function (offerId, offerReadableId) {
    this.offerId = offerId;
    this.offerReadableId = offerReadableId;
    this.offerStatus = 'PENDING';
    this.status = 'OFFERED';
    return this;
};

/**
 * Mark offer as sent
 */
ApplicationSchema.methods.markOfferSent = function () {
    if (!this.offerId) {
        throw new Error('No offer linked to this application');
    }

    this.offerStatus = 'SENT';
    this.offerSentDate = new Date();

    return this;
};

/**
 * Accept offer
 */
ApplicationSchema.methods.acceptOffer = function () {
    if (this.offerStatus !== 'SENT') {
        throw new Error(`Cannot accept offer. Current offer status: ${this.offerStatus}`);
    }

    this.offerStatus = 'ACCEPTED';
    this.offerAcceptedDate = new Date();

    return this;
};

/**
 * Reject offer
 */
ApplicationSchema.methods.rejectOffer = function (reason = null) {
    if (!['SENT', 'PENDING'].includes(this.offerStatus)) {
        throw new Error(`Cannot reject offer. Current offer status: ${this.offerStatus}`);
    }

    this.offerStatus = 'REJECTED';
    this.offerRejectedDate = new Date();
    this.status = 'REJECTED';
    this.rejectionReason = reason || 'Offer rejected by candidate';
    this.rejectedAt = new Date();

    return this;
};

/**
 * Convert to employee
 */
ApplicationSchema.methods.convertToEmployee = function (employeeId, employeeReadableId, actualJoiningDate = null) {
    if (!this.canConvertToEmployee) {
        throw new Error(
            `Cannot convert to employee. Status: ${this.status}, ` +
            `Offer Status: ${this.offerStatus}, Employee: ${this.employeeId}`
        );
    }

    this.employeeId = employeeId;
    this.employeeReadableId = employeeReadableId;
    this.actualJoiningDate = actualJoiningDate || new Date();
    this.status = 'JOINED';

    return this;
};

// ═══════════════════════════════════════════════════════════════════
// STATIC METHODS
// ═══════════════════════════════════════════════════════════════════

/**
 * Check if candidate already applied to this job
 */
ApplicationSchema.statics.hasApplied = async function (tenantId, jobId, candidateId) {
    const existing = await this.findOne({
        tenant: tenantId,
        jobId: jobId,
        candidateId: candidateId,
        isActive: true
    });

    return !!existing;
};

/**
 * Get application pipeline stats for a job
 */
ApplicationSchema.statics.getPipelineStats = async function (tenantId, jobId) {
    const stats = await this.aggregate([
        {
            $match: {
                tenant: mongoose.Types.ObjectId(tenantId),
                jobId: mongoose.Types.ObjectId(jobId),
                isActive: true
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    return stats.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
    }, {});
};

module.exports = ApplicationSchema;
