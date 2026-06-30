const mongoose = require('mongoose');

const LeavePolicySchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    policyId: { type: String, trim: true }, // Added policyId (Policy ID / Code)
    description: { type: String, trim: true },

    // Simple compatibility fields (for quick UI+import) ✅
    leaveTypes: [{ type: String, trim: true }], // e.g. ['SL','CL','PL']
    yearlyLimit: { type: Number, default: 0 },
    carryForward: { type: Boolean, default: false },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    isActive: { type: Boolean, default: true, index: true },
    isLocked: { type: Boolean, default: false }, // For 4-step formula engine
    effectiveFrom: { type: Date, default: null },
    expiryDate: { type: Date, default: null },

    // Who does this policy apply to?
    applicableTo: {
        type: String,
        enum: ['All', 'Department', 'Role', 'Specific', 'Intern', 'Grade', 'Band', 'Designation', 'JobType', 'Custom', 'Template'],
        default: 'All'
    },
    // If specific departments, roles, or individual employees
    departmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    branchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }], // Added branchIds (Applicable Branch)
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

    // --- FORMULA ENGINE V2 FIELDS ---
    version: { type: Number, default: 1 },
    approvalStatus: { type: String, enum: ['Draft', 'Review', 'Approved', 'Locked'], default: 'Draft' },
    formulas: [{
        leaveType: { type: String, required: true, trim: true }, // e.g. "EL"
        formulaType: { type: String, enum: ['Allocation', 'Eligibility', 'Accrual', 'Carry Forward', 'Encashment'], required: true },
        expression: { type: String, required: true } // e.g. "IF(SERVICE_MONTHS >= 6 AND PAYABLE_DAYS >= 20, 1.75, 0)"
    }],

    // Array of rules defined in this policy (Legacy V1 Simple Mode)
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
        minAttendanceDays: { type: Number, default: 20 },
        countPresent: { type: Boolean, default: true },
        countOnDuty: { type: Boolean, default: true },
        countCompOff: { type: Boolean, default: true },
        countHoliday: { type: Boolean, default: true },
        countWeeklyOff: { type: Boolean, default: true },
        countPaidLeave: { type: Boolean, default: false },
        accrualSlabs: [{
            minAttendanceDays: { type: Number, default: 20 },
            creditDays: { type: Number, default: 1.75 }
        }],
        allowNegativeBalance: { type: Boolean, default: false },
        
        carryForwardAllowed: { type: Boolean, default: false },
        maxCarryForward: { type: Number, default: 0 },
        maxLeaveCap: { type: Number, default: 0 },
        expiryMonths: { type: Number, default: 0 },
        encashmentAllowed: { type: Boolean, default: false },
        requiresApproval: { type: Boolean, default: true },
        allowDuringProbation: { type: Boolean, default: false }, // If false, 0 balance during probation
        minimumTenureMonths: { type: Number, default: 0 },
        
        // Advanced validations
        advanceNoticeDays: { type: Number, default: 0 },
        halfDayAllowed: { type: Boolean, default: true },
        postFactoAllowed: { type: Boolean, default: false },
        maxPostFactoCount: { type: Number, default: 0 },
        medicalCertRequiredAfterDays: { type: Number, default: 0 },
        applicableGender: { type: String, enum: ['All', 'Male', 'Female', 'Other'], default: 'All' },
        maxChildrenLimit: { type: Number, default: 0 },

        // Maternity-specific: tiered entitlements based on child birth order
        maternityChildRules: [{
            label: { type: String, trim: true },           // e.g. "1st & 2nd Child"
            childCountFrom: { type: Number, default: 1 },  // inclusive lower bound
            childCountTo: { type: Number, default: null },  // null = unlimited (3rd Child+)
            daysEntitled: { type: Number, default: 0 },    // e.g. 182
            fullyPaid: { type: Boolean, default: true },
            preDeliveryDaysAllowed: { type: Number, default: 0 } // e.g. 56 (8 weeks)
        }],

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
            minAttendanceDays: { type: Number, default: null },
            countPresent: { type: Boolean, default: null },
            countOnDuty: { type: Boolean, default: null },
            countCompOff: { type: Boolean, default: null },
            countHoliday: { type: Boolean, default: null },
            countWeeklyOff: { type: Boolean, default: null },
            countPaidLeave: { type: Boolean, default: null },
            accrualSlabs: [{
                minAttendanceDays: { type: Number, default: null },
                creditDays: { type: Number, default: null }
            }],
            allowNegativeBalance: { type: Boolean, default: null },
            carryForwardAllowed: { type: Boolean, default: null },
            maxCarryForward: { type: Number, default: null },
            maxLeaveCap: { type: Number, default: null },
            expiryMonths: { type: Number, default: null },
            encashmentAllowed: { type: Boolean, default: null },
            requiresApproval: { type: Boolean, default: null },
            allowDuringProbation: { type: Boolean, default: null },
            minimumTenureMonths: { type: Number, default: null },
            prorateForNewJoiners: { type: Boolean, default: null },
            
            // Advanced validation overrides
            advanceNoticeDays: { type: Number, default: null },
            halfDayAllowed: { type: Boolean, default: null },
            postFactoAllowed: { type: Boolean, default: null },
            maxPostFactoCount: { type: Number, default: null },
            medicalCertRequiredAfterDays: { type: Number, default: null },
            applicableGender: { type: String, enum: ['All', 'Male', 'Female', 'Other', null], default: null },
            maxChildrenLimit: { type: Number, default: null },

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
