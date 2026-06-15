const { getBGVModels } = require('../utils/bgvModels');
const BGVEvidenceValidator = require('../services/BGVEvidenceValidator');
const path = require('path');
const fs = require('fs');

/**
 * 🔐 ENHANCED BGV CONTROLLER WITH EVIDENCE ENFORCEMENT
 * 
 * This controller implements strict evidence-driven verification
 * with maker-checker workflow and comprehensive audit logging.
 * 
 * CRITICAL PRINCIPLE: No verification without validated evidence
 */

/**
 * Update Check Evidence Status
 * Called after document upload to recalculate evidence completeness
 * POST /api/bgv/check/:checkId/update-evidence-status
 */
exports.updateCheckEvidenceStatus = async (req, res, next) => {
    try {
        const { checkId } = req.params;
        const { BGVCheck, BGVDocument, BGVEvidenceConfig } = await getBGVModels(req);

        const check = await BGVCheck.findById(checkId);
        if (!check) {
            return res.status(404).json({ success: false, message: 'Check not found' });
        }

        // Get all documents for this check
        const documents = await BGVDocument.find({
            checkId: check._id,
            isDeleted: false
        });

        // Get evidence configuration
        let evidenceConfig = await BGVEvidenceConfig.findOne({
            tenant: req.tenantId,
            checkType: check.type,
            isActive: true
        });

        // Validate evidence
        const validationResult = await BGVEvidenceValidator.validateCheckEvidence(
            check,
            documents,
            evidenceConfig
        );

        // Update check with evidence status
        check.evidenceStatus = {
            hasRequiredEvidence: validationResult.hasRequiredEvidence,
            evidenceCompleteness: validationResult.evidenceCompleteness,
            requiredDocumentTypes: validationResult.requiredDocumentTypes,
            uploadedDocumentTypes: validationResult.uploadedDocumentTypes,
            missingDocumentTypes: validationResult.missingDocuments,
            lastEvidenceCheck: new Date()
        };

        check.evidenceValidation = {
            isValid: validationResult.isValid,
            validationErrors: validationResult.validationErrors,
            validationWarnings: validationResult.validationWarnings,
            lastValidatedAt: new Date()
        };

        // Update check status based on evidence
        if (check.status === 'NOT_STARTED' && documents.length > 0) {
            check.status = 'DOCUMENTS_PENDING';
        }

        if (validationResult.hasRequiredEvidence && check.status === 'DOCUMENTS_PENDING') {
            check.status = 'DOCUMENTS_UPLOADED';
            check.verificationWorkflow = check.verificationWorkflow || {};
            check.verificationWorkflow.workflowStatus = 'READY_FOR_VERIFICATION';
        }

        await check.save();

        res.json({
            success: true,
            message: 'Evidence status updated',
            data: {
                evidenceStatus: check.evidenceStatus,
                evidenceValidation: check.evidenceValidation,
                checkStatus: check.status
            }
        });

    } catch (err) {
        console.error('[BGV_UPDATE_EVIDENCE_STATUS_ERROR]', err);
        next(err);
    }
};

/**
 * 🔐 STEP 1: START VERIFICATION (MAKER)
 * Verifier reviews evidence and submits for approval
 * POST /api/bgv/check/:checkId/start-verification
 */
