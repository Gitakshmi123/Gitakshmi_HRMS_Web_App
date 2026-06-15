const mongoose = require('mongoose');

const employeeDeductionSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    deductionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeductionMaster',
        required: true
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    customValue: {
        type: Number,
        default: null // If null, use the value from DeductionMaster
    },
    deductionType: {
        type: String,
        enum: ['RECURRING', 'ONE_TIME', 'LOAN', 'ADVANCE', 'STATUTORY', 'MANUAL', 'LEAVE', 'DISCIPLINARY'],
        default: 'RECURRING'
    },
    source: {
        type: String,
        enum: ['MASTER', 'SALARY_VERSION', 'MANUAL', 'MIGRATION'],
        default: 'MASTER'
    },
    nameSnapshot: {
        type: String,
        trim: true
    },
    categoryOverride: {
        type: String,
        enum: ['PRE_TAX', 'POST_TAX', null],
        default: null
    },
    amountTypeOverride: {
        type: String,
        enum: ['FIXED', 'PERCENTAGE', null],
        default: null
    },
    calculationBaseOverride: {
        type: String,
        enum: ['BASIC', 'GROSS', null],
        default: null
    },
    isOneTimeApplied: {
        type: Boolean,
        default: false
    },
    installmentAmount: {
        type: Number,
        default: null
    },
    remainingInstallments: {
        type: Number,
        default: null
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'INACTIVE', 'COMPLETED', 'CANCELLED'],
        default: 'ACTIVE'
    }
}, {
    timestamps: true
});

// Index for quick lookups
employeeDeductionSchema.index({ tenantId: 1, employeeId: 1 });

// Multi-tenant fix: Export ONLY Schema (not mongoose.model)
module.exports = employeeDeductionSchema;
