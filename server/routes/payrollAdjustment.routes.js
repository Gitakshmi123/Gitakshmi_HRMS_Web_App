const express = require('express');
const router = express.Router();
const payrollAdjustmentController = require('../controllers/payrollAdjustment.controller');
const auth = require('../middleware/auth.jwt');

// All correction routes require Admin/HR authentication
router.use(auth.authenticate);
router.use(auth.requireHr);

// Route to create a correction
router.post('/', payrollAdjustmentController.createCorrection);

// Route to get corrections for a specific run
router.get('/run/:runId', payrollAdjustmentController.getRunCorrections);

// Route to get pending adjustments (optionally for a month)
router.get('/pending', payrollAdjustmentController.getPendingAdjustments);

// Route to cancel a pending adjustment
router.delete('/:id', payrollAdjustmentController.cancelAdjustment);

// Maker-Checker Approval Routes
router.patch('/:id/approve', payrollAdjustmentController.approveCorrection);
router.patch('/:id/reject', payrollAdjustmentController.rejectCorrection);

module.exports = router;
