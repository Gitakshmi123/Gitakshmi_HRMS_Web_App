const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/onboardingWorkflow.controller');
const { authenticate } = require('../middleware/auth.jwt');

// All routes require authentication
router.use(authenticate);

// Employee routes
router.get('/my-status', ctrl.getMyOnboarding);
router.post('/submit-profile', ctrl.submitOnboarding);

// HR routes (In a real app, add checkRole('HR') middleware)
router.get('/pending-approvals', ctrl.getPendingApprovals);
router.post('/approve/:id', ctrl.approveOnboarding);

module.exports = router;
