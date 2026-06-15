const express = require('express');
const router = express.Router();
const salaryIncrementController = require('../controllers/salaryIncrement.controller');
const { authenticate } = require('../middleware/auth');

/**
 * ============================================
 * SALARY INCREMENT ROUTES
 * ============================================
 * 
 * All routes require authentication
 * Only Super Admin / Company Admin can create increments
 */

// Create new increment/revision
router.post('/increment', authenticate, salaryIncrementController.createIncrement);

// Get increment history for employee
router.get('/increment/history/:employeeId', authenticate, salaryIncrementController.getIncrementHistory);

// Preview increment changes
router.get('/increment/preview', authenticate, salaryIncrementController.previewIncrement);

// Cancel scheduled increment
router.post('/increment/:id/cancel', authenticate, salaryIncrementController.cancelIncrement);

// Manually activate scheduled increments (admin only)
router.post('/increment/activate-scheduled', authenticate, salaryIncrementController.activateScheduled);

module.exports = router;
