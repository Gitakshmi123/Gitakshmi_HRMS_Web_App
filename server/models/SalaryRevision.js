const mongoose = require('mongoose');

/**
 * SalaryRevision Model
 * 
 * IMMUTABLE record of any salary change (Increment, Revision, Promotion)
 * Stores complete before/after snapshots for full audit trail
 * 
 * CRITICAL RULES:
 * - Never modify existing revisions
 * - Always create new snapshot on approval
 * - Payroll uses snapshots, never templates directly
 */
const SalaryRevisionSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },

    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },

    // Type of salary change
    type: {
        type: String,
        enum: ['INCREMENT', 'REVISION', 'PROMOTION'],
        required: true,
        index: true
    },

    // When this change becomes effective for payroll
    effectiveFrom: {
        type: Date,
        required: true,
        index: true
    },

    // When this revision was created/applied
    appliedOn: {
        type: Date,
        default: Date.now
    },

    // Complete snapshot BEFORE the change (immutable copy)
    oldSnapshot: {
        snapshotId: { type: mongoose.Schema.Types.ObjectId },
        templateId: { type: mongoose.Schema.Types.ObjectId },
        ctc: { type: Number, required: true },
        monthlyCTC: { type: Number, required: true },

        earnings: [{
            name: String,
            componentCode: String,
            calculationType: String,
            formula: String,
            percentage: Number,
            monthlyAmount: Number,
            annualAmount: Number,
            taxable: Boolean,
            proRata: Boolean
        }],

        employerDeductions: [{
            name: String,
            componentCode: String,
            calculationType: String,
            formula: String,
            percentage: Number,
            monthlyAmount: Number,
            annualAmount: Number
        }],

        employeeDeductions: [{
            name: String,
            componentCode: String,
            category: String,
            amountType: String,
            formula: String,
            calculationBase: String,
            amountValue: Number,
            monthlyAmount: Number
        }],

        breakdown: {
            grossA: Number,
            grossB: Number,
            grossC: Number,
            takeHome: Number,
            totalDeductions: Number
        },

        effectiveFrom: Date,
        locked: { type: Boolean, default: true }
    },

    // Complete snapshot AFTER the change (immutable copy)
    newSnapshot: {
        snapshotId: { type: mongoose.Schema.Types.ObjectId },
        templateId: { type: mongoose.Schema.Types.ObjectId },
        ctc: { type: Number, required: true },
        monthlyCTC: { type: Number, required: true },

        earnings: [{
            name: String,
            componentCode: String,
            calculationType: String,
            formula: String,
            percentage: Number,
            monthlyAmount: Number,
            annualAmount: Number,
            taxable: Boolean,
            proRata: Boolean
        }],

        employerDeductions: [{
            name: String,
            componentCode: String,
            calculationType: String,
            formula: String,
            percentage: Number,
            monthlyAmount: Number,
            annualAmount: Number
        }],

        employeeDeductions: [{
            name: String,
            componentCode: String,
            category: String,
            amountType: String,
            formula: String,
            calculationBase: String,
            amountValue: Number,
            monthlyAmount: Number
        }],

        breakdown: {
            grossA: Number,
            grossB: Number,
            grossC: Number,
            takeHome: Number,
            totalDeductions: Number
        },

        effectiveFrom: Date,
        locked: { type: Boolean, default: false }
    },

    // Summary of changes for quick reference
    changeSummary: {
        oldCTC: { type: Number, required: true },
        newCTC: { type: Number, required: true },
        absoluteChange: { type: Number, required: true },
        percentageChange: { type: Number, required: true },
        reason: { type: String, trim: true, maxlength: 1000 }
    },

    // Promotion-specific details (only if type === 'PROMOTION')
    promotionDetails: {
        oldDesignation: { type: String, trim: true },
        newDesignation: { type: String, trim: true },
        oldDepartment: { type: String, trim: true },
        newDepartment: { type: String, trim: true },
        oldDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
        newDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
        oldGrade: { type: String, trim: true },
        newGrade: { type: String, trim: true },
        oldRole: { type: String, trim: true },
        newRole: { type: String, trim: true }
    },

    // Approval workflow
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    approvedAt: {
        type: Date
    },

    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    rejectedAt: {
        type: Date
    },

    rejectionReason: {
        type: String,
        trim: true,
        maxlength: 1000
    },

    status: {
        type: String,
        enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'APPLIED', 'REJECTED'],
        default: 'DRAFT',
        index: true
    },

    // Letter generation tracking
    letterGenerated: {
        type: Boolean,
        default: false
    },

    letterUrl: {
        type: String,
        trim: true
    },

    letterGeneratedAt: {
        type: Date
    },

    // Full audit trail
    audit: {
        createdAt: { type: Date, default: Date.now, immutable: true },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        ipAddress: { type: String, trim: true },
        userAgent: { type: String, trim: true },

        modifiedAt: { type: Date },
        modifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

        appliedAt: { type: Date },
        appliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },

    // Additional metadata
    notes: {
        type: String,
        trim: true,
        maxlength: 2000
    },

    // Reference to the new salary template used (if applicable)
    newTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalaryTemplate'
    }

}, {
    timestamps: true,
    versionKey: false
});

// Compound indexes for efficient queries
SalaryRevisionSchema.index({ tenantId: 1, employeeId: 1, effectiveFrom: -1 });
SalaryRevisionSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
SalaryRevisionSchema.index({ tenantId: 1, type: 1, status: 1 });
SalaryRevisionSchema.index({ tenantId: 1, effectiveFrom: 1, status: 1 });

// Virtual for employee population
SalaryRevisionSchema.virtual('employee', {
    ref: 'Employee',
    localField: 'employeeId',
    foreignField: '_id',
    justOne: true
});

// Ensure virtuals are included in JSON
SalaryRevisionSchema.set('toJSON', { virtuals: true });
SalaryRevisionSchema.set('toObject', { virtuals: true });

module.exports = SalaryRevisionSchema;
