const express = require('express');
const router = express.Router();
const entityController = require('../controllers/entity.controller');
const { authenticate } = require('../middleware/auth.jwt');

// Routes prefixed with /api/entities
router.get('/:entityType/:entityId', authenticate, entityController.getEntityDetails);
router.get('/:entityType/:entityId/access', authenticate, entityController.checkAccess);

module.exports = router;