exports.startVerification = async (req, res, next) => {
    try {
        const { checkId } = req.params;
        const { verificationRemarks, documentReviews } = req.body;
        const { BGVCheck, BGVDocument, BGVTimeline } = await getBGVModels(req);

        const check = await BGVCheck.findById(checkId);
        if (!check) {
            return res.status(404).json({ success: false, message: 'Check not found' });
        }

        // ✅ ENFORCE: Evidence must be complete
        if (!check.evidenceStatus?.hasRequiredEvidence) {
            return res.status(400).json({
                success: false,
                message: 'Cannot start verification: Required evidence is missing',
                missingDocuments: check.evidenceStatus?.missingDocumentTypes || [],
                evidenceCompleteness: check.evidenceStatus?.evidenceCompleteness || 0
            });
        }

        // Initialize verification workflow
        check.verificationWorkflow = check.verificationWorkflow || {};
        check.verificationWorkflow.verifiedBy = req.user._id || req.user.id;
        check.verificationWorkflow.verifiedAt = new Date();
        check.verificationWorkflow.verificationRemarks = verificationRemarks;
        check.verificationWorkflow.workflowStatus = 'UNDER_VERIFICATION';

        // Update document review statuses
        if (documentReviews && Array.isArray(documentReviews)) {
            check.verificationWorkflow.verificationEvidence = documentReviews.map(review => ({
                documentId: review.documentId,
                documentType: review.documentType,
                reviewStatus: review.reviewStatus || 'REVIEWED',
                reviewRemarks: review.reviewRemarks,
                reviewedAt: new Date()
            }));

            // Update individual documents
            for (const review of documentReviews) {
                await BGVDocument.findByIdAndUpdate(review.documentId, {
                    'reviewStatus.status': review.reviewStatus === 'ACCEPTED' ? 'ACCEPTED' : 'IN_REVIEW',
                    'reviewStatus.reviewedBy': req.user._id || req.user.id,
                    'reviewStatus.reviewedAt': new Date(),
                    'reviewStatus.reviewRemarks': review.reviewRemarks
                });
            }
        }

        check.status = 'UNDER_VERIFICATION';
        await check.save();

        // Create timeline entry
        await BGVTimeline.create({
            tenant: req.tenantId,
            caseId: check.caseId,
            checkId: check._id,
            eventType: 'VERIFICATION_STARTED',
            title: `${check.type} Verification Started`,
            description: `Verifier started reviewing evidence. ${verificationRemarks || ''}`,
            performedBy: {
                userId: req.user._id || req.user.id,
                userName: req.user.name || req.user.email,
                userRole: req.user.role
            },
            newStatus: 'UNDER_VERIFICATION',
            visibleTo: ['HR', 'ADMIN'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: 'Verification started successfully',
            data: check
        });

    } catch (err) {
        console.error('[BGV_START_VERIFICATION_ERROR]', err);
        next(err);
    }
};

/**
 * 🔐 STEP 2: SUBMIT FOR APPROVAL (MAKER)
 * Verifier completes review and submits to checker
 * POST /api/bgv/check/:checkId/submit-for-approval
 */
exports.submitForApproval = async (req, res, next) => {
    try {
        const { checkId } = req.params;
        const { status, remarks, documentReviews } = req.body;
        const { BGVCheck, BGVDocument, BGVTimeline } = await getBGVModels(req);

        const check = await BGVCheck.findById(checkId);
        if (!check) {
            return res.status(404).json({ success: false, message: 'Check not found' });
        }

        // ✅ ENFORCE: Evidence must be validated
        if (!check.evidenceStatus?.hasRequiredEvidence) {
            return res.status(400).json({
                success: false,
                message: 'Cannot submit for approval: Required evidence is missing',
                missingDocuments: check.evidenceStatus?.missingDocumentTypes || []
            });
        }

        // ✅ ENFORCE: Remarks are mandatory for FAILED/DISCREPANCY
        if (['FAILED', 'DISCREPANCY'].includes(status) && !remarks) {
            return res.status(400).json({
                success: false,
                message: 'Remarks are mandatory when marking check as FAILED or DISCREPANCY'
            });
        }

        // Update verification workflow
        check.verificationWorkflow = check.verificationWorkflow || {};
        check.verificationWorkflow.verifiedBy = req.user._id || req.user.id;
        check.verificationWorkflow.verifiedAt = new Date();
        check.verificationWorkflow.verificationRemarks = remarks;
        check.verificationWorkflow.submittedForApprovalAt = new Date();
        check.verificationWorkflow.workflowStatus = 'SUBMITTED_FOR_APPROVAL';

        // Store proposed status
        check.verificationWorkflow.proposedStatus = status;

        // Update document reviews
        if (documentReviews && Array.isArray(documentReviews)) {
            check.verificationWorkflow.verificationEvidence = documentReviews.map(review => ({
                documentId: review.documentId,
                documentType: review.documentType,
                reviewStatus: review.reviewStatus || 'REVIEWED',
                reviewRemarks: review.reviewRemarks,
                reviewedAt: new Date()
            }));
        }

        check.status = 'PENDING_APPROVAL';
        check.internalRemarks = remarks;
        await check.save();

        // Create timeline entry
        await BGVTimeline.create({
            tenant: req.tenantId,
            caseId: check.caseId,
            checkId: check._id,
            eventType: 'SUBMITTED_FOR_APPROVAL',
            title: `${check.type} Check Submitted for Approval`,
            description: `Verifier submitted check with proposed status: ${status}. ${remarks || ''}`,
            performedBy: {
                userId: req.user._id || req.user.id,
                userName: req.user.name || req.user.email,
                userRole: req.user.role
            },
            oldStatus: 'UNDER_VERIFICATION',
            newStatus: 'PENDING_APPROVAL',
            remarks,
            visibleTo: ['HR', 'ADMIN'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            message: 'Check submitted for approval successfully',
            data: check
        });

    } catch (err) {
        console.error('[BGV_SUBMIT_FOR_APPROVAL_ERROR]', err);
        next(err);
    }
};

/**
 * 🔐 STEP 3: APPROVE/REJECT VERIFICATION (CHECKER)
 * Checker reviews verifier's work and makes final decision
 * POST /api/bgv/check/:checkId/approve-verification
 */
exports.approveVerification = async (req, res, next) => {
    try {
        const { checkId } = req.params;
        const { decision, approvalRemarks } = req.body; // decision: APPROVED, REJECTED, SENT_BACK
        const { BGVCheck, BGVCase, BGVTimeline } = await getBGVModels(req);

        const check = await BGVCheck.findById(checkId);
        if (!check) {
            return res.status(404).json({ success: false, message: 'Check not found' });
        }

        // ✅ ENFORCE: Check must be in PENDING_APPROVAL status
        if (check.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({
                success: false,
                message: 'Check is not pending approval'
            });
        }

        // ✅ ENFORCE: Maker-Checker compliance
        const makerCheckerValidation = BGVEvidenceValidator.validateMakerCheckerCompliance(
            check,
            req.user,
            'APPROVE'
        );

        if (!makerCheckerValidation.isValid) {
            return res.status(403).json({
                success: false,
                message: 'Maker-Checker violation',
                errors: makerCheckerValidation.errors
            });
        }

        // Update verification workflow
        check.verificationWorkflow.approvedBy = req.user._id || req.user.id;
        check.verificationWorkflow.approvedAt = new Date();
        check.verificationWorkflow.approvalRemarks = approvalRemarks;
        check.verificationWorkflow.approvalDecision = decision;

        let newStatus;
        let eventType;

        if (decision === 'APPROVED') {
            // Apply the proposed status from verifier
            newStatus = check.verificationWorkflow.proposedStatus || 'VERIFIED';
            check.verificationWorkflow.workflowStatus = 'APPROVED';
            check.verificationWorkflow.completedAt = new Date();
            check.completedAt = new Date();
            eventType = 'VERIFICATION_APPROVED';
        } else if (decision === 'REJECTED') {
            newStatus = 'UNDER_VERIFICATION';
            check.verificationWorkflow.workflowStatus = 'REJECTED';
            eventType = 'VERIFICATION_REJECTED';
        } else if (decision === 'SENT_BACK') {
            newStatus = 'UNDER_VERIFICATION';
            check.verificationWorkflow.workflowStatus = 'UNDER_VERIFICATION';
            eventType = 'VERIFICATION_SENT_BACK';
        }

        const oldStatus = check.status;
        check.status = newStatus;
        await check.save();

        // Create timeline entry
        await BGVTimeline.create({
            tenant: req.tenantId,
            caseId: check.caseId,
            checkId: check._id,
            eventType,
            title: `${check.type} Check ${decision}`,
            description: `Checker ${decision.toLowerCase()} the verification. ${approvalRemarks || ''}`,
            performedBy: {
                userId: req.user._id || req.user.id,
                userName: req.user.name || req.user.email,
                userRole: req.user.role
            },
            oldStatus,
            newStatus,
            remarks: approvalRemarks,
            visibleTo: ['HR', 'ADMIN'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        // Update overall case status
        await updateOverallCaseStatus(check.caseId, req);

        res.json({
            success: true,
            message: `Verification ${decision.toLowerCase()} successfully`,
            data: check
        });

    } catch (err) {
        console.error('[BGV_APPROVE_VERIFICATION_ERROR]', err);
        next(err);
    }
};

/**
 * Review Document
 * Mark document as reviewed/accepted/rejected
 * POST /api/bgv/document/:documentId/review
 */
exports.reviewDocument = async (req, res, next) => {
    try {
        const { documentId } = req.params;
        const { reviewStatus, reviewRemarks, qualityScore, evidenceMetadata } = req.body;
        const { BGVDocument, BGVCheck, BGVTimeline } = await getBGVModels(req);

        const document = await BGVDocument.findById(documentId);
        if (!document) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        // Update review status
        document.reviewStatus = {
            status: reviewStatus || 'REVIEWED',
            reviewedBy: req.user._id || req.user.id,
            reviewedAt: new Date(),
            reviewRemarks,
            qualityScore,
            isComplete: reviewStatus === 'ACCEPTED',
            meetsRequirements: reviewStatus === 'ACCEPTED'
        };

        // Update evidence metadata if provided
        if (evidenceMetadata) {
            document.evidenceMetadata = {
                ...document.evidenceMetadata,
                ...evidenceMetadata
            };
        }

        document.status = reviewStatus === 'ACCEPTED' ? 'REVIEWED' : 'UNDER_REVIEW';
        await document.save();

        // Update check evidence status
        if (document.checkId) {
            const check = await BGVCheck.findById(document.checkId);
            if (check) {
                // Trigger evidence status update
                const documents = await BGVDocument.find({
                    checkId: check._id,
                    isDeleted: false
                });

                const { BGVEvidenceConfig } = await getBGVModels(req);
                let evidenceConfig = await BGVEvidenceConfig.findOne({
                    tenant: req.tenantId,
                    checkType: check.type,
                    isActive: true
                });

                const validationResult = await BGVEvidenceValidator.validateCheckEvidence(
                    check,
                    documents,
                    evidenceConfig
                );

                check.evidenceStatus = {
                    hasRequiredEvidence: validationResult.hasRequiredEvidence,
                    evidenceCompleteness: validationResult.evidenceCompleteness,
                    requiredDocumentTypes: validationResult.requiredDocumentTypes,
                    uploadedDocumentTypes: validationResult.uploadedDocumentTypes,
                    missingDocumentTypes: validationResult.missingDocuments,
                    lastEvidenceCheck: new Date()
                };

                await check.save();
            }
        }

        // Create timeline entry
        if (document.checkId && document.caseId) {
            await BGVTimeline.create({
                tenant: req.tenantId,
                caseId: document.caseId,
                checkId: document.checkId,
                eventType: 'DOCUMENT_REVIEWED',
                title: `Document Reviewed: ${document.documentType}`,
                description: `Document marked as ${reviewStatus}. ${reviewRemarks || ''}`,
                performedBy: {
                    userId: req.user._id || req.user.id,
                    userName: req.user.name || req.user.email,
                    userRole: req.user.role
                },
                visibleTo: ['HR', 'ADMIN'],
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                metadata: { documentId: document._id, reviewStatus }
            });
        }

        res.json({
            success: true,
            message: 'Document reviewed successfully',
            data: document
        });

    } catch (err) {
        console.error('[BGV_REVIEW_DOCUMENT_ERROR]', err);
        next(err);
    }
};

/**
 * Helper: Update overall case status based on all checks
 */
async function updateOverallCaseStatus(caseId, req) {
    try {
        const { BGVCase, BGVCheck } = await getBGVModels(req);

        const bgvCase = await BGVCase.findById(caseId);
        if (!bgvCase) return;

        const allChecks = await BGVCheck.find({ caseId: bgvCase._id });

        let overall = 'IN_PROGRESS';

        const failed = allChecks.some(c => c.status === 'FAILED');
        const allVerified = allChecks.every(c => c.status === 'VERIFIED');
        const hasDiscrepancy = allChecks.some(c => c.status === 'DISCREPANCY');
        const anyPendingApproval = allChecks.some(c => c.status === 'PENDING_APPROVAL');

        if (failed) {
            overall = 'FAILED';
        } else if (allVerified && hasDiscrepancy) {
            overall = 'VERIFIED_WITH_DISCREPANCIES';
        } else if (allVerified) {
            overall = 'VERIFIED';
        } else if (anyPendingApproval) {
            overall = 'IN_PROGRESS';
        }

        bgvCase.overallStatus = overall;

        if (['VERIFIED', 'VERIFIED_WITH_DISCREPANCIES', 'FAILED'].includes(overall)) {
            bgvCase.completedAt = new Date();
        }

        await bgvCase.save();

    } catch (error) {
        console.error('[UPDATE_OVERALL_STATUS_ERROR]', error);
    }
}

module.exports = {
    updateCheckEvidenceStatus: exports.updateCheckEvidenceStatus,
    startVerification: exports.startVerification,
    submitForApproval: exports.submitForApproval,
    approveVerification: exports.approveVerification,
    reviewDocument: exports.reviewDocument
};
