/**
 * BGV Risk Scoring Engine
 * Calculates and manages risk scores for BGV cases
 * Enterprise-grade risk assessment with configurable rules
 */

class BGVRiskEngine {

    /**
     * Risk point values for different discrepancy types
     */
    static RISK_POINTS = {
        // Identity Discrepancies
        MINOR_DATE_MISMATCH: 5,
        NAME_SPELLING_VARIATION: 3,
        MAJOR_NAME_MISMATCH: 20,
        ID_NUMBER_MISMATCH: 40,
        FAKE_IDENTITY_DOCUMENT: 60,

        // Address Discrepancies
        ADDRESS_MINOR_VARIATION: 5,
        ADDRESS_MAJOR_MISMATCH: 15,
        UNVERIFIABLE_ADDRESS: 25,

        // Employment Discrepancies
        EMPLOYMENT_GAP_MINOR: 8,
        EMPLOYMENT_GAP_MAJOR: 15,
        SALARY_MISMATCH_MINOR: 10,
        SALARY_MISMATCH_MAJOR: 20,
        FAKE_EMPLOYER: 50,
        NEGATIVE_REFERENCE: 25,
        TERMINATION_FOR_CAUSE: 30,

        // Education Discrepancies
        DEGREE_YEAR_MISMATCH: 10,
        DEGREE_NAME_MISMATCH: 15,
        UNVERIFIED_UNIVERSITY: 20,
        FAKE_DEGREE: 50,
        EDUCATION_FRAUD: 60,

        // Criminal Record
        MINOR_OFFENSE: 20,
        MAJOR_OFFENSE: 40,
        SERIOUS_CRIME: 60,
        PENDING_CASE: 30,

        // Reference Discrepancies
        REFERENCE_UNREACHABLE: 10,
        REFERENCE_NEGATIVE_FEEDBACK: 20,
        REFERENCE_FAKE: 40,

        // Social Media
        INAPPROPRIATE_CONTENT: 15,
        CONFLICTING_INFORMATION: 10,
        REPUTATION_RISK: 25,

        // General
        MISSING_INFORMATION: 10,
        DOCUMENT_QUALITY_POOR: 5,
        INCONSISTENT_DATA: 12
    };

    /**
     * Risk level thresholds
     */
    static RISK_LEVELS = {
        CLEAR: { min: 0, max: 0 },
        LOW_RISK: { min: 1, max: 10 },
        MODERATE_RISK: { min: 11, max: 25 },
        HIGH_RISK: { min: 26, max: 50 },
        CRITICAL: { min: 51, max: Infinity }
    };

    /**
     * Calculate risk level from score
     */
    static calculateRiskLevel(score) {
        for (const [level, range] of Object.entries(this.RISK_LEVELS)) {
            if (score >= range.min && score <= range.max) {
                return level;
            }
        }
        return 'CRITICAL';
    }

    /**
     * Get severity from discrepancy type
     */
    static getSeverity(discrepancyType) {
        const points = this.RISK_POINTS[discrepancyType] || 0;

        if (points === 0) return 'LOW';
        if (points <= 10) return 'LOW';
        if (points <= 25) return 'MEDIUM';
        if (points <= 40) return 'HIGH';
        return 'CRITICAL';
    }

    /**
     * Initialize risk score for a new BGV case
     */
    static async initializeRiskScore(BGVRiskScore, caseId, tenantId) {
        const existingRisk = await BGVRiskScore.findOne({ caseId });

        if (existingRisk) {
            return existingRisk;
        }

        const riskScore = new BGVRiskScore({
            tenant: tenantId,
            caseId,
            totalRiskScore: 0,
            riskLevel: 'CLEAR',
            checkRisks: [],
            redFlags: [],
            greenFlags: [],
            scoreHistory: [],
            autoCalculate: true
        });

        await riskScore.save();
        return riskScore;
    }

