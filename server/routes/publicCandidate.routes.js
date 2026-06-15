const express = require('express');
const router = express.Router();
const publicCandidateController = require('../controllers/publicCandidate.controller');
const { authenticatePublicCandidate, attachPublicTenant } = require('../middleware/publicCandidateAuth');
const { uploadResume, handleUploadError } = require('../middleware/publicCareerUpload.middleware');

/**
 * PUBLIC AUTH ROUTES
 */
router.post('/auth/register', attachPublicTenant, uploadResume.single('resume'), handleUploadError, publicCandidateController.register);
router.post('/auth/login', attachPublicTenant, publicCandidateController.login);

/**
 * PROTECTED CANDIDATE ROUTES
 */
router.get('/profile', authenticatePublicCandidate, publicCandidateController.getProfile);
router.get('/applications', authenticatePublicCandidate, publicCandidateController.getApplications);
router.get('/applications/:id', authenticatePublicCandidate, publicCandidateController.getApplicationById);
router.delete('/applications/:id', authenticatePublicCandidate, publicCandidateController.withdrawApplication);

module.exports = router;
