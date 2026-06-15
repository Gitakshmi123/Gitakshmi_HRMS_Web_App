/**
 * BGV Status Validation Middleware
 * Enforces valid status transitions and prevents illegal state changes
 * Ensures evidence-based verification workflow
 */

const { getBGVModels } = require('../utils/bgvModels');

class BGVStatusValidator {

    /**
     * Valid status transitions for BGV Check
     * Each status can only transition to specific next statuses
     */
    static VALID_TRANSITIONS = {
        'NOT_STARTED': ['ASSIGNED', 'IN_PROGRESS', 'PENDING', 'DOCUMENTS_PENDING', 'VERIFIED', 'FAILED', 'DISCREPANCY'],
        'PENDING': ['IN_PROGRESS', 'DOCUMENTS_PENDING', 'DOCUMENTS_UPLOADED', 'VERIFIED', 'FAILED', 'DISCREPANCY'],
        'ASSIGNED': ['IN_PROGRESS', 'DOCUMENTS_PENDING', 'VERIFIED', 'FAILED', 'DISCREPANCY'],
        'DOCUMENTS_PENDING': ['DOCUMENTS_UPLOADED', 'ESCALATED', 'VERIFIED', 'FAILED', 'DISCREPANCY'],
        'DOCUMENTS_UPLOADED': ['UNDER_VERIFICATION', 'DOCUMENTS_PENDING', 'VERIFIED', 'FAILED', 'DISCREPANCY'],
        'IN_PROGRESS': ['UNDER_VERIFICATION', 'AWAITING_RESPONSE', 'ESCALATED', 'VERIFIED', 'FAILED', 'DISCREPANCY'],
        'AWAITING_RESPONSE': ['UNDER_VERIFICATION', 'IN_PROGRESS', 'ESCALATED', 'VERIFIED', 'FAILED', 'DISCREPANCY'],
        'UNDER_VERIFICATION': ['UNDER_REVIEW', 'IN_PROGRESS', 'ESCALATED', 'VERIFIED', 'FAILED', 'DISCREPANCY'],
        'UNDER_REVIEW': ['VERIFIED', 'DISCREPANCY', 'FAILED', 'ESCALATED'],
        'DISCREPANCY': ['UNDER_REVIEW', 'FAILED', 'ESCALATED', 'VERIFIED'],
        'VERIFIED': ['CLOSED', 'IN_PROGRESS'], // Can only close after verification
        'FAILED': ['CLOSED', 'ESCALATED', 'IN_PROGRESS'],
        'ESCALATED': ['UNDER_REVIEW', 'IN_PROGRESS', 'VERIFIED', 'FAILED', 'DISCREPANCY'],
        'CLOSED': [] // Terminal state - no transitions allowed
    };

    /**
     * Statuses that require evidence before transition
     */
    static EVIDENCE_REQUIRED_STATUSES = [
        'VERIFIED',
        'UNDER_REVIEW',
        'DISCREPANCY',
        'FAILED'
    ];

    /**
     * Statuses that require maker-checker approval
     */
    static APPROVAL_REQUIRED_STATUSES = [
        'VERIFIED',
        'CLOSED'
    ];

    /**
     * Validate if status transition is allowed
     */
    static isValidTransition(currentStatus, newStatus) {
        if (currentStatus === newStatus) return true; // Allow idempotent updates
        const allowedTransitions = this.VALID_TRANSITIONS[currentStatus] || [];
        return allowedTransitions.includes(newStatus);
    }

    /**
     * Check if evidence is required for this status
     */
    static requiresEvidence(status) {
        return this.EVIDENCE_REQUIRED_STATUSES.includes(status);
    }

    /**
     * Check if approval is required for this status
     */
    static requiresApproval(status) {
        return this.APPROVAL_REQUIRED_STATUSES.includes(status);
    }

