const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const psaCtrl = require('../controllers/psa.hr.controller');
const tenantCtrl = require('../controllers/tenant.controller');

// PSA: list all employees across tenants
if (typeof psaCtrl.listAll === 'function') {
	router.get('/hr/employees', auth.authenticate, auth.requirePsa, psaCtrl.listAll);
}

if (typeof psaCtrl.get === 'function') {
	router.get('/hr/employees/:id', auth.authenticate, auth.requirePsa, psaCtrl.get);
}

// PSA: one-time migration endpoint to backfill tenant codes (slug+3digits)
if (typeof tenantCtrl.migrateTenantCodes === 'function') {
	router.post('/migrate-tenant-codes', auth.authenticate, auth.requirePsa, tenantCtrl.migrateTenantCodes);
}

module.exports = router;
