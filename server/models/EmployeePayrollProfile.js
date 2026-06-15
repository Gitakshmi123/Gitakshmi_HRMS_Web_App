const mongoose = require('mongoose');

const EmployeePayrollProfileSchema = new mongoose.Schema({
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
    legalEntityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    branchId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        default: null,
        index: true
    },
    branchName: {
        type: String,
        trim: true
    },
    workCity: {
        type: String,
        trim: true,
        index: true
    },
    workState: {
        type: String,
        trim: true,
        index: true
    },
    country: {
        type: String,
        trim: true,
        default: 'India'
    },
    payrollRegion: {
        type: String,
        trim: true,
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
    source: {
        type: String,
        enum: ['MANUAL', 'EMPLOYEE_RECORD', 'BRANCH', 'MIGRATION', 'SYSTEM'],
        default: 'MANUAL'
    },
    policyOverrides: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
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
    collection: 'employee_payroll_profiles'
});

EmployeePayrollProfileSchema.pre('validate', function(next) {
    if (this.status) {
        this.status = String(this.status).toUpperCase();
    }

    if (this.effectiveFrom && this.effectiveTo) {
        const from = new Date(this.effectiveFrom);
        const to = new Date(this.effectiveTo);
        if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && to < from) {
            return next(new Error('Payroll profile effectiveTo cannot be before effectiveFrom'));
        }
    }

    next();
});

EmployeePayrollProfileSchema.index({ tenantId: 1, employeeId: 1, effectiveFrom: -1 });
EmployeePayrollProfileSchema.index({ tenantId: 1, employeeId: 1, status: 1 });
EmployeePayrollProfileSchema.index({ tenantId: 1, workState: 1, workCity: 1 });

module.exports = EmployeePayrollProfileSchema;
