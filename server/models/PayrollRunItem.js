const mongoose = require('mongoose');

const PayrollRunItemSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    payrollRunId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollRun',
        required: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    salaryTemplateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SalaryTemplate',
        required: false,
        default: null
    },
    payslipId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payslip',
        default: null
    },
    inputSnapshotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollInputSnapshot',
        default: null
    },
    calculationTraceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollCalculationTrace',
        default: null
    },
    runCode: {
        type: String,
        trim: true,
        default: ''
    },
    runType: {
        type: String,
        trim: true,
        default: 'FULL'
    },
    inputBatchIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollInputBatch'
    }],
    attendanceSummary: {
        totalDays: Number,
        daysPresent: Number,
        daysAbsent: Number,
        leaves: Number,
        holidays: Number
    },
    overtimeSummary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    phase2InputSummary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    exceptionFlags: {
        type: [String],
        default: []
    },
    calculatedGross: { type: Number, required: true },
    calculatedNet: { type: Number, required: true },
    status: {
        type: String,
        enum: ['Pending', 'Processed', 'Failed', 'GENERATED', 'LOCKED', 'PAID'],
        default: 'Pending'
    }
}, { timestamps: true });

// Compound index to prevent duplicates in a run
PayrollRunItemSchema.index({ payrollRunId: 1, employeeId: 1 }, { unique: true });

module.exports = PayrollRunItemSchema;
