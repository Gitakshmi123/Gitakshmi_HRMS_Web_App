const mongoose = require('mongoose');

const salaryComponentSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    type: {
        type: String,
        enum: ['EARNING', 'DEDUCTION', 'CORRECTION', 'BENEFIT'],
        required: true,
        default: 'EARNING'
    },
    // Classification
    earningType: {
        type: String,
        required: function () { return this.type === 'EARNING'; }
    },

    // Display Names
    name: {
        type: String,
        required: true,
        trim: true
    },
    payslipName: {
        type: String,
        required: true,
        trim: true
    },

    // Pay Configuration
    payType: {
        type: String,
        enum: ['FIXED', 'VARIABLE'],
        default: 'FIXED'
    },
    calculationType: {
        type: String,
        enum: ['FLAT_AMOUNT', 'PERCENTAGE_OF_BASIC', 'PERCENTAGE_OF_CTC', 'FORMULA'],
        default: 'FLAT_AMOUNT'
    },
    formula: {
        type: String,
        trim: true
    },
    formulaFrequency: {
        type: String,
        enum: ['MONTHLY', 'ANNUAL'],
        default: 'MONTHLY'
    },
    amount: {
        type: Number,
        required: function () { return this.calculationType === 'FLAT_AMOUNT'; },
        min: 0,
        default: 0
    },
    percentage: {
        type: Number,
        min: 0,
        max: 100
    },

    // Flags & Rules
    isActive: {
        type: Boolean,
        default: true
    },
    enabled: {
        type: Boolean,
        default: true
    },
    isTaxable: {
        type: Boolean,
        default: true
    },
    isProRataBasis: {
        type: Boolean,
        default: false
    },
    includeInSalaryStructure: {
        type: Boolean,
        default: true
    },

    // Statutory Components
    epf: {
        enabled: { type: Boolean, default: false },
        rule: {
            type: String,
            enum: ['ALWAYS', 'PF_WAGE_LT_15000'],
            default: 'ALWAYS'
        }
    },
    esi: {
        enabled: { type: Boolean, default: false }
    },

    // Display Logic
    showInPayslip: {
        type: Boolean,
        default: true
    },

    // System Flags
    isUsedInPayroll: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Compound index to ensure unique names per tenant
salaryComponentSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = salaryComponentSchema;
