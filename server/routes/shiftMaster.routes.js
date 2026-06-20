const express = require('express');
const router = express.Router();
const shiftMasterController = require('../controllers/shiftMaster.controller');
const { authenticate, requireHr } = require('../middleware/auth.jwt');

/**
 * Enterprise Shift Master Routes
 * Base Route: /api/shift-master
 */

// CRUD Routes for Shift Policies
router.get('/', authenticate, requireHr, shiftMasterController.getShifts);
router.get('/:id', authenticate, requireHr, shiftMasterController.getShiftById);

// CREATE NEW SHIFT
router.post('/', authenticate, shiftMasterController.createShift);

// BULK CREATE SHIFTS
router.post('/bulk', authenticate, shiftMasterController.bulkCreateShifts);

// UPDATE SHIFT
router.put('/:id', authenticate, shiftMasterController.updateShift);
router.delete('/:id', authenticate, requireHr, shiftMasterController.deleteShift);

// Rule Builder / Policy Versioning Routes
router.post('/:shiftId/policy', authenticate, requireHr, shiftMasterController.savePolicy);
router.get('/:shiftId/policy', authenticate, requireHr, shiftMasterController.getPolicyHistory);

// Simulation Engine
router.post('/simulate', authenticate, requireHr, shiftMasterController.simulateShiftRule);

module.exports = router;
