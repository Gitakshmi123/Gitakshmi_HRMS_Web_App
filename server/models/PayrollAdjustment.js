const mongoose = require('mongoose');

/**
 * Payroll Adjustment Schema
 * 
 * Stores corrections and one-time adjustments that modify the Net Pay 
 * of a future payroll cycle. This ensures historical payroll (Runs/Payslips)
 * remains immutable and audit-compliant.
 */
const PayrollAdjustmentSchema = new mongoose.Schema({
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
    // The original payroll run that needed correction (if applicable)
    payrollRunId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollRun',
        index: true
    },
    originalPayslipId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payslip',
        default: null,
        index: true
    },
    // The month the adjustment will be PAID (YYYY-MM)
    adjustmentMonth: {
        type: String, // e.g., "2024-03"
        required: true,
        index: true
    },
    // Reason for correction
    adjustmentType: {
        type: String,
        enum: [
            'ATTENDANCE_CORRECTION',
            'ALLOWANCE_MISSED',
            'ALLOWANCE_EXTRA_RECOVERY',
            'DEDUCTION_ERROR',
            'SALARY_INCREMENT_BACKDATED',
            'MANUAL_ADJUSTMENT',
            'BONUS_ARREAR',
            'OTHER'
        ],
        required: true
    },
    // Amount to ADD (positive) or DEDUCT (negative)
    adjustmentAmount: {
        type: Number,
        required: true,
        default: 0
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'APPLIED', 'CANCELLED'],
        default: 'PENDING_APPROVAL',
        index: true
    },
    // Maker-Checker approval fields
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    approvedAt: {
        type: Date
    },
    approvalReason: {
        type: String,
        trim: true
    },
    // Reference to the payslip where this was finally applied
    appliedInPayslipId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payslip'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    metadata: {
        originalGross: Number,
        originalNet: Number,
        correctedBy: String,
        amendmentType: String,
        originalMonth: String
    }
}, {
    timestamps: true,
    collection: 'payroll_adjustments'
});

// Index for fetching adjustments for a payroll run
PayrollAdjustmentSchema.index({ companyId: 1, adjustmentMonth: 1, status: 1 });

module.exports = PayrollAdjustmentSchema;
