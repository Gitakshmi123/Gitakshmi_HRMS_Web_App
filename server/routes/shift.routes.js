const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const shiftCtrl = require('../controllers/shift.controller');

// ─── READ (authenticated users) ──────────────────────────────────────────────

// GET  /api/attendance/shifts                   — list all shifts (tenant-scoped)
router.get('/', auth.authenticate, shiftCtrl.getShifts);

// GET  /api/attendance/shifts/effective/:empId/:date — resolve effective shift for employee on date
router.get('/effective/:employeeId/:date', auth.authenticate, shiftCtrl.fetchEffectiveShift);

// GET  /api/attendance/shifts/:id               — single shift
router.get('/:id', auth.authenticate, shiftCtrl.getShiftById);

// ─── WRITE (HR only) ─────────────────────────────────────────────────────────

// POST /api/attendance/shifts                   — create shift (all 13 sections)
router.post('/', auth.authenticate, auth.requireHr, shiftCtrl.createShift);
router.post('/create', auth.authenticate, auth.requireHr, shiftCtrl.createShift);

// PUT  /api/attendance/shifts/:id               — update shift
router.put('/:id', auth.authenticate, auth.requireHr, shiftCtrl.updateShift);

// PATCH /api/attendance/shifts/:id/status       — toggle Active / Inactive
router.patch('/:id/status', auth.authenticate, auth.requireHr, shiftCtrl.patchStatus);

// DELETE /api/attendance/shifts/:id             — soft delete
router.delete('/:id', auth.authenticate, auth.requireHr, shiftCtrl.deleteShift);

// ─── ASSIGNMENT ENDPOINTS ─────────────────────────────────────────────────────

// POST /api/attendance/shifts/assign            — assign shift to one employee
router.post('/assign', auth.authenticate, auth.requireHr, shiftCtrl.assignShift);

// POST /api/attendance/shifts/bulk-assign       — assign shift to multiple employees
router.post('/bulk-assign', auth.authenticate, auth.requireHr, shiftCtrl.bulkAssignShift);

// POST /api/attendance/shifts/override          — temp date-range override for employee
router.post('/override', auth.authenticate, auth.requireHr, shiftCtrl.overrideShift);

// POST /api/attendance/shifts/bulk-override       — assign shift override to multiple employees
router.post('/bulk-override', auth.authenticate, auth.requireHr, shiftCtrl.bulkOverrideShift);

module.exports = router;
