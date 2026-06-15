const express = require('express');
const router = express.Router();
const salaryRevisionController = require('../controllers/salaryRevision.controller');
const auth = require('../middleware/auth.jwt');

/**
 * Salary Revision Routes
 * 
 * Handles:
 * - Increments
 * - Revisions
 * - Promotions
 * 
 * All routes require authentication
 */

// Create new salary revision (increment/revision/promotion)
router.post(
    '/employees/:id/salary-revision',
    auth.authenticate,
    auth.requireHr,
    salaryRevisionController.createSalaryRevision
);

// Get all pending revisions (for HR approval)
router.get(
    '/salary-revisions/pending',
    auth.authenticate,
    auth.requireHr,
    salaryRevisionController.getPendingRevisions
);

// Get specific revision by ID
router.get(
    '/salary-revisions/:id',
    auth.authenticate,
    auth.requireHr,
    salaryRevisionController.getRevisionById
);

// Approve salary revision
router.post(
    '/salary-revisions/:id/approve',
    auth.authenticate,
    auth.requireHr,
    salaryRevisionController.approveSalaryRevision
);

// Reject salary revision
router.post(
    '/salary-revisions/:id/reject',
    auth.authenticate,
    auth.requireHr,
    salaryRevisionController.rejectSalaryRevision
);

// Delete draft revision
router.delete(
    '/salary-revisions/:id',
    auth.authenticate,
    auth.requireHr,
    salaryRevisionController.deleteDraftRevision
);

// Get employee salary history
router.get(
    '/employees/:id/salary-history',
    auth.authenticate,
    salaryRevisionController.getEmployeeSalaryHistory
);

module.exports = router;
