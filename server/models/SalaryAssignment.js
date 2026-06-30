const mongoose = require('mongoose');

/**
 * SalaryAssignment Model
 * Tracks the history of salary template assignments to employees.
 * Allows for future-dating salary changes and keeping a record of past structures.
 */
const SalaryAssignmentSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: false,
        index: true
    },
    applicantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Applicant',
        required: false,
        index: true
    },
    salaryTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalaryTemplate',
        required: false
    },
    ctcAnnual: { type: Number, required: true },
    monthlyCTC: { type: Number, required: true },

    // Breakup data
    earnings: [{ name: String, monthlyAmount: Number, annualAmount: Number, code: String }],
    deductions: [{ name: String, monthlyAmount: Number, annualAmount: Number, code: String }],
    benefits: [{ name: String, monthlyAmount: Number, annualAmount: Number, code: String }],
    
    // Store original breakup result for high-fidelity audits
    breakup: { type: mongoose.Schema.Types.Mixed },
    
    category: { type: String }, // UNSKILLED, SEMI_SKILLED, SKILLED
    state: { type: String },    // GUJARAT, etc.

    netSalaryMonthly: { type: Number },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    isConfirmed: { type: Boolean, default: false },
    isCurrent: { type: Boolean, default: true },

    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

// Index for finding the active assignment for a specific date
SalaryAssignmentSchema.index({ tenantId: 1, employeeId: 1, effectiveFrom: -1 });

module.exports = SalaryAssignmentSchema;
