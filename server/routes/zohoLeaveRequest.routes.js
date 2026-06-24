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
 * @swagger
 * /api/zoho-leaves/apply:
 *   post:
 *     summary: Submit a new leave request
 *     description: Submit a new leave request with policy checks.
 *     tags: [Leaves]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LeaveRequest'
 *     responses:
 *       200:
 *         description: Leave applied successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
router.post('/apply', zohoLeaveRequestController.applyLeave);

/**
 * @swagger
 * /api/zoho-leaves/eligibility:
 *   get:
 *     summary: Get leave eligibility
 *     description: Get current employee's leave eligibility and policy rules.
 *     tags: [Leaves]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Leave eligibility details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
router.get('/eligibility', zohoLeaveRequestController.getEligibilityCheck);

module.exports = router;
