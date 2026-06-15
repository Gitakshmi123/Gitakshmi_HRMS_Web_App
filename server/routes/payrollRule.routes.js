const express = require('express');
const router = express.Router();
const payrollRuleController = require('../controllers/payrollRule.controller');
const { authenticate, authorize } = require('../middleware/auth.jwt');

// Get Rules
router.get('/rules', authenticate, authorize(['HR', 'Admin']), payrollRuleController.getRules);

// Update Rules
router.put('/rules', authenticate, authorize(['HR', 'Admin']), payrollRuleController.updateRules);

// Preview resolved city/state/location policy
router.get('/rules/preview', authenticate, authorize(['HR', 'Admin']), payrollRuleController.previewResolvedLocationPolicy);

// Calculate Breakup (Preview)
router.post('/calculate', authenticate, authorize(['HR', 'Admin']), payrollRuleController.calculateBreakup);

module.exports = router;
