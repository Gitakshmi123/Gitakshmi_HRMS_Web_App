const mongoose = require('mongoose');

/**
 * BGV Task Assignment Model
 * Manages task assignment to internal HR, field agents, vendors
 * Prevents self-approval and enforces maker-checker workflow
 */
const BGVTaskAssignmentSchema = new mongoose.Schema({
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
        ref: 'BGVCheck',
        required: true,
        index: true
    },

    // Task Details
    taskType: {
        type: String,
        enum: ['VERIFICATION', 'FIELD_VISIT', 'DOCUMENT_REVIEW', 'API_CHECK', 'VENDOR_VERIFICATION', 'APPROVAL'],
        required: true
    },
    taskStatus: {
        type: String,
        enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'ESCALATED'],
        default: 'PENDING'
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },

    // Assignment
    assignedTo: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        userType: {
            type: String,
            enum: ['INTERNAL_HR', 'VERIFIER', 'SENIOR_REVIEWER', 'FIELD_AGENT', 'VENDOR', 'API_SERVICE']
        },
        assignedAt: Date,
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },

    // Maker-Checker Tracking
    maker: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        completedAt: Date,
        remarks: String
    },
    checker: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reviewedAt: Date,
        decision: {
            type: String,
            enum: ['APPROVED', 'REJECTED', 'SENT_BACK']
        },
        remarks: String
    },

    // SLA Tracking
    sla: {
        expectedCompletionDate: Date,
        actualCompletionDate: Date,
        isOverdue: {
            type: Boolean,
            default: false
        },
        overdueBy: Number // Hours
    },

    // Task Instructions
    instructions: String,
    checklistItems: [{
        item: String,
        isCompleted: Boolean,
        completedAt: Date
    }],

    // Evidence Requirements
    requiredEvidence: [{
        documentType: String,
        isMandatory: Boolean,
        isUploaded: Boolean
    }],

    // Escalation
    escalation: {
        isEscalated: {
            type: Boolean,
            default: false
        },
        escalatedAt: Date,
        escalatedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        escalationReason: String,
        escalationLevel: {
            type: Number,
            default: 0
        }
    },

    // Vendor Integration (if applicable)
    vendorDetails: {
        vendorId: String,
        vendorName: String,
        vendorTaskId: String,
        vendorStatus: String,
        vendorResponse: mongoose.Schema.Types.Mixed
    },

    // Audit Trail
    timeline: [{
        action: String,
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        remarks: String
    }],

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'bgv_task_assignments'
});

// Indexes
BGVTaskAssignmentSchema.index({ tenant: 1, taskStatus: 1 });
BGVTaskAssignmentSchema.index({ 'assignedTo.userId': 1, taskStatus: 1 });
BGVTaskAssignmentSchema.index({ 'sla.isOverdue': 1 });

// Prevent self-approval
BGVTaskAssignmentSchema.pre('save', function (next) {
    if (this.maker && this.checker) {
        if (this.maker.userId && this.checker.userId) {
            if (this.maker.userId.toString() === this.checker.userId.toString()) {
                return next(new Error('Self-approval is not allowed. Maker and Checker must be different users.'));
            }
        }
    }
    next();
});

// Check if task is overdue
BGVTaskAssignmentSchema.methods.checkOverdue = function () {
    if (this.sla.expectedCompletionDate && this.taskStatus !== 'COMPLETED') {
        const now = new Date();
        if (now > this.sla.expectedCompletionDate) {
            this.sla.isOverdue = true;
            const diffMs = now - this.sla.expectedCompletionDate;
            this.sla.overdueBy = Math.floor(diffMs / (1000 * 60 * 60)); // Hours
        }
    }
};

// Add timeline entry
BGVTaskAssignmentSchema.methods.addTimelineEntry = function (action, user, remarks = '') {
    this.timeline.push({
        action,
        performedBy: user,
        timestamp: new Date(),
        remarks
    });
};

// Static: Get overdue tasks
BGVTaskAssignmentSchema.statics.getOverdueTasks = async function (tenantId) {
    const now = new Date();
    return this.find({
        tenant: tenantId,
        taskStatus: { $nin: ['COMPLETED', 'REJECTED'] },
        'sla.expectedCompletionDate': { $lt: now }
    }).populate('assignedTo.userId caseId checkId');
};

module.exports = BGVTaskAssignmentSchema;
