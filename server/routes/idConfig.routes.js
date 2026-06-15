const express = require('express');
const router = express.Router();
const idConfigController = require('../controllers/idConfig.controller');
const auth = require('../middleware/auth.jwt');
const tenantMiddleware = require('../middleware/tenant.middleware');

// Apply auth and tenant context to all routes
router.use(auth.authenticate);
router.use(tenantMiddleware);

// ID Configuration Routes
router.get('/preview', idConfigController.previewNextId);
router.get('/audit/:entity', idConfigController.auditIds);

module.exports = router;
