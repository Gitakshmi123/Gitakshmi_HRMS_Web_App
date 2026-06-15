const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/activity.controller');
const auth = require('../middleware/auth.jwt');

// PSA: Get all activities across all tenants
router.get('/psa/all', auth.authenticate, auth.requirePsa, ctrl.getAllActivities);

// Tenant-scoped: Get activities for current tenant
router.get('/', auth.authenticate, ctrl.getRecent);
router.post('/', auth.authenticate, ctrl.create);
router.delete('/:id', auth.authenticate, ctrl.delete);

module.exports = router;
