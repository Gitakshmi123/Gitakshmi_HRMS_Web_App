const mongoose = require('mongoose');

const deductionMasterSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['PRE_TAX', 'POST_TAX'],
        required: true
    },
    deductionType: {
        type: String,
        enum: ['RECURRING', 'ONE_TIME', 'LOAN', 'ADVANCE', 'STATUTORY', 'MANUAL', 'LEAVE', 'DISCIPLINARY'],
        default: 'RECURRING'
    },
    statutoryCategory: {
        type: String,
        enum: ['EPF', 'ESI', 'PROFESSIONAL_TAX', 'TDS', 'OTHER'],
        default: 'OTHER'
    },
    amountType: {
        type: String,
        enum: ['FIXED', 'PERCENTAGE', 'FORMULA'],
        required: true
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
    amountValue: {
        type: Number,
        required: true,
        min: 0
    },
    calculationBase: {
        type: String,
        enum: ['BASIC', 'GROSS', 'CTC'],
        required: function () { return this.amountType === 'PERCENTAGE'; }
    },
    recurring: {
        type: Boolean,
        default: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    enabled: {
        type: Boolean,
        default: true
    },
    priority: {
        type: Number,
        default: 100
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

// Ensure name is unique within a tenant
deductionMasterSchema.index({ tenantId: 1, name: 1 }, { unique: true });

// Multi-tenant fix: Export ONLY Schema (not mongoose.model)
module.exports = deductionMasterSchema;
