const mongoose = require('mongoose');

const PayrollExportArtifactSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    payrollRunId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollRun',
        required: true,
        index: true
    },
    artifactType: {
        type: String,
        enum: [
            'BANK_TRANSFER',
            'ACCOUNTING_SUMMARY',
            'COMPLIANCE_PF',
            'COMPLIANCE_ESI',
            'COMPLIANCE_TDS',
            'EXCEPTION_REPORT',
            'VARIANCE_REPORT'
        ],
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['GENERATED', 'SUPERSEDED'],
        default: 'GENERATED',
        index: true
    },
    format: {
        type: String,
        enum: ['JSON', 'CSV'],
        default: 'JSON'
    },
    fileName: {
        type: String,
        trim: true,
        default: ''
    },
    checksum: {
        type: String,
        trim: true,
        default: ''
    },
    rowCount: {
        type: Number,
        default: 0
    },
    summary: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    generatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    generatedAt: {
        type: Date,
        default: Date.now
    },
    supersededByArtifactId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PayrollExportArtifact',
        default: null
    }
}, {
    timestamps: true,
    collection: 'payroll_export_artifacts'
});

PayrollExportArtifactSchema.index({ tenantId: 1, payrollRunId: 1, artifactType: 1, status: 1 });

module.exports = PayrollExportArtifactSchema;
