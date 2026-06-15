/**
 * BGV Risk Score Controller
 * Manages risk scoring, discrepancies, and risk assessment
 */

const { getBGVModels } = require('../utils/bgvModels');
const BGVRiskEngine = require('../services/BGVRiskEngine');

/**
 * Get risk score for a case
 * GET /api/bgv/case/:caseId/risk-score
 */
exports.getRiskScore = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { BGVRiskScore } = await getBGVModels(req);

        const riskScore = await BGVRiskScore.findOne({ caseId })
            .populate('checkRisks.checkId', 'type status')
            .populate('redFlags.raisedBy', 'name email')
            .populate('scoreHistory.changedBy', 'name email')
            .lean();

        if (!riskScore) {
            // Instead of 404, return a default "CLEAR" score to avoid breaking the UI
            return res.json({
                success: true,
                data: {
                    riskScore: {
                        caseId,
                        totalRiskScore: 0,
                        riskLevel: 'CLEAR',
                        checkRisks: [],
                        redFlags: [],
                        greenFlags: [],
                        scoreHistory: []
                    },
                    assessment: {
                        riskLevel: 'CLEAR',
                        totalPoints: 0,
                        summary: "No risk factors identified yet.",
                        recommendation: "PROCEED",
                        criticalAlerts: [],
                        warnings: []
                    }
                }
            });
        }

        // Get assessment summary
        const assessment = await BGVRiskEngine.getRiskAssessment(BGVRiskScore, caseId);

        res.json({
            success: true,
            data: {
                riskScore,
                assessment
            }
        });

    } catch (err) {
        console.error('[BGV_RISK_GET_ERROR]', err);
        next(err);
    }
};

/**
 * Add discrepancy to a check
 * POST /api/bgv/check/:checkId/add-discrepancy
 */
exports.addDiscrepancy = async (req, res, next) => {
    try {
        const { checkId } = req.params;
        const { type, description } = req.body;

        const { BGVCheck, BGVRiskScore, BGVTimeline } = await getBGVModels(req);

        // Get check
        const check = await BGVCheck.findById(checkId);
        if (!check) {
            return res.status(404).json({
                success: false,
                message: "Check not found"
            });
        }

        // Validate discrepancy type
        if (!BGVRiskEngine.RISK_POINTS[type]) {
            return res.status(400).json({
                success: false,
                message: `Invalid discrepancy type: ${type}`,
                validTypes: Object.keys(BGVRiskEngine.RISK_POINTS)
            });
        }

        // Add discrepancy
        const discrepancyData = {
            type,
            description
        };

        const riskScore = await BGVRiskEngine.addDiscrepancy(
            BGVRiskScore,
            check.caseId,
            checkId,
            check.type,
            discrepancyData,
            req.user?._id || req.user?.id
        );

        // Create timeline entry
        await BGVTimeline.create({
            tenant: req.tenantId,
            caseId: check.caseId,
            checkId,
            eventType: 'DISCREPANCY_DETECTED',
            title: `Discrepancy Detected: ${type}`,
            description,
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name,
                userRole: req.user?.role
            },
            visibleTo: ['HR', 'ADMIN'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata: {
                discrepancyType: type,
                points: BGVRiskEngine.RISK_POINTS[type],
                newRiskScore: riskScore.totalRiskScore,
                newRiskLevel: riskScore.riskLevel
            }
        });

        res.json({
            success: true,
            message: "Discrepancy added successfully",
            data: {
                discrepancyType: type,
                points: BGVRiskEngine.RISK_POINTS[type],
                totalRiskScore: riskScore.totalRiskScore,
                riskLevel: riskScore.riskLevel
            }
        });

    } catch (err) {
        console.error('[BGV_ADD_DISCREPANCY_ERROR]', err);
        next(err);
    }
};

/**
 * Add red flag to case
 * POST /api/bgv/case/:caseId/add-red-flag
 */
exports.addRedFlag = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { category, description, type, source } = req.body;

        const { BGVRiskScore, BGVTimeline } = await getBGVModels(req);

        const flagData = {
            category,
            description,
            type,
            source
        };

        const riskScore = await BGVRiskEngine.addRedFlag(
            BGVRiskScore,
            caseId,
            flagData,
            req.user?._id || req.user?.id
        );

        // Create timeline entry
        await BGVTimeline.create({
            tenant: req.tenantId,
            caseId,
            eventType: 'RED_FLAG_RAISED',
            title: `Red Flag: ${category}`,
            description,
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name,
                userRole: req.user?.role
            },
            visibleTo: ['HR', 'ADMIN'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata: {
                category,
                severity: BGVRiskEngine.getSeverity(type),
                newRiskScore: riskScore.totalRiskScore,
                newRiskLevel: riskScore.riskLevel
            }
        });

        res.json({
            success: true,
            message: "Red flag added successfully",
            data: {
                category,
                severity: BGVRiskEngine.getSeverity(type),
                totalRiskScore: riskScore.totalRiskScore,
                riskLevel: riskScore.riskLevel
            }
        });

    } catch (err) {
        console.error('[BGV_ADD_RED_FLAG_ERROR]', err);
        next(err);
    }
};

