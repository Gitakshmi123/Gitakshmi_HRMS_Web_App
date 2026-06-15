const express = require('express');
const router = express.Router();
const controller = require('../controllers/companyIdConfig.controller');
const auth = require('../middleware/auth.jwt');
const tenantMiddleware = require('../middleware/tenant.middleware');

// Apply Middleware for Tenant & Auth
router.use(auth.authenticate);
router.use(tenantMiddleware);

// GET all configurations
router.get('/', controller.getConfigurations);

// POST/PUT save configurations
router.post('/', controller.saveConfigurations);

// DELETE configuration
// DELETE configuration - Deprecated in Enterprise Engine
// router.delete('/:id', controller.deleteConfiguration);

// POST get next ID (optionally increment)
router.post('/next', controller.getNextId);

// Add a test status endpoint if needed
router.get('/status', (req, res) => res.json({ status: 'active' }));

module.exports = router;
