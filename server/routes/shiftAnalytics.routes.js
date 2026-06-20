const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/shiftAnalytics.controller');
const { authenticate } = require('../middleware/auth.jwt');

// GET /api/shift-analytics/dashboard
router.get('/dashboard', authenticate, analyticsController.getDashboardStats);

module.exports = router;
