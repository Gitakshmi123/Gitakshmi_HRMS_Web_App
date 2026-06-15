/**
 * BGV Consent Controller
 * Handles digital consent capture, validation, and withdrawal
 */

const mongoose = require('mongoose');
const { getBGVModels } = require('../utils/bgvModels');

/**
 * Capture digital consent from candidate
 * POST /api/bgv/case/:caseId/consent
 */
exports.captureConsent = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        // console.log(`[BGV_CONSENT][DEBUG] captureConsent request for case ${caseId}:`, req.body);
        const {
            consentGiven,
            signatureType,
            signatureData,
            scopeAgreed,
            location
        } = req.body;

        // 1. First, try to get models with what we have
        let models;
        try {
            models = await getBGVModels(req);
        } catch (e) {
            console.warn('⚠️ [BGV_CONSENT] req.tenantDB missing, attempting fallback for PSA/SuperAdmin');
            const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
            if (!tenantId) {
                console.error('❌ [BGV_CONSENT] No tenant context available in headers/query');
                return res.status(400).json({
                    success: false,
                    message: "Tenant context (X-Tenant-ID header) is required for PSA users to access BGV consent capture."
                });
            }
            models = await getBGVModels(tenantId);
        }

        const { BGVCase, BGVConsent, BGVTimeline } = models;
        const tenantToUse = req.tenantId || (models.db && models.db.name); // models might not have tenantId directly

        // 2. Verify case exists
        const bgvCase = await BGVCase.findById(caseId);
        if (!bgvCase) {
            console.error(`❌ [BGV_CONSENT] BGV Case not found: ${caseId}`);
            return res.status(404).json({ success: false, message: "BGV Case not found" });
        }

        // Check if consent already exists
        const existingConsent = await BGVConsent.findOne({ caseId });
        if (existingConsent && !existingConsent.isWithdrawn) {
            console.warn(`[BGV_CONSENT] Consent already exists for case: ${caseId}`);
            return res.status(400).json({
                success: false,
                message: "Consent already captured for this case"
            });
        }

        // Get candidate ID (Ensure it's a valid ObjectId)
        const candidateId = bgvCase.candidateId || bgvCase.employeeId || bgvCase.applicationId;
        // console.log(`[BGV_CONSENT] Resolved candidateId: ${candidateId} (Type: ${bgvCase.candidateId ? 'Candidate' : bgvCase.employeeId ? 'Employee' : 'Applicant'})`);

        if (!candidateId) {
            console.error('❌ [BGV_CONSENT] Case is not linked to any candidate, applicant or employee');
            return res.status(400).json({ success: false, message: "Case is not linked to any valid identity (Candidate/Employee/Applicant)" });
        }

        // Prepare consent text (should be from a template)
        const consentText = `I hereby authorize the company to conduct background verification checks including identity, address, employment, education, criminal records, and references. I understand that this information will be used solely for employment verification purposes.`;

        // Create consent record
        const consent = new BGVConsent({
            tenant: bgvCase.tenant || req.tenantId || tenantToUse,
            caseId,
            candidateId,
            consentGiven: consentGiven === true,
            consentTextVersion: process.env.BGV_CONSENT_VERSION || 'v1.0',
            consentText,
            signatureType: signatureType || 'TYPED_NAME',
            signatureData: signatureData || 'REQUIRED_SIGNATURE_MISSING',
            consentTimestamp: new Date(),
            ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || '0.0.0.0',
            userAgent: req.get('user-agent'),
            deviceInfo: {
                browser: req.get('user-agent')?.split(' ')[0] || 'Unknown',
                os: req.get('user-agent')?.includes('Windows') ? 'Windows' :
                    req.get('user-agent')?.includes('Mac') ? 'Mac' : 'Other'
            },
            location: location || {},
            scopeAgreed: scopeAgreed || [],
            isImmutable: true
        });

        // console.log(`[BGV_CONSENT] Attempting to save consent for case: ${caseId}`);
        try {
            await consent.save();
        } catch (saveErr) {
            console.error('❌ [BGV_CONSENT_SAVE_ERROR] Multi-tenant BGV Save Failed:');
            console.dir(saveErr, { depth: null });
            return res.status(400).json({
                success: false,
                message: "Validation failed during consent capture",
                error: saveErr.message,
                details: saveErr.errors ? Object.keys(saveErr.errors).map(k => `${k}: ${saveErr.errors[k].message}`) : null
            });
        }

        // Update BGV case with consent flag
        try {
            bgvCase.consentCaptured = true;
            bgvCase.consentCapturedAt = new Date();
            await bgvCase.save();
            // console.log(`[BGV_CONSENT] BGV Case updated with consent status: ${caseId}`);
        } catch (caseUpdateErr) {
            console.warn('⚠️ [BGV_CONSENT_CASE_UPDATE_WARN] Failed to update BGV Case record (non-critical):', caseUpdateErr.message);
        }

        // Create timeline entry
        try {
            await BGVTimeline.create({
                tenant: bgvCase.tenant || req.tenantId || tenantToUse,
                caseId,
                eventType: 'CONSENT_CAPTURED',
                title: 'Digital Consent Captured',
                description: `Candidate provided consent via ${signatureType}`,
                performedBy: {
                    userId: mongoose.Types.ObjectId.isValid(candidateId) ? candidateId : null,
                    userName: 'Candidate',
                    userRole: 'CANDIDATE'
                },
                visibleTo: ['ALL'],
                ipAddress: req.ip || '0.0.0.0',
                userAgent: req.get('user-agent'),
                metadata: { consentId: consent._id }
            });
        } catch (timelineErr) {
            console.warn('⚠️ [BGV_CONSENT_TIMELINE_WARN] Timeline entry failed (non-critical):', timelineErr.message);
        }

        // console.log(`✅ [BGV_CONSENT] Consent captured successfully for caseId: ${caseId}`);
        res.json({
            success: true,
            message: "Consent captured successfully",
            data: {
                consentId: consent._id,
                consentGiven: consent.consentGiven,
                consentTimestamp: consent.consentTimestamp
            }
        });

    } catch (err) {
        console.error('❌ [BGV_CONSENT_CAPTURE_FATAL_ERROR]', err);
        if (!res.headersSent) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
};

