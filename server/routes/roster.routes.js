const express = require('express');
const router = express.Router();
const rosterController = require('../controllers/roster.controller');
const { authenticate } = require('../middleware/auth.jwt');

// GET /api/roster
router.get('/', authenticate, rosterController.getMonthlyRoster);

// POST /api/roster/generate
router.post('/generate', authenticate, rosterController.generateRoster);

module.exports = router;
