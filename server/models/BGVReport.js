const mongoose = require('mongoose');

/**
 * BGV Report Model
 * Stores generated BGV reports (PDF/DOCX)
 * Immutable once generated
 */
const BGVReportSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    caseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BGVCase',
        required: true,
        index: true
    },

    // Report Classification
    reportType: {
        type: String,
        enum: ['SUMMARY', 'DETAILED', 'INDIVIDUAL_CHECK', 'FINAL'],
        required: true
    },

    // File Information
    fileName: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    fileFormat: {
        type: String,
        enum: ['PDF', 'DOCX', 'HTML'],
        default: 'PDF'
    },
    fileSize: {
        type: Number
    },

    // Report Content Summary
    summary: {
        totalChecks: Number,
        verifiedChecks: Number,
        failedChecks: Number,
        discrepancyChecks: Number,
        overallDecision: String,
        riskLevel: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH']
        }
    },

    // Generation Information
    generatedBy: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        userName: String
    },
    generatedAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Version Control
    version: {
        type: Number,
        default: 1
    },

    // Immutability
    isImmutable: {
        type: Boolean,
        default: true
    },

    // Metadata
    metadata: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'bgv_reports'
});

// Indexes
BGVReportSchema.index({ tenant: 1, caseId: 1, reportType: 1 });
BGVReportSchema.index({ generatedAt: -1 });

// Prevent modification of immutable reports
BGVReportSchema.pre('save', function (next) {
    if (!this.isNew && this.isImmutable) {
        return next(new Error('BGV Reports are immutable and cannot be modified'));
    }
    next();
});

module.exports = BGVReportSchema;
