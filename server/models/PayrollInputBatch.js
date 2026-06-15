const mongoose = require('mongoose');

const ApprovalCommentSchema = new mongoose.Schema({
    action: {
        type: String,
        enum: ['CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED', 'RELEASED', 'CANCELLED'],
        required: true
    },
    comment: {
        type: String,
        trim: true,
        default: ''
    },
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    actedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const PayrollInputItemSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    inputType: {
        type: String,
        enum: [
            'OVERTIME',
            'VARIABLE_PAY',
            'BONUS',
            'INCENTIVE',
            'REIMBURSEMENT',
            'ARREAR',
            'FINAL_SETTLEMENT',
            'SHIFT_ALLOWANCE',
            'NIGHT_SHIFT_ALLOWANCE',
            'MANUAL_EARNING',
            'MANUAL_DEDUCTION',
            'LOAN_RECOVERY',
            'ADVANCE_RECOVERY',
            'EMPLOYER_CONTRIBUTION',
            'ATTENDANCE_ADJUSTMENT',
            'MANUAL_ADJUSTMENT',
            'OTHER'
        ],
        default: 'OTHER'
    },
    classification: {
        type: String,
        enum: ['EARNING', 'PRE_TAX_DEDUCTION', 'POST_TAX_DEDUCTION', 'EMPLOYER_CONTRIBUTION', 'REIMBURSEMENT'],
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    amount: {
        type: Number,
        default: 0
    },
    quantity: {
        type: Number,
        default: 1
    },
    rate: {
        type: Number,
        default: null
    },
    taxable: {
        type: Boolean,
        default: true
    },
    affectsBasic: {
        type: Boolean,
        default: false
    },
    componentCode: {
        type: String,
        trim: true,
        default: ''
    },
    effectiveDate: {
        type: Date,
        default: null
    },
    attendanceDate: {
        type: Date,
        default: null
    },
    attendanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Attendance',
        default: null
    },
    shiftId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Shift',
        default: null
    },
    costCenter: {
        type: String,
        trim: true,
        default: ''
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: true });

const PayrollInputBatchSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    batchCode: {
        type: String,
        trim: true,
        uppercase: true,
        required: true
    },
    name: {
        type: String,
        trim: true,
        required: true
    },
    source: {
        type: String,
        enum: ['MANUAL', 'ATTENDANCE', 'REIMBURSEMENT', 'ARREAR', 'VARIABLE_PAY', 'FINAL_SETTLEMENT', 'SYSTEM'],
        default: 'MANUAL'
    },
    runScope: {
        type: String,
        enum: ['MONTHLY', 'OFF_CYCLE', 'AMENDMENT', 'ANY'],
        default: 'ANY'
    },
    usagePolicy: {
        type: String,
        enum: ['ONE_TIME', 'RECURRING'],
        default: 'ONE_TIME'
    },
    month: {
        type: Number,
        required: true,
        min: 1,
        max: 12
    },
    year: {
        type: Number,
        required: true,
        min: 2000,
        max: 2100
    },
    periodKey: {
        type: String,
        trim: true,
        index: true
    },
    periodStart: {
        type: Date,
        required: true
    },
    periodEnd: {
        type: Date,
        required: true
    },
    payDate: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RELEASED', 'REJECTED', 'CANCELLED'],
        default: 'DRAFT',
        index: true
    },
    summary: {
        employeeCount: { type: Number, default: 0 },
        itemCount: { type: Number, default: 0 },
        totalEarnings: { type: Number, default: 0 },
        totalPreTaxDeductions: { type: Number, default: 0 },
        totalPostTaxDeductions: { type: Number, default: 0 },
        totalReimbursements: { type: Number, default: 0 },
        totalEmployerContributions: { type: Number, default: 0 }
    },
    items: {
        type: [PayrollInputItemSchema],
        default: []
    },
    appliedRunIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollRun'
    }],
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    submittedAt: {
        type: Date,
        default: null
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    approvedAt: {
        type: Date,
        default: null
    },
    releasedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    releasedAt: {
        type: Date,
        default: null
    },
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    rejectedAt: {
        type: Date,
        default: null
    },
    rejectionReason: {
        type: String,
        trim: true,
        default: ''
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    approvalComments: {
        type: [ApprovalCommentSchema],
        default: []
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    }
}, {
    timestamps: true,
    collection: 'payroll_input_batches'
});

PayrollInputBatchSchema.index({ tenantId: 1, batchCode: 1 }, { unique: true });
PayrollInputBatchSchema.index({ tenantId: 1, year: -1, month: -1, status: 1 });
PayrollInputBatchSchema.index({ tenantId: 1, 'items.employeeId': 1, year: -1, month: -1 });

module.exports = PayrollInputBatchSchema;
