const express = require('express');
const router = express.Router();
const payrollDashboardController = require('../controllers/payrollDashboard.controller');
const { authenticateToken, tenantMiddleware } = require('../middleware/auth');

// Apply authentication and tenant middleware to all routes
router.use(authenticateToken);
router.use(tenantMiddleware);

/**
 * GET /api/payroll/dashboard
 * Get comprehensive dashboard data with analytics
 */
router.get('/dashboard', payrollDashboardController.getDashboardData);

/**
 * GET /api/payroll/dashboard/stats
 * Get quick stats for dashboard cards
 */
router.get('/dashboard/stats', payrollDashboardController.getQuickStats);

module.exports = router;
