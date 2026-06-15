const mongoose = require('mongoose');

const TraceStepSchema = new mongoose.Schema({
    order: { type: Number, default: 0 },
    code: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    formula: { type: String, trim: true },
    inputs: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const PayrollCalculationTraceSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    payrollRunId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollRun',
        default: null,
        index: true
    },
    payslipId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payslip',
        default: null,
        index: true
    },
    inputSnapshotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollInputSnapshot',
        default: null,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
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
    mode: {
        type: String,
        enum: ['PREVIEW', 'RUN'],
        default: 'RUN'
    },
    steps: {
        type: [TraceStepSchema],
        default: []
    },
    summary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    warnings: {
        type: [String],
        default: []
    },
    errors: {
        type: [String],
        default: []
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, {
    timestamps: true,
    collection: 'payroll_calculation_traces',
    suppressReservedKeysWarning: true
});

PayrollCalculationTraceSchema.index({ tenantId: 1, payrollRunId: 1, employeeId: 1 });
PayrollCalculationTraceSchema.index({ tenantId: 1, employeeId: 1, year: -1, month: -1 });

module.exports = PayrollCalculationTraceSchema;
