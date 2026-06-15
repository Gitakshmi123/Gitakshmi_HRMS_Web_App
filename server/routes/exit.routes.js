const express  = require('express');
const router   = express.Router();
const c        = require('../controllers/exit.controller');
const { requireHr } = require('../middleware/auth.jwt');
const requireActiveEmployee = require('../middleware/requireActiveEmployee');
const { checkPermission } = require('../middleware/rbac.middleware');

// Auth is applied globally: app.use('/api/exit', auth, exitRoutes)

// ── Employee ───────────────────────────────────────────────────────────────────
router.get('/can-submit',      checkPermission('employee.exit', 'view'), c.canSubmit);
router.post('/request',        checkPermission('employee.exit', 'create'), requireActiveEmployee, c.submitRequest);
router.get('/my-requests',     checkPermission('employee.exit', 'view'), c.getMyRequests);
router.put('/clearance/:id',   checkPermission('employee.exit', 'edit'), requireActiveEmployee, c.submitClearanceForm);
router.put('/interview/:id',   checkPermission('employee.exit', 'edit'), requireActiveEmployee, c.submitInterview);

// ── HR only ───────────────────────────────────────────────────────────────────
router.get('/all',             requireHr, c.getAllRequests);      // GET  /api/exit/all
router.get('/requests',        requireHr, c.getAllRequests);      // GET  /api/exit/requests (alias)
router.get('/analytics',       requireHr, c.getAnalytics);       // GET  /api/exit/analytics

router.put('/approve/:id',     requireHr, c.approveRequest);     // PUT  /api/exit/approve/:id
router.put('/reject/:id',      requireHr, c.rejectRequest);      // PUT  /api/exit/reject/:id
router.put('/stage/:id',       requireHr, c.updateStage);        // PUT  /api/exit/stage/:id
router.put('/assets/:id',      requireHr, c.updateAssets);       // PUT  /api/exit/assets/:id
router.put('/tasks/:id',       requireHr, c.updateTasks);        // PUT  /api/exit/tasks/:id
router.get('/fnf/:id/calculate', requireHr, c.calculateFNF);     // GET   /api/exit/fnf/:id/calculate — suggested FNF breakdown
router.put('/fnf/:id',         requireHr, c.processFNF);         // PUT  /api/exit/fnf/:id
router.post('/letters/:id',    requireHr, c.generateLetters);    // POST /api/exit/letters/:id
router.put('/deactivate/:id',  requireHr, c.deactivateEmployee); // PUT  /api/exit/deactivate/:id

module.exports = router;