    /**
     * Validate status change for a BGV check
     */
    static async validateCheckStatusChange(req, checkId, newStatus) {
        const { BGVCheck, BGVDocument, BGVTaskAssignment } = await getBGVModels(req);

        // Get current check
        const check = await BGVCheck.findById(checkId);
        if (!check) {
            throw new Error('Check not found');
        }

        const currentStatus = check.status;

        // 1. Validate transition is allowed
        if (!this.isValidTransition(currentStatus, newStatus)) {
            throw new Error(
                `Invalid status transition: Cannot change from ${currentStatus} to ${newStatus}. ` +
                `Allowed transitions: ${this.VALID_TRANSITIONS[currentStatus].join(', ')}`
            );
        }

        // 2. Check if evidence is required
        const userRole = (req.user?.role || '').toLowerCase();
        const isHR = ['hr', 'admin', 'company_admin', 'company_super_admin', 'owner', 'psa'].includes(userRole);

        console.log(`[BGV_VALIDATE] Check: ${checkId}, NewStatus: ${newStatus}, Role: ${userRole}, isHR: ${isHR}`);
        if (this.requiresEvidence(newStatus) && !isHR) {
            const hasEvidence = await this.checkHasEvidence(BGVDocument, check.caseId, checkId);
            if (!hasEvidence) {
                throw new Error(
                    `Cannot change status to ${newStatus}: Evidence is required. ` +
                    `Please upload supporting documents before verification.`
                );
            }
        }

        // 3. Check if maker-checker approval is required
        if (this.requiresApproval(newStatus) && !isHR) {
            const hasApproval = await this.checkHasApproval(BGVTaskAssignment, checkId, req.user);
            if (!hasApproval) {
                throw new Error(
                    `Cannot change status to ${newStatus}: Maker-Checker approval required. ` +
                    `This check must be reviewed and approved by a different user.`
                );
            }
        }

        // 4. Prevent closing immutable cases
        if (newStatus === 'CLOSED' && check.isImmutable) {
            const bgvCase = await BGVCheck.db.model('BGVCase', require('../models/BGVCase')).findById(check.caseId).lean();
            if (bgvCase && bgvCase.isClosed) {
                throw new Error('Cannot modify a closed BGV case');
            }
        }

        return true;
    }

    /**
     * Check if check has required evidence
     */
    static async checkHasEvidence(BGVDocument, caseId, checkId) {
        const evidenceCount = await BGVDocument.countDocuments({
            caseId,
            checkId,
            isDeleted: false,
            'reviewStatus.status': { $in: ['APPROVED', 'PENDING'] }
        });

        return evidenceCount > 0;
    }

    /**
     * Check if check has maker-checker approval
     */
    static async checkHasApproval(BGVTaskAssignment, checkId, currentUser) {
        const task = await BGVTaskAssignment.findOne({
            checkId,
            taskType: 'VERIFICATION',
            taskStatus: 'COMPLETED'
        });

        if (!task) {
            return false;
        }

        // Ensure maker and checker are different users
        if (task.maker && task.checker) {
            const makerId = task.maker.userId?.toString();
            const checkerId = task.checker.userId?.toString();
            const currentUserId = currentUser?._id?.toString() || currentUser?.id?.toString();

            // Prevent self-approval
            if (makerId === checkerId) {
                throw new Error('Self-approval detected: Maker and Checker must be different users');
            }

            // Ensure current user is the checker (not the maker)
            if (currentUserId === makerId) {
                throw new Error('Cannot approve own verification: You are the maker of this check');
            }

            return task.checker.decision === 'APPROVED';
        }

        return false;
    }

    /**
     * Validate case closure
     */
    static async validateCaseClosure(req, caseId) {
        const { BGVCase, BGVCheck } = await getBGVModels(req);

        const bgvCase = await BGVCase.findById(caseId);
        if (!bgvCase) {
            throw new Error('BGV Case not found');
        }

        // Check if already closed
        if (bgvCase.isClosed) {
            throw new Error('BGV Case is already closed');
        }

        // Get all checks for this case
        const checks = await BGVCheck.find({ caseId });

        // Ensure all checks are verified or failed
        const incompleteChecks = checks.filter(check =>
            !['VERIFIED', 'FAILED', 'CLOSED', 'DISCREPANCY'].includes(check.status)
        );

        if (incompleteChecks.length > 0) {
            const userRole = (req.user?.role || '').toLowerCase();
            const isHR = ['hr', 'admin', 'company_admin', 'company_super_admin', 'owner', 'psa'].includes(userRole);

            if (!isHR) {
                throw new Error(
                    `Cannot close BGV case: ${incompleteChecks.length} check(s) are still incomplete. ` +
                    `All checks must be VERIFIED or FAILED before closing the case.`
                );
            } else {
                console.warn(`[BGV_VALIDATE] HR/Admin closing case with ${incompleteChecks.length} incomplete checks.`);
                // We allow HR to close anyway, but we should probably log it.
            }
        }

        return true;
    }

    /**
     * Middleware: Validate status change before update
     */
    static async validateStatusChangeMiddleware(req, res, next) {
        try {
            const { checkId } = req.params;
            const { status: newStatus } = req.body;

            if (!newStatus) {
                return next(); // No status change, skip validation
            }

            await BGVStatusValidator.validateCheckStatusChange(req, checkId, newStatus);
            next();
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
                error: 'STATUS_VALIDATION_FAILED'
            });
        }
    }

    /**
     * Middleware: Validate case closure
     */
    static async validateCaseClosureMiddleware(req, res, next) {
        try {
            const { id: caseId } = req.params;

            await BGVStatusValidator.validateCaseClosure(req, caseId);
            next();
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: error.message,
                error: 'CASE_CLOSURE_VALIDATION_FAILED'
            });
        }
    }
}

module.exports = BGVStatusValidator;
