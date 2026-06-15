/**
 * ═══════════════════════════════════════════════════════════════════════
 * RECRUITMENT WORKFLOW ROUTES
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * API endpoints for the complete recruitment workflow
 * 
 * @version 2.0
 */

const express = require('express');
const router = express.Router();
const workflowController = require('../controllers/recruitment.workflow.controller');
const auth = require('../middleware/auth.jwt');

const authenticateToken = auth.authenticate;

const getTenantDB = async (req, res, next) => {
    try {
        if (!req.tenantDB && req.tenantId) {
            const getTenantDBFn = require('../utils/tenantDB');
            req.tenantDB = await getTenantDBFn(req.tenantId);
        }
        req.db = req.tenantDB || req.db;
        next();
    } catch (err) {
        next(err);
    }
};

router.use(authenticateToken);
router.use(getTenantDB);

// ═══════════════════════════════════════════════════════════════════
// APPLICATION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/recruitment/applications
 * @desc    Create new job application
 * @access  Public (Candidate) / Private (HR)
 * @body    {
 *            jobId: ObjectId,
 *            candidateId: ObjectId,
 *            candidateInfo: { name, email, mobile, ... },
 *            source: 'CAREER_PORTAL' | 'REFERRAL' | ...,
 *            priority: 'LOW' | 'MEDIUM' | 'HIGH'
 *          }
 */
router.post('/applications', workflowController.createApplication);

/**
 * @route   PATCH /api/recruitment/applications/:applicationId/status
 * @desc    Update application status
 * @access  Private (HR)
 * @body    {
 *            status: 'SHORTLISTED' | 'INTERVIEW' | 'SELECTED' | 'REJECTED' | ...,
 *            reason: 'Optional reason for status change'
 *          }
 */
router.patch('/applications/:applicationId/status', workflowController.updateApplicationStatus);

/**
 * @route   GET /api/recruitment/pipeline
 * @desc    Get recruitment pipeline statistics
 * @access  Private (HR)
 * @query   jobId (optional) - Filter by specific job
 */
router.get('/pipeline', workflowController.getRecruitmentPipeline);

// ═══════════════════════════════════════════════════════════════════
// INTERVIEW MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/recruitment/applications/:applicationId/interviews
 * @desc    Schedule interview for application
 * @access  Private (HR)
 * @body    {
 *            date: Date,
 *            time: String,
 *            mode: 'Online' | 'Offline',
 *            location: String (URL or Address),
 *            interviewerName: String,
 *            interviewerId: ObjectId,
 *            notes: String
 *          }
 */
router.post('/applications/:applicationId/interviews', workflowController.scheduleInterview);

// ═══════════════════════════════════════════════════════════════════
// OFFER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/recruitment/applications/:applicationId/offer
 * @desc    Create offer letter for selected candidate
 * @access  Private (HR)
 * @body    {
 *            salaryStructureId: ObjectId,
 *            department: String,
 *            designation: String,
 *            location: String,
 *            reportingTo: String,
 *            joiningDate: Date,
 *            probationPeriod: Number (months),
 *            noticePeriod: Number (days),
 *            validUntil: Date,
 *            benefits: [{ name, description }],
 *            specialTerms: [{ term }]
 *          }
 */
router.post('/applications/:applicationId/offer', workflowController.createOffer);

/**
 * @route   POST /api/recruitment/offers/:offerId/send
 * @desc    Send offer letter to candidate
 * @access  Private (HR)
 */
router.post('/offers/:offerId/send', workflowController.sendOffer);

/**
 * @route   POST /api/recruitment/applications/:applicationId/offer/revise
 * @desc    Revise offer when latest is EXPIRED or REJECTED
 * @access  Private (HR)
 * @body    { sentAt, expiryAt, salaryStructureId?, ... }
 */
router.post('/applications/:applicationId/offer/revise', workflowController.reviseOffer);

/**
 * @route   GET /api/recruitment/applications/:applicationId/offer/latest
 * @desc    Get latest active offer for application (for candidate/HR)
 * @access  Private
 */
router.get('/applications/:applicationId/offer/latest', workflowController.getLatestOffer);

/**
 * @route   POST /api/recruitment/offers/:offerId/accept
 * @desc    Candidate accepts offer
 * @access  Public (Candidate with token) / Private (HR on behalf)
 * @body    {
 *            acceptanceNotes: String (optional)
 *          }
 */
router.post('/offers/:offerId/accept', workflowController.acceptOffer);

// ═══════════════════════════════════════════════════════════════════
// EMPLOYEE CONVERSION
// ═══════════════════════════════════════════════════════════════════

/**
 * @route   POST /api/recruitment/offers/:offerId/convert-to-employee
 * @desc    Convert accepted offer to employee
 * @access  Private (HR)
 * @body    {
 *            actualJoiningDate: Date (optional),
 *            department: String (optional - for employee ID generation)
 *          }
 */
router.post('/offers/:offerId/convert-to-employee', workflowController.convertToEmployee);

module.exports = router;
