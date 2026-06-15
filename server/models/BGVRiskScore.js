const mongoose = require('mongoose');

/**
 * BGV Risk Score Model
 * Tracks risk scoring for each BGV case
 * Dynamically calculates risk based on discrepancies
 */
const BGVRiskScoreSchema = new mongoose.Schema({
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
        unique: true,
        index: true
    },

    // Overall Risk Score
    totalRiskScore: {
        type: Number,
        default: 0,
        min: 0
    },
    riskLevel: {
        type: String,
        enum: ['CLEAR', 'LOW_RISK', 'MODERATE_RISK', 'HIGH_RISK', 'CRITICAL'],
        default: 'CLEAR'
    },

    // Risk Breakdown by Check Type
    checkRisks: [{
        checkId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'BGVCheck'
        },
        checkType: {
            type: String,
            enum: ['IDENTITY', 'ADDRESS', 'EMPLOYMENT', 'EDUCATION', 'CRIMINAL', 'REFERENCE', 'SOCIAL_MEDIA']
        },
        riskScore: {
            type: Number,
            default: 0
        },
        discrepancies: [{
            type: {
                type: String,
                enum: ['MINOR_MISMATCH', 'MAJOR_MISMATCH', 'MISSING_INFO', 'FAKE_DOCUMENT', 'CRIMINAL_RECORD', 'EMPLOYMENT_GAP', 'EDUCATION_FRAUD', 'REFERENCE_NEGATIVE']
            },
            severity: {
                type: String,
                enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
            },
            points: Number,
            description: String,
            detectedAt: {
                type: Date,
                default: Date.now
            },
            detectedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }
        }]
    }],

    // Risk Factors
    redFlags: [{
        category: String,
        description: String,
        severity: {
            type: String,
            enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
        },
        points: Number,
        source: String, // Which check raised this flag
        raisedAt: Date,
        raisedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],

    // Positive Indicators
    greenFlags: [{
        category: String,
        description: String,
        source: String,
        verifiedAt: Date
    }],

    // Risk Calculation History
    scoreHistory: [{
        previousScore: Number,
        newScore: Number,
        previousLevel: String,
        newLevel: String,
        reason: String,
        changedAt: {
            type: Date,
            default: Date.now
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }],

    // Final Assessment
    finalAssessment: {
        recommendation: {
            type: String,
            enum: ['APPROVE', 'APPROVE_WITH_CONDITIONS', 'REJECT', 'FURTHER_INVESTIGATION'],
            default: null
        },
        assessmentNotes: String,
        assessedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        assessedAt: Date
    },

    // Auto-calculation Settings
    autoCalculate: {
        type: Boolean,
        default: true
    },
    lastCalculatedAt: Date,

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'bgv_risk_scores'
});

// Indexes
BGVRiskScoreSchema.index({ tenant: 1, riskLevel: 1 });
BGVRiskScoreSchema.index({ totalRiskScore: 1 });

// Calculate risk level based on score
BGVRiskScoreSchema.methods.calculateRiskLevel = function () {
    const score = this.totalRiskScore;

    if (score === 0) {
        this.riskLevel = 'CLEAR';
    } else if (score > 0 && score <= 10) {
        this.riskLevel = 'LOW_RISK';
    } else if (score > 10 && score <= 25) {
        this.riskLevel = 'MODERATE_RISK';
    } else if (score > 25 && score <= 50) {
        this.riskLevel = 'HIGH_RISK';
    } else {
        this.riskLevel = 'CRITICAL';
    }

    return this.riskLevel;
};

// Add discrepancy and recalculate score
BGVRiskScoreSchema.methods.addDiscrepancy = function (checkId, checkType, discrepancy, user) {
    // Find or create check risk entry
    let checkRisk = this.checkRisks.find(cr => cr.checkId.toString() === checkId.toString());

    if (!checkRisk) {
        checkRisk = {
            checkId,
            checkType,
            riskScore: 0,
            discrepancies: []
        };
        this.checkRisks.push(checkRisk);
    }

    // Add discrepancy
    checkRisk.discrepancies.push({
        ...discrepancy,
        detectedAt: new Date(),
        detectedBy: user
    });

    // Update check risk score
    checkRisk.riskScore += discrepancy.points;

    // Recalculate total
    this.recalculateTotal(user);
};

// Recalculate total risk score
BGVRiskScoreSchema.methods.recalculateTotal = function (user) {
    const oldScore = this.totalRiskScore;
    const oldLevel = this.riskLevel;

    // Sum all check risks
    this.totalRiskScore = this.checkRisks.reduce((sum, cr) => sum + cr.riskScore, 0);

    // Add red flag points
    this.totalRiskScore += this.redFlags.reduce((sum, rf) => sum + rf.points, 0);

    // Calculate new level
    this.calculateRiskLevel();

    // Log history
    if (oldScore !== this.totalRiskScore) {
        this.scoreHistory.push({
            previousScore: oldScore,
            newScore: this.totalRiskScore,
            previousLevel: oldLevel,
            newLevel: this.riskLevel,
            reason: 'Discrepancy added or risk recalculated',
            changedAt: new Date(),
            changedBy: user
        });
    }

    this.lastCalculatedAt = new Date();
};

// Static: Risk point values
BGVRiskScoreSchema.statics.RISK_POINTS = {
    MINOR_MISMATCH: 5,
    MAJOR_MISMATCH: 15,
    MISSING_INFO: 10,
    FAKE_DOCUMENT: 40,
    CRIMINAL_RECORD: 60,
    EMPLOYMENT_GAP: 8,
    EDUCATION_FRAUD: 50,
    REFERENCE_NEGATIVE: 20
};

module.exports = BGVRiskScoreSchema;
