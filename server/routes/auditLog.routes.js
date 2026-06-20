const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLog.controller');
const { authenticate } = require('../middleware/auth.jwt');

// GET /api/audit-logs/shift
router.get('/shift', authenticate, auditLogController.getShiftAuditLogs);

module.exports = router;
