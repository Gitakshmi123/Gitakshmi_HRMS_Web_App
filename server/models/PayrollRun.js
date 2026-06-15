const mongoose = require('mongoose');

/**
 * PayrollRun Model
 * Tracks monthly payroll processing runs
 * - One record per tenant per month
 * - Status tracking: INITIATED → CALCULATED → APPROVED → PAID
 * - Prevents duplicate payroll runs
 */
const PayrollRunSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true,
        min: 2000,
        max: 2100
    },
    status: {
        type: String,
        enum: ['INITIATED', 'CALCULATED', 'CALCULATED_WITH_ERRORS', 'APPROVED', 'PAID', 'CANCELLED', 'DRAFT', 'PROCESSING', 'AMENDED'],
        default: 'INITIATED',
        index: true
    },
    lifecycleState: {
        type: String,
        enum: ['DRAFT', 'CALCULATED', 'LOCKED', 'APPROVED', 'PAID', 'AMENDED', 'CANCELLED'],
        default: 'DRAFT',
        index: true
    },
    periodKey: {
        type: String,
        trim: true,
        index: true
    },
    sequenceNo: {
        type: Number,
        default: 1,
        min: 1
    },
    runCode: {
        type: String,
        trim: true,
        default: ''
    },
    runType: {
        type: String,
        enum: ['FULL', 'SELECTED', 'OFF_CYCLE', 'AMENDMENT'],
        default: 'FULL'
    },
    executionMode: {
        type: String,
        enum: ['MONTHLY', 'OFF_CYCLE', 'AMENDMENT'],
        default: 'MONTHLY'
    },
    calculationMode: {
        type: String,
        enum: ['LIVE_COMPAT', 'SNAPSHOT'],
        default: 'SNAPSHOT'
    },
    snapshotVersion: {
        type: Number,
        default: 2
    },
    payPeriodStart: {
        type: Date,
        default: null
    },
    payPeriodEnd: {
        type: Date,
        default: null
    },
    payDate: {
        type: Date,
        default: null
    },
    attendancePolicy: {
        type: String,
        enum: ['STRICT', 'ALLOW_FALLBACK'],
        default: 'STRICT'
    },
    offCycleReason: {
        type: String,
        trim: true,
        default: ''
    },
    offCycleLabel: {
        type: String,
        trim: true,
        default: ''
    },
    selectedEmployeeIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }],
    inputBatchIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollInputBatch'
    }],
    exportArtifactIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollExportArtifact'
    }],
    amendmentOfRunId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollRun',
        default: null
    },

    // Metadata
    initiatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    calculatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    paidBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    submittedForApprovalBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },

    // Timestamps
    initiatedAt: {
        type: Date,
        default: Date.now
    },
    calculatedAt: {
        type: Date
    },
    approvedAt: {
        type: Date
    },
    submittedForApprovalAt: {
        type: Date,
        default: null
    },
    rejectedAt: {
        type: Date,
        default: null
    },
    lockedAt: {
        type: Date
    },
    paidAt: {
        type: Date
    },

    // Statistics
    totalEmployees: {
        type: Number,
        default: 0
    },
    processedEmployees: {
        type: Number,
        default: 0
    },
    failedEmployees: {
        type: Number,
        default: 0
    },

    // Totals (for reporting)
    totalGross: {
        type: Number,
        default: 0
    },
    totalDeductions: {
        type: Number,
        default: 0
    },
    totalNetPay: {
        type: Number,
        default: 0
    },

    // Filtering Support
    isFiltered: {
        type: Boolean,
        default: false
    },
    filters: {
        department: String,
        designation: String,
        employeeTypes: [String],
        workModes: [String]
    },
    totalTenantEmployees: {
        type: Number,
        default: 0
    },

    // Errors & Notes
    executionErrors: [{
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        message: String,
        stack: String
    }],
    notes: {
        type: String,
        trim: true
    },
    rejectionReason: {
        type: String,
        trim: true,
        default: ''
    },
    approvalStatus: {
        type: String,
        enum: ['NOT_SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
        default: 'NOT_SUBMITTED',
        index: true
    },
    approvalWorkflow: [{
        order: { type: Number, default: 1 },
        label: { type: String, trim: true, default: '' },
        role: { type: String, trim: true, default: '' },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED', 'SKIPPED'],
            default: 'PENDING'
        },
        actedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            default: null
        },
        actedAt: {
            type: Date,
            default: null
        },
        comment: {
            type: String,
            trim: true,
            default: ''
        }
    }],
    approvalHistory: [{
        action: { type: String, trim: true, default: '' },
        order: { type: Number, default: 0 },
        label: { type: String, trim: true, default: '' },
        status: { type: String, trim: true, default: '' },
        actedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            default: null
        },
        actedAt: {
            type: Date,
            default: Date.now
        },
        comment: {
            type: String,
            trim: true,
            default: ''
        }
    }],
    varianceSummary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    runExecutionSummary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    bankTransferSummary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    accountingSummary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    complianceSummary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Phase 2 sequence-aware uniqueness for monthly, off-cycle, and amendment runs.
PayrollRunSchema.index({ tenantId: 1, month: 1, year: 1, sequenceNo: 1 }, { unique: true });

// Index for status queries
PayrollRunSchema.index({ tenantId: 1, status: 1 });
PayrollRunSchema.index({ tenantId: 1, periodKey: 1, runType: 1 });

// Multi-tenant fix: Export ONLY Schema (not mongoose.model)
module.exports = PayrollRunSchema;

