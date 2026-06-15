const mongoose = require('mongoose');

const EmployeeTaxProfileSchema = new mongoose.Schema({
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
    effectiveFrom: {
        type: Date,
        required: true,
        index: true
    },
    effectiveTo: {
        type: Date,
        default: null,
        index: true
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'SCHEDULED', 'INACTIVE', 'EXPIRED'],
        default: 'ACTIVE',
        uppercase: true,
        index: true
    },
    regime: {
        type: String,
        enum: ['OLD', 'NEW'],
        default: 'NEW'
    },
    financialYearLabel: {
        type: String,
        trim: true
    },
    declarations: {
        section80C: { type: Number, default: 0 },
        section80CCD1B: { type: Number, default: 0 },
        section80D: { type: Number, default: 0 },
        hraExemption: { type: Number, default: 0 },
        homeLoanInterest: { type: Number, default: 0 },
        otherExemptions: { type: Number, default: 0 }
    },
    projections: {
        previousEmployerIncome: { type: Number, default: 0 },
        otherIncome: { type: Number, default: 0 },
        bonusProjection: { type: Number, default: 0 },
        taxAlreadyDeducted: { type: Number, default: 0 }
    },
    overrides: {
        monthlyTDS: { type: Number, default: null },
        annualTaxableIncome: { type: Number, default: null }
    },
    proofStatus: {
        type: String,
        enum: ['NOT_SUBMITTED', 'SUBMITTED', 'VERIFIED', 'REJECTED'],
        default: 'NOT_SUBMITTED'
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 1000
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
    collection: 'employee_tax_profiles'
});

EmployeeTaxProfileSchema.pre('validate', function(next) {
    if (this.status) {
        this.status = String(this.status).toUpperCase();
    }

    if (this.effectiveFrom && this.effectiveTo) {
        const from = new Date(this.effectiveFrom);
        const to = new Date(this.effectiveTo);
        if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && to < from) {
            return next(new Error('Tax profile effectiveTo cannot be before effectiveFrom'));
        }
    }

    next();
});

EmployeeTaxProfileSchema.index({ tenantId: 1, employeeId: 1, effectiveFrom: -1 });
EmployeeTaxProfileSchema.index({ tenantId: 1, employeeId: 1, status: 1 });

module.exports = EmployeeTaxProfileSchema;
