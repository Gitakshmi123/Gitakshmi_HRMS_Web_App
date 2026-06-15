const mongoose = require('mongoose');

const PayrollInputSnapshotSchema = new mongoose.Schema({
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
    inputHash: {
        type: String,
        default: ''
    },
    salarySourceSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    payrollProfileSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    locationPolicySnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    statutoryRuleSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    taxProfileSnapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    attendanceSnapshotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceSnapshot',
        default: null
    },
    attendanceSummary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    attendanceRecordCount: {
        type: Number,
        default: 0
    },
    deductions: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    adjustments: {
        type: mongoose.Schema.Types.Mixed,
        default: []
    },
    inputBatchIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollInputBatch'
    }],
    phase2Snapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    runMetadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    warnings: {
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
    collection: 'payroll_input_snapshots'
});

PayrollInputSnapshotSchema.index({ tenantId: 1, payrollRunId: 1, employeeId: 1 });
PayrollInputSnapshotSchema.index({ tenantId: 1, employeeId: 1, year: -1, month: -1 });

module.exports = PayrollInputSnapshotSchema;
