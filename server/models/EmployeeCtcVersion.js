const mongoose = require('mongoose');

const EmployeeCtcVersionSchema = new mongoose.Schema({
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
    version: {
        type: Number,
        required: true,
        default: 1
    },
    effectiveFrom: {
        type: Date,
        required: true,
        default: Date.now
    },
    effectiveTo: {
        type: Date,
        default: null,
        index: true
    },
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
    components: [{
        name: String,
        code: String,
        monthlyAmount: Number,
        annualAmount: Number,
        type: { type: String, enum: ['EARNING', 'DEDUCTION', 'BENEFIT'] },
        isTaxable: { type: Boolean, default: true },
        isProRata: { type: Boolean, default: true },
        category: String,
        amountType: String,
        calculationBase: String,
        amountValue: Number,
        percentage: Number,
        enabled: { type: Boolean, default: true }
    }],
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'SCHEDULED', 'INACTIVE', 'EXPIRED'],
        default: 'ACTIVE',
        uppercase: true,
        index: true
    },
    source: {
        type: String,
        enum: ['MANUAL', 'EMPLOYEE_COMPENSATION', 'SALARY_SNAPSHOT', 'SALARY_STRUCTURE', 'SALARY_TEMPLATE', 'MIGRATION', 'SYSTEM'],
        default: 'MANUAL'
    },
    sourceModel: {
        type: String,
        trim: true
    },
    sourceRefId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    salaryTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalaryTemplate',
        default: null
    },
    revisionType: {
        type: String,
        enum: ['INITIAL', 'INCREMENT', 'REVISION', 'PROMOTION', 'ADJUSTMENT', 'CORRECTION', 'MIGRATION'],
        default: 'INITIAL'
    },
    reason: {
        type: String,
        trim: true
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    settings: {
        includePensionScheme: { type: Boolean, default: true },
        includeESI: { type: Boolean, default: true },
        pfWageRestriction: { type: Boolean, default: true },
        pfWageLimit: { type: Number, default: 15000 }
    },
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
    collection: 'employee_ctc_versions'
});

// Pre-save hook to normalize status to uppercase
EmployeeCtcVersionSchema.pre('validate', function(next) {
    if (this.status) {
        this.status = this.status.toUpperCase();
    }

    if (this.effectiveFrom && this.effectiveTo) {
        const from = new Date(this.effectiveFrom);
        const to = new Date(this.effectiveTo);
        if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && to < from) {
            return next(new Error('CTC version effectiveTo cannot be before effectiveFrom'));
        }
    }

    next();
});

// Index for version control
EmployeeCtcVersionSchema.index({ employeeId: 1, version: -1 });
EmployeeCtcVersionSchema.index({ companyId: 1, employeeId: 1, isActive: 1, status: 1 });
EmployeeCtcVersionSchema.index({ companyId: 1, employeeId: 1, effectiveFrom: -1, effectiveTo: 1 });
EmployeeCtcVersionSchema.index({ companyId: 1, employeeId: 1, status: 1, effectiveFrom: -1 });

module.exports = EmployeeCtcVersionSchema;
