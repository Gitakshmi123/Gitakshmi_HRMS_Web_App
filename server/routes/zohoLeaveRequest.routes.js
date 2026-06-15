const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const zohoLeaveRequestController = require('../controllers/zohoLeaveRequest.controller');
const checkModuleAccess = require('../middleware/moduleAccess.middleware');

// Middleware to check for 'leave' module access
const leaveCheck = checkModuleAccess('leave');

// All routes are private and require 'leave' module access
router.use(auth.authenticate, leaveCheck);

/**
 * @route   POST /api/zoho-leaves/apply
 * @desc    Submit a new leave request with policy checks
 */
router.post('/apply', zohoLeaveRequestController.applyLeave);

/**
 * @route   GET /api/zoho-leaves/eligibility
 * @desc    Get current employee's leave eligibility and policy rules
 */
router.get('/eligibility', zohoLeaveRequestController.getEligibilityCheck);

module.exports = router;
