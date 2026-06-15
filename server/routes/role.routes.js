const express = require('express');
const router   = express.Router();
const roleCtrl = require('../controllers/role.controller');
const { checkPermission } = require('../middleware/rbac.middleware');
const validateId = require('../middleware/validateId.middleware');
// NOTE: auth middleware is applied by app.js before this router mounts
// (via authenticate + tenantMiddleware), so req.user and req.tenantDB are already set.

/* ── Defaults & Metadata ── */
router.get('/defaults',     checkPermission('configuration.access', 'view'), roleCtrl.getDefaultPermissions);   // GET /roles/defaults?role=employee
router.get('/cache-stats',  checkPermission('configuration.access', 'view'), roleCtrl.getCacheStats);           // GET /roles/cache-stats (debug)
router.get('/audit',        checkPermission('configuration.access', 'view'), roleCtrl.getPermissionAuditLog);   // GET /roles/audit?userId=&limit=&page=
router.get('/',             checkPermission('configuration.access', 'view'), roleCtrl.getRoles);                // GET /roles

/* ── Per-User Permission Management ── */
router.get   ('/user/:userId', validateId('userId'), checkPermission('configuration.access', 'view'), roleCtrl.getUserPermissions);      // GET  /roles/user/:userId
router.put   ('/user/:userId', validateId('userId'), checkPermission('configuration.access', 'edit'), roleCtrl.updateUserPermissions);    // PUT  /roles/user/:userId
router.delete('/user/:userId', validateId('userId'), checkPermission('configuration.access', 'delete'), roleCtrl.resetUserPermissions);   // DEL  /roles/user/:userId

module.exports = router;
