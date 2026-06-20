const mongoose = require('mongoose');

const LeavePolicySchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    // Simple compatibility fields (for quick UI+import) ✅
    leaveTypes: [{ type: String, trim: true }], // e.g. ['SL','CL','PL']
    yearlyLimit: { type: Number, default: 0 },
    carryForward: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    isActive: { type: Boolean, default: true, index: true },

    // Who does this policy apply to?
    applicableTo: {
        type: String,
        enum: ['All', 'Department', 'Role', 'Specific', 'Intern', 'Grade', 'Band', 'Designation', 'JobType'],
        default: 'All'
    },
    // If specific departments, roles, or individual employees
    departmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    roles: [{ type: String, trim: true }],
    designations: [{ type: String, trim: true }],
    specificEmployeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    gradeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Grade' }],
    gradeCodes: [{ type: String, trim: true, uppercase: true }],

    // Employee type applicability & encashment rules
    encashmentAllowed: { type: Boolean, default: false },
    minimumTenureRequiredMonths: { type: Number, default: 0 }, // e.g., 3 months before eligible
    applicableEmployeeTypes: [{ type: String, enum: ['Full-time', 'Contract', 'Probation', 'Part-time'] }],
    applicableJobTypes: [{ type: String, trim: true }], 
    applicableBands: [{ type: String, trim: true, uppercase: true }], // e.g. ['A', 'B', 'C']

    // Array of rules defined in this policy
    rules: [{
        leaveType: { type: String, required: true, trim: true }, // e.g. "CL", "SL", "LWP"
        totalPerYear: { type: Number, default: 0 },
        
        // --- Dynamic Application Constraints ---
        advanceNoticeDays: { type: Number, default: 0 }, // e.g. 7 for PL, 2 for CL
        allowPostFacto: { type: Boolean, default: false }, // Can apply after taking leave
        maxPostFactoLimit: { type: Number, default: 0 }, // Max times post facto allowed per year
        medicalCertificateMandatoryAfterDays: { type: Number, default: 0 }, // Require attachment if >= X days
        minimumLeaveFraction: { type: Number, default: 0.5 }, // e.g. 0.5 for Half Day allowed
        
        // --- Accrual & Balance Logic ---
        monthlyAccrual: { type: Boolean, default: false }, // If true, adds Total/12 every month
        accrualType: { type: String, enum: ['yearly', 'monthly'], default: 'yearly' },
        monthlyAccrualRate: { type: Number, default: 0 },
        proRataApplicable: { type: Boolean, default: true }, // Pro-rate for mid-year joiners
        accrualDependsOnAttendance: { type: Boolean, default: false }, // e.g. based on Present+WO+Holidays
        allowNegativeBalance: { type: Boolean, default: false },
        
        carryForwardAllowed: { type: Boolean, default: false },
        maxCarryForward: { type: Number, default: 0 },
        maxLeaveCap: { type: Number, default: 0 },
        expiryMonths: { type: Number, default: 0 },
        encashmentAllowed: { type: Boolean, default: false },
        requiresApproval: { type: Boolean, default: true },
        allowDuringProbation: { type: Boolean, default: false }, // If false, 0 balance during probation
        minimumTenureMonths: { type: Number, default: 0 },
        
        // --- Grade Overrides ---
        gradeOverrides: [{
            gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null },
            gradeCode: { type: String, trim: true, uppercase: true, default: '' },
            totalPerYear: { type: Number, default: null },
            advanceNoticeDays: { type: Number, default: null },
            allowPostFacto: { type: Boolean, default: null },
            maxPostFactoLimit: { type: Number, default: null },
            medicalCertificateMandatoryAfterDays: { type: Number, default: null },
            minimumLeaveFraction: { type: Number, default: null },
            monthlyAccrual: { type: Boolean, default: null },
            accrualType: { type: String, enum: ['yearly', 'monthly', null], default: null },
            monthlyAccrualRate: { type: Number, default: null },
            proRataApplicable: { type: Boolean, default: null },
            accrualDependsOnAttendance: { type: Boolean, default: null },
            allowNegativeBalance: { type: Boolean, default: null },
            carryForwardAllowed: { type: Boolean, default: null },
            maxCarryForward: { type: Number, default: null },
            maxLeaveCap: { type: Number, default: null },
            expiryMonths: { type: Number, default: null },
            encashmentAllowed: { type: Boolean, default: null },
            requiresApproval: { type: Boolean, default: null },
            allowDuringProbation: { type: Boolean, default: null },
            minimumTenureMonths: { type: Number, default: null },
            color: { type: String, default: '' }
        }],
        color: { type: String, default: '#3b82f6' } // Default blue-500
    }]
}, { timestamps: true });

LeavePolicySchema.index({ tenant: 1, name: 1 });

LeavePolicySchema.pre('validate', function syncStatusFlags(next) {
    if (this.status) {
        this.status = String(this.status).toUpperCase();
    }

    if (this.status === 'ACTIVE') {
        this.isActive = true;
    } else if (this.status === 'INACTIVE') {
        this.isActive = false;
    } else if (typeof this.isActive === 'boolean') {
        this.status = this.isActive ? 'ACTIVE' : 'INACTIVE';
    }

    next();
});

// ❗ MULTI-TENANT FIX
// Do NOT export mongoose.model()
// Only export Schema
module.exports = LeavePolicySchema;