/**
 * Add green flag (positive indicator)
 * POST /api/bgv/case/:caseId/add-green-flag
 */
exports.addGreenFlag = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { category, description, source } = req.body;

        const { BGVRiskScore, BGVTimeline } = await getBGVModels(req);

        const flagData = {
            category,
            description,
            source
        };

        const riskScore = await BGVRiskEngine.addGreenFlag(
            BGVRiskScore,
            caseId,
            flagData
        );

        // Create timeline entry
        await BGVTimeline.create({
            tenant: req.tenantId,
            caseId,
            eventType: 'GREEN_FLAG_ADDED',
            title: `Positive Indicator: ${category}`,
            description,
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name,
                userRole: req.user?.role
            },
            visibleTo: ['ALL'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: "Green flag added successfully",
            data: {
                category,
                greenFlagsCount: riskScore.greenFlags.length
            }
        });

    } catch (err) {
        console.error('[BGV_ADD_GREEN_FLAG_ERROR]', err);
        next(err);
    }
};

/**
 * Get risk assessment summary
 * GET /api/bgv/case/:caseId/risk-assessment
 */
exports.getRiskAssessment = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { BGVRiskScore } = await getBGVModels(req);

        const assessment = await BGVRiskEngine.getRiskAssessment(BGVRiskScore, caseId);

        if (!assessment) {
            return res.json({
                success: true,
                data: {
                    riskLevel: 'CLEAR',
                    totalPoints: 0,
                    summary: "No risk factors identified yet.",
                    recommendation: "PROCEED",
                    criticalAlerts: [],
                    warnings: []
                }
            });
        }

        res.json({
            success: true,
            data: assessment
        });

    } catch (err) {
        console.error('[BGV_RISK_ASSESSMENT_ERROR]', err);
        next(err);
    }
};

/**
 * Recalculate risk score
 * POST /api/bgv/case/:caseId/recalculate-risk
 */
exports.recalculateRisk = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { BGVRiskScore } = await getBGVModels(req);

        const riskScore = await BGVRiskEngine.recalculateRiskScore(
            BGVRiskScore,
            caseId,
            req.user?._id || req.user?.id
        );

        res.json({
            success: true,
            message: "Risk score recalculated successfully",
            data: {
                totalRiskScore: riskScore.totalRiskScore,
                riskLevel: riskScore.riskLevel,
                lastCalculatedAt: riskScore.lastCalculatedAt
            }
        });

    } catch (err) {
        console.error('[BGV_RECALCULATE_RISK_ERROR]', err);
        next(err);
    }
};

/**
 * Get risk dashboard (all cases)
 * GET /api/bgv/risk-dashboard
 */
exports.getRiskDashboard = async (req, res, next) => {
    try {
        const { BGVRiskScore, BGVCase } = await getBGVModels(req);

        // Get all risk scores
        const riskScores = await BGVRiskScore.find({ tenant: req.tenantId })
            .populate('caseId', 'caseId overallStatus')
            .lean();

        // Group by risk level
        const summary = {
            CLEAR: 0,
            LOW_RISK: 0,
            MODERATE_RISK: 0,
            HIGH_RISK: 0,
            CRITICAL: 0
        };

        riskScores.forEach(rs => {
            summary[rs.riskLevel] = (summary[rs.riskLevel] || 0) + 1;
        });

        // Get high-risk cases
        const highRiskCases = riskScores
            .filter(rs => ['HIGH_RISK', 'CRITICAL'].includes(rs.riskLevel))
            .map(rs => ({
                caseId: rs.caseId?.caseId,
                riskLevel: rs.riskLevel,
                totalRiskScore: rs.totalRiskScore,
                redFlagsCount: rs.redFlags?.length || 0
            }));

        res.json({
            success: true,
            data: {
                summary,
                totalCases: riskScores.length,
                highRiskCases,
                averageRiskScore: riskScores.reduce((sum, rs) => sum + rs.totalRiskScore, 0) / riskScores.length || 0
            }
        });

    } catch (err) {
        console.error('[BGV_RISK_DASHBOARD_ERROR]', err);
        next(err);
    }
};

/**
 * Get available discrepancy types
 * GET /api/bgv/discrepancy-types
 */
exports.getDiscrepancyTypes = async (req, res, next) => {
    try {
        const types = Object.entries(BGVRiskEngine.RISK_POINTS).map(([type, points]) => ({
            type,
            points,
            severity: BGVRiskEngine.getSeverity(type)
        }));

        res.json({
            success: true,
            data: types
        });

    } catch (err) {
        console.error('[BGV_DISCREPANCY_TYPES_ERROR]', err);
        next(err);
    }
};
