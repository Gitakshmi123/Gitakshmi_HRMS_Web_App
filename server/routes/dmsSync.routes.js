'use strict';

/**
 * dmsSync.routes.js
 * ══════════════════════════════════════════════════════════════════════
 * Routes for the HRMS → DMS Employee Sync feature.
 * Mounted at: /api/dms-sync
 *
 * All routes require JWT authentication + HR role.
 * ══════════════════════════════════════════════════════════════════════
 */

const router     = require('express').Router();
const auth       = require('../middleware/auth.jwt');
const controller = require('../controllers/dmsSync.controller');

// Auth guard: must be authenticated AND be an HR/Admin user
const guard = [auth.authenticate, auth.requireHr];

/**
 * POST /api/dms-sync/trigger-bulk
 * Triggers a full bulk sync of all HRMS employees → DMS.
 * Optional body: { onlyUnsynced: true, batchSize: 50 }
 */
router.post('/trigger-bulk', guard, controller.syncAllEmployees);

/**
 * POST /api/dms-sync/sync-employee/:employeeId
 * Sync a single employee by their HRMS employeeId string.
 */
router.post('/sync-employee/:employeeId', guard, controller.syncOneEmployee);

/**
 * GET /api/dms-sync/status
 * Returns { total, synced, failed, pending } counts from HRMS DB.
 */
router.get('/status', guard, controller.getSyncStatus);

module.exports = router;