/**
 * Get consent details for a case
 * GET /api/bgv/case/:caseId/consent
 */
exports.getConsent = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { BGVConsent } = await getBGVModels(req);

        const consent = await BGVConsent.findOne({ caseId })
            .populate('candidateId', 'name email')
            .lean();

        if (!consent) {
            return res.status(404).json({
                success: false,
                message: "No consent found for this case"
            });
        }

        // Don't expose signature data in GET request for security
        const safeConsent = {
            ...consent,
            signatureData: consent.signatureType === 'DIGITAL_SIGNATURE' ? '[REDACTED]' : consent.signatureData,
            isValid: consent.consentGiven && !consent.isWithdrawn
        };

        res.json({
            success: true,
            data: safeConsent
        });

    } catch (err) {
        console.error('[BGV_CONSENT_GET_ERROR]', err);
        next(err);
    }
};

/**
 * Withdraw consent
 * POST /api/bgv/case/:caseId/consent/withdraw
 */
exports.withdrawConsent = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { withdrawalReason } = req.body;

        const { BGVCase, BGVConsent, BGVTimeline } = await getBGVModels(req);

        const consent = await BGVConsent.findOne({ caseId });
        if (!consent) {
            return res.status(404).json({
                success: false,
                message: "No consent found for this case"
            });
        }

        if (consent.isWithdrawn) {
            return res.status(400).json({
                success: false,
                message: "Consent already withdrawn"
            });
        }

        // Withdraw consent
        consent.isWithdrawn = true;
        consent.withdrawnAt = new Date();
        consent.withdrawalReason = withdrawalReason || 'Candidate requested withdrawal';
        consent.withdrawnBy = req.user?._id || req.user?.id;

        await consent.save();

        // Update BGV case
        const bgvCase = await BGVCase.findById(caseId);
        if (bgvCase) {
            bgvCase.consentCaptured = false;
            // Don't change overallStatus to CONSENT_WITHDRAWN (not in enum) - keep it as is
            // Optionally revert to PENDING if it was still PENDING
            if (bgvCase.overallStatus === 'PENDING') {
                bgvCase.overallStatus = 'PENDING'; // stays pending
            }
            await bgvCase.save();
        }

        // Create timeline entry
        await BGVTimeline.create({
            tenant: bgvCase.tenant || req.tenantId,
            caseId,
            eventType: 'CONSENT_WITHDRAWN',
            title: 'Consent Withdrawn',
            description: withdrawalReason || 'Candidate withdrew consent',
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name || 'Candidate',
                userRole: req.user?.role || 'CANDIDATE'
            },
            visibleTo: ['ALL'],
            ipAddress: req.ip || req.connection?.remoteAddress,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: "Consent withdrawn successfully",
            data: {
                withdrawnAt: consent.withdrawnAt,
                withdrawalReason: consent.withdrawalReason
            }
        });

    } catch (err) {
        console.error('[BGV_CONSENT_WITHDRAW_ERROR]', err);
        next(err);
    }
};

/**
 * Check if consent is valid for a case
 * GET /api/bgv/case/:caseId/consent/validate
 */
exports.validateConsent = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { BGVConsent } = await getBGVModels(req);

        const hasValidConsent = await BGVConsent.hasValidConsent(caseId);

        res.json({
            success: true,
            data: {
                hasValidConsent,
                message: hasValidConsent
                    ? 'Valid consent exists'
                    : 'No valid consent found. BGV cannot proceed.'
            }
        });

    } catch (err) {
        console.error('[BGV_CONSENT_VALIDATE_ERROR]', err);
        next(err);
    }
};
