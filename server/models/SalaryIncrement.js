const mongoose = require('mongoose');

/**
 * ============================================
 * SALARY INCREMENT / REVISION MODEL
 * ============================================
 * 
 * CRITICAL RULES:
 * 1. NEVER modify existing salary records
 * 2. ALWAYS create new version with new effectiveFrom
 * 3. Status auto-calculated based on effectiveFrom vs today
 * 4. Payroll uses ACTIVE salary (effectiveFrom <= payroll_date)
 * 
 * STATUS LOGIC:
 * - SCHEDULED: effectiveFrom > today (future salary)
 * - ACTIVE: effectiveFrom <= today AND no newer ACTIVE version
 * - EXPIRED: replaced by newer ACTIVE version
 * 
 * VERSIONING:
 * - Each increment creates new EmployeeCtcVersion record
 * - Version number auto-incremented
 * - Old versions marked as EXPIRED when new one becomes ACTIVE
 */

const SalaryIncrementSchema = new mongoose.Schema({
    // Tenant & Employee
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

    // Increment Type
    incrementType: {
        type: String,
        enum: ['INCREMENT', 'REVISION', 'PROMOTION', 'ADJUSTMENT'],
        required: true,
        default: 'INCREMENT'
    },

    // Effective Date (CRITICAL for versioning)
    effectiveFrom: {
        type: Date,
        required: true,
        index: true
    },

    // New Salary Details
    newCtcVersionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmployeeCtcVersion',
        required: true
    },
    newTotalCTC: {
        type: Number,
        required: true
    },
    newGrossA: Number,
    newGrossB: Number,
    newGrossC: Number,

    // Previous Salary Reference (for audit)
    previousCtcVersionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmployeeCtcVersion'
    },
    previousTotalCTC: Number,

    // Change Summary
    absoluteChange: Number,
    percentageChange: Number,

    // Reason & Notes
    reason: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    notes: {
        type: String,
        trim: true,
        maxlength: 2000
    },

    // Status (Auto-calculated based on effectiveFrom)
    status: {
        type: String,
        enum: ['SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELLED'],
        default: 'SCHEDULED',
        index: true
    },

    // Audit Trail
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    approvedAt: Date,
    cancelledBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    cancelledAt: Date,
    cancellationReason: String

}, {
    timestamps: true,
    collection: 'salary_increments'
});

// Indexes for efficient queries
SalaryIncrementSchema.index({ companyId: 1, employeeId: 1, effectiveFrom: -1 });
SalaryIncrementSchema.index({ companyId: 1, status: 1, effectiveFrom: 1 });
SalaryIncrementSchema.index({ effectiveFrom: 1, status: 1 }); // For auto-activation cron

module.exports = SalaryIncrementSchema;
