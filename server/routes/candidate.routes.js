const express = require('express');
const router = express.Router();
const candidateCtrl = require('../controllers/candidate.controller');
const hiringFlowCtrl = require('../controllers/hiring.flow.controller');
const externalRecordCtrl = require('../controllers/externalEmployeeRecord.controller');
const { authenticateCandidate } = require('../middleware/jobPortalAuthMiddleware');

router.post('/register', candidateCtrl.registerCandidate);
router.post('/login', candidateCtrl.loginCandidate);
router.post('/logout', candidateCtrl.logoutCandidate);
router.post('/send-otp', candidateCtrl.sendCandidateOtp);
router.post('/forgot-password/send-otp', candidateCtrl.sendForgotPasswordOtp);
router.post('/forgot-password/reset', candidateCtrl.resetPassword);

// Secure token-based pre-onboarding profile completion.
router.get('/document-upload/:token/reference-data', externalRecordCtrl.getReferenceData);
router.get('/document-upload/:token', externalRecordCtrl.getByToken);
router.put('/document-upload/:token/draft', externalRecordCtrl.saveDraftByToken);
router.post('/document-upload/:token/submit', externalRecordCtrl.submitByToken);

// Profile update and photo upload
const { profilePicUpload } = require('../utils/upload');
const { uploadResume, handleUploadError } = require('../middleware/publicCareerUpload.middleware');
router.get('/profile', authenticateCandidate, candidateCtrl.getCandidateProfile);
router.put('/profile', authenticateCandidate, profilePicUpload.single('profileImage'), candidateCtrl.updateCandidateProfile);
router.put('/profile/resume', authenticateCandidate, uploadResume.single('resume'), handleUploadError, candidateCtrl.updateCandidateResume);

// Protected routes
router.get('/me', authenticateCandidate, candidateCtrl.getCandidateMe);
router.get('/dashboard', authenticateCandidate, candidateCtrl.getCandidateDashboard);
router.get('/check-status/:requirementId', authenticateCandidate, candidateCtrl.checkApplicationStatus);
router.get('/application/track/:applicationId', authenticateCandidate, candidateCtrl.trackApplication);
router.get('/application/onboarding/:applicationId/access', authenticateCandidate, candidateCtrl.getOnboardingAccess);


// Configure Multer for Document Uploads
const multer = require('multer');
const path = require('path');
const fs = require('fs');
if (!fs.existsSync('uploads/temp/')) {
    fs.mkdirSync('uploads/temp/', { recursive: true });
}
const upload = multer({
    dest: 'uploads/temp/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images, PDFs, and Word documents are allowed'));
        }
    }
});

// Offer Acceptance
router.post('/application/accept-offer/:applicationId', authenticateCandidate, candidateCtrl.acceptOffer);
router.post('/application/reject-offer/:applicationId', authenticateCandidate, candidateCtrl.rejectOffer);
router.post('/application/request-offer-revision/:applicationId', authenticateCandidate, candidateCtrl.requestOfferRevision);

// ============================================================
// STRICT HIRING FLOW (v3) - Candidate Offer + Joining APIs
// (Added without removing legacy endpoints)
// ============================================================
router.get('/offer/:applicationId', authenticateCandidate, hiringFlowCtrl.getCandidateOfferByApplication);
router.patch('/offer/respond', authenticateCandidate, hiringFlowCtrl.respondToOffer);
router.patch('/offer/sign', authenticateCandidate, hiringFlowCtrl.signOffer);
router.post('/offer/request-new/:applicationId', authenticateCandidate, candidateCtrl.requestOfferRevision);

router.get('/joining/:applicationId', authenticateCandidate, hiringFlowCtrl.getCandidateJoiningByApplication);
router.patch('/joining/confirm', authenticateCandidate, hiringFlowCtrl.confirmJoining);
router.post('/joining/request-new/:applicationId', authenticateCandidate, candidateCtrl.requestJoiningLetterRevision);

// Joining Letter Acceptance
router.post('/application/accept-joining-letter/:applicationId', authenticateCandidate, candidateCtrl.acceptJoiningLetter);
router.post('/application/reject-joining-letter/:applicationId', authenticateCandidate, candidateCtrl.rejectJoiningLetter);
router.post('/application/request-joining-revision/:applicationId', authenticateCandidate, candidateCtrl.requestJoiningLetterRevision);

// BGV Documents
router.get('/application/bgv-documents/:applicationId', authenticateCandidate, candidateCtrl.getBGVDocuments);
router.post('/application/bgv-documents/:applicationId/upload', authenticateCandidate, upload.single('document'), candidateCtrl.uploadBGVDocument);
router.delete('/application/bgv-documents/:applicationId/:documentId', authenticateCandidate, candidateCtrl.removeBGVDocument);

// Letter Signing
router.get('/letter/status/:letterId', authenticateCandidate, candidateCtrl.getLetterStatus);
router.post('/letter/sign/:letterId', authenticateCandidate, candidateCtrl.signLetter);

module.exports = router;