    /**
     * Add a discrepancy and update risk score
     */
    static async addDiscrepancy(BGVRiskScore, caseId, checkId, checkType, discrepancyData, user) {
        const riskScore = await BGVRiskScore.findOne({ caseId });

        if (!riskScore) {
            throw new Error('Risk score not initialized for this case');
        }

        const points = this.RISK_POINTS[discrepancyData.type] || 0;
        const severity = this.getSeverity(discrepancyData.type);

        const discrepancy = {
            type: discrepancyData.type,
            severity,
            points,
            description: discrepancyData.description,
            detectedAt: new Date(),
            detectedBy: user
        };

        riskScore.addDiscrepancy(checkId, checkType, discrepancy, user);
        await riskScore.save();

        return riskScore;
    }

    /**
     * Add a red flag
     */
    static async addRedFlag(BGVRiskScore, caseId, flagData, user) {
        const riskScore = await BGVRiskScore.findOne({ caseId });

        if (!riskScore) {
            throw new Error('Risk score not initialized for this case');
        }

        const points = this.RISK_POINTS[flagData.type] || 15;
        const severity = this.getSeverity(flagData.type);

        riskScore.redFlags.push({
            category: flagData.category,
            description: flagData.description,
            severity,
            points,
            source: flagData.source,
            raisedAt: new Date(),
            raisedBy: user
        });

        riskScore.recalculateTotal(user);
        await riskScore.save();

        return riskScore;
    }

    /**
     * Add a green flag (positive indicator)
     */
    static async addGreenFlag(BGVRiskScore, caseId, flagData) {
        const riskScore = await BGVRiskScore.findOne({ caseId });

        if (!riskScore) {
            throw new Error('Risk score not initialized for this case');
        }

        riskScore.greenFlags.push({
            category: flagData.category,
            description: flagData.description,
            source: flagData.source,
            verifiedAt: new Date()
        });

        await riskScore.save();
        return riskScore;
    }

    /**
     * Get risk assessment summary
     */
    static async getRiskAssessment(BGVRiskScore, caseId) {
        const riskScore = await BGVRiskScore.findOne({ caseId })
            .populate('checkRisks.checkId')
            .lean();

        if (!riskScore) {
            return null;
        }

        const totalDiscrepancies = riskScore.checkRisks.reduce(
            (sum, cr) => sum + cr.discrepancies.length,
            0
        );

        const criticalIssues = [
            ...riskScore.checkRisks.flatMap(cr =>
                cr.discrepancies.filter(d => d.severity === 'CRITICAL')
            ),
            ...riskScore.redFlags.filter(rf => rf.severity === 'CRITICAL')
        ];

        return {
            totalRiskScore: riskScore.totalRiskScore,
            riskLevel: riskScore.riskLevel,
            totalDiscrepancies,
            criticalIssuesCount: criticalIssues.length,
            redFlagsCount: riskScore.redFlags.length,
            greenFlagsCount: riskScore.greenFlags.length,
            recommendation: this.getRecommendation(riskScore),
            checkBreakdown: riskScore.checkRisks.map(cr => ({
                checkType: cr.checkType,
                riskScore: cr.riskScore,
                discrepancyCount: cr.discrepancies.length
            }))
        };
    }

    /**
     * Get hiring recommendation based on risk score
     */
    static getRecommendation(riskScore) {
        const level = riskScore.riskLevel;
        const criticalCount = riskScore.redFlags.filter(rf => rf.severity === 'CRITICAL').length;

        if (level === 'CLEAR') {
            return 'APPROVE';
        }

        if (level === 'LOW_RISK') {
            return 'APPROVE';
        }

        if (level === 'MODERATE_RISK') {
            if (criticalCount === 0) {
                return 'APPROVE_WITH_CONDITIONS';
            }
            return 'FURTHER_INVESTIGATION';
        }

        if (level === 'HIGH_RISK') {
            return 'FURTHER_INVESTIGATION';
        }

        if (level === 'CRITICAL') {
            return 'REJECT';
        }

        return 'FURTHER_INVESTIGATION';
    }

    /**
     * Recalculate risk score for entire case
     */
    static async recalculateRiskScore(BGVRiskScore, caseId, user) {
        const riskScore = await BGVRiskScore.findOne({ caseId });

        if (!riskScore) {
            throw new Error('Risk score not initialized for this case');
        }

        riskScore.recalculateTotal(user);
        await riskScore.save();

        return riskScore;
    }
}

module.exports = BGVRiskEngine;
