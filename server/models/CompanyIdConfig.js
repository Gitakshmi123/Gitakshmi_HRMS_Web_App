const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CompanyIdConfigSchema = new Schema({
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    entityType: {
        type: String,
        enum: ['EMPLOYEE', 'JOB', 'POS', 'OFFER', 'APPLICATION', 'PAYSLIP', 'CANDIDATE', 'INTERVIEW', 'APPOINTMENT', 'EXPERIENCE', 'RELIEVING', 'CUSTOM'],
        required: true
    },
    customEntityName: {
        type: String, // e.g. "Identity Card", "Appointment Letter"
        trim: true
    },
    targetModule: {
        type: String, // e.g. "Employee Profile", "Onboarding"
        trim: true
    },
    companyCode: {
        type: String,
        trim: true,
        uppercase: true
    },
    branchCode: {
        type: String,
        trim: true,
        uppercase: true
    },
    departmentCode: {
        type: String,
        trim: true,
        uppercase: true
    },
    formatTemplate: {
        type: String,
        default: '{{PREFIX}}/{{YEAR}}/{{COUNTER}}'
    },
    useFinancialYear: {
        type: Boolean,
        default: true
    },
    prefix: {
        type: String,
        default: '',
        trim: true,
        uppercase: true
    },
    separator: {
        type: String,
        default: '-',
        trim: true
    },
    includeYear: {
        type: Boolean,
        default: true
    },
    includeMonth: {
        type: Boolean,
        default: false
    },
    includeDepartment: {
        type: Boolean, // e.g. EMP-IT-001
        default: false
    },
    padding: {
        type: Number,
        default: 4,
        min: 2,
        max: 10
    },
    startFrom: {
        type: Number,
        default: 1,
        min: 1
    },
    currentSeq: {
        type: Number,
        default: 1
    },
    resetPolicy: {
        type: String,
        enum: ['NEVER', 'YEARLY', 'MONTHLY'],
        default: 'YEARLY'
    },
    lastResetPeriod: {
        type: String  // Stores the period (Year or Year-Month) of last use
    },
    updatedBy: {
        type: String
    }
}, {
    timestamps: true
});

// Ensure unique config per entity/customName/module per company
CompanyIdConfigSchema.index({ companyId: 1, entityType: 1, customEntityName: 1, targetModule: 1 }, { unique: true });

module.exports = mongoose.model('CompanyIdConfig', CompanyIdConfigSchema);
