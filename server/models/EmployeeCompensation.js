const mongoose = require('mongoose');

/**
 * Employee Compensation Schema
 * 
 * Stores the source-of-truth compensation data for employees (CTC structure).
 * This is the primary compensation source. EmployeeCtcVersion syncs from this.
 * 
 * Fields follow standard naming:
 * - grossA, grossB, grossC: Gross components
 * - totalCTC: Total annual CTC
 * - components: Earnings, deductions, benefits
 */
const EmployeeCompensationSchema = new mongoose.Schema({
    companyId: {
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
    salarySnapshotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmployeeSalarySnapshot',
        default: null
    },

    // CTC Structure
    grossA: {
        type: Number,
        default: 0
    },
    grossB: {
        type: Number,
        default: 0
    },
    grossC: {
        type: Number,
        default: 0
    },
    totalCTC: {
        type: Number,
        required: true,
        default: 0
    },

    // Salary Components
    components: [{
        name: String,
        code: String,
        monthlyAmount: {
            type: Number,
            default: 0
        },
        annualAmount: {
            type: Number,
            default: 0
        },
        type: {
            type: String,
            enum: ['EARNING', 'DEDUCTION', 'BENEFIT'],
            default: 'EARNING'
        },
        isTaxable: {
            type: Boolean,
            default: true
        },
        isProRata: {
            type: Boolean,
            default: true
        }
    }],

    // Status & Validity
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE'],
        default: 'ACTIVE',
        uppercase: true,
        index: true
    },

    // Effective Period
    effectiveFrom: {
        type: Date,
        default: Date.now
    },
    effectiveTo: {
        type: Date,
        default: null
    },

    // Template & Category
    templateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalaryTemplate',
        default: null
    },
    category: {
        type: String,
        enum: ['UNSKILLED', 'SEMI_SKILLED', 'SKILLED', 'GENERAL'],
        default: 'GENERAL',
        uppercase: true
    },

    // Revision History
    revisionHistory: [{
        oldCTC: Number,
        newCTC: Number,
        effectiveDate: Date,
        revisedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reason: String,
        createdAt: { type: Date, default: Date.now }
    }],

    // Audit Trail
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    collection: 'employee_compensations'
});

// Pre-save hook to normalize status to uppercase
EmployeeCompensationSchema.pre('save', function (next) {
    if (this.status) {
        this.status = this.status.toUpperCase();
    }
    next();
});

// Indexes for efficient querying
EmployeeCompensationSchema.index({ companyId: 1, employeeId: 1, isActive: 1, status: 1 });
EmployeeCompensationSchema.index({ employeeId: 1, status: 1 });
EmployeeCompensationSchema.index({ companyId: 1, status: 1 });

module.exports = EmployeeCompensationSchema;
