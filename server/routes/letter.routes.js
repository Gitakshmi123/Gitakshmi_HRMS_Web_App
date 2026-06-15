const express = require('express');
const router = express.Router();
const letterCtrl = require('../controllers/letter.controller');
const { authenticate, requireHr } = require('../middleware/auth.jwt');
const { checkPermission } = require('../middleware/rbac.middleware');
const customOfferWorkflowCtrl = require('../controllers/customOfferWorkflow.controller');

// console.log('Letter routes loaded');
// console.log('uploadWordTemplate type:', typeof letterCtrl.uploadWordTemplate);
// console.log('deleteTemplate type:', typeof letterCtrl.deleteTemplate); // DEBUG CHECK

// --- Specific Letter Generation Routes (Must be before wildcard :id routes) ---
router.post('/generate-offer', authenticate, checkPermission('documents.issue', 'create'), letterCtrl.generateOfferLetter);
router.post('/start-custom-workflow', authenticate, checkPermission('documents.issue', 'create'), customOfferWorkflowCtrl.startCustomWorkflow);
router.get('/offer-approval-chain', authenticate, checkPermission('documents.issue', 'create'), letterCtrl.getOfferApprovalChain);
router.get('/approvers', authenticate, checkPermission('documents.issue', 'create'), letterCtrl.getEligibleApprovers);
router.post('/generate-joining', authenticate, checkPermission('documents.issue', 'create'), letterCtrl.generateJoiningLetter);
router.post('/preview-joining', authenticate, checkPermission('documents.issue', 'view'), letterCtrl.previewJoiningLetter);
router.get('/preview-file', authenticate, checkPermission('documents.issue', 'create'), letterCtrl.previewGeneratedFile);
router.post('/upload-word-template', authenticate, checkPermission('documents.templates', 'create'), letterCtrl.uploadWordTemplate);

// --- Company Profile (Branding) ---
router.get('/company-profile', authenticate, checkPermission('documents.settings', 'view'), letterCtrl.getCompanyProfile);
router.post('/company-profile', authenticate, checkPermission('documents.settings', 'edit'), letterCtrl.updateCompanyProfile);

// --- Templates Management ---
router.get('/templates', authenticate, checkPermission('documents.templates', 'view'), letterCtrl.getTemplates);     // List all
router.post('/templates', authenticate, checkPermission('documents.templates', 'create'), letterCtrl.createTemplate);
router.get('/templates/:id', authenticate, checkPermission('documents.templates', 'view'), letterCtrl.getTemplateById); // Get One
router.put('/templates/:id', authenticate, checkPermission('documents.templates', 'edit'), letterCtrl.updateTemplate);  // Update
router.delete('/templates/:id', authenticate, checkPermission('documents.templates', 'delete'), letterCtrl.deleteTemplate); // Delete

// --- Word Template Upload (Joining Letters) ---
router.post('/upload-word-template', authenticate, checkPermission('documents.templates', 'create'), letterCtrl.uploadWordTemplate);

// --- Word Template Preview (Convert to PDF) ---
router.get('/templates/:templateId/preview-pdf', authenticate, checkPermission('documents.templates', 'view'), letterCtrl.previewWordTemplatePDF);
router.get('/templates/:templateId/download-word', authenticate, checkPermission('documents.templates', 'view'), letterCtrl.downloadWordTemplate); // Download original .docx file
router.get('/templates/:templateId/download-pdf', authenticate, checkPermission('documents.templates', 'view'), letterCtrl.downloadWordTemplatePDF); // Download as PDF

// --- PDF Generate & Download ---
router.post('/templates/:templateId/download-pdf', authenticate, checkPermission('documents.issue', 'create'), letterCtrl.downloadLetterPDF);

// --- Generic Letter Generation & Workflow ---
router.post('/generate-generic', authenticate, checkPermission('documents.issue', 'create'), letterCtrl.generateGenericLetter);
router.get('/generated-letters', authenticate, letterCtrl.getGeneratedLetters);
router.get('/generated-letters/:id', authenticate, letterCtrl.getLetterById);
router.patch('/generated-letters/:id/status', authenticate, checkPermission('documents.dashboard', 'edit'), letterCtrl.updateGeneratedLetterStatus);
router.post('/generated-letters/:id/approval', authenticate, checkPermission('documents.dashboard', 'edit'), letterCtrl.actionLetterApproval);

// --- Dynamic PDF, Sign & Accept (MERN Architect Flow) ---
const { authenticateCandidate } = require('../middleware/jobPortalAuthMiddleware');

// Get Dynamic PDF (Centralized tenant middleware handles query-based auth for iframes)
router.get('/:id/pdf', letterCtrl.generateDynamicPDF);

// NOTE: /view-pdf route is mounted directly in app.js as a public route

// Company Final Approval (Phase 2)
router.post('/:id/approve-company-signature', authenticate, checkPermission('documents.dashboard', 'edit'), letterCtrl.approveCompanySignature);
router.post('/:id/approve-company-joining-signature', authenticate, checkPermission('documents.dashboard', 'edit'), letterCtrl.approveCompanyJoiningSignature);

// Candidate Actions
router.post('/:id/accept', authenticateCandidate, letterCtrl.acceptLetter);

// --- Joining Letter Workflow Routes ---
// GET status (readable by both HR and candidates)
router.get('/joining/revision-requests', authenticate, checkPermission('documents.dashboard', 'view'), letterCtrl.getJoiningLetterRevisionRequests);
router.get('/joining/:id/status', authenticateCandidate, letterCtrl.getJoiningLetterStatus);

// Candidate: Accept, Reject, Request Revision
router.post('/joining/:id/accept', authenticateCandidate, letterCtrl.acceptJoiningLetter);
router.post('/joining/:id/reject', authenticateCandidate, letterCtrl.rejectJoiningLetter);
router.post('/joining/:id/request-revision', authenticateCandidate, letterCtrl.requestJoiningLetterRevision);

// HR: Revise a letter (only when revision_requested)
router.post('/joining/:id/revise', authenticate, checkPermission('documents.dashboard', 'edit'), letterCtrl.reviseJoiningLetter);

// --- History / Audit ---
router.get('/history', authenticate, checkPermission('documents.dashboard', 'view'), letterCtrl.getHistory);


// Ensure export
if (!module.exports) {
    module.exports = router;
} else {
    module.exports = router;
}
