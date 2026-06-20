const express = require('express');
const router = express.Router();
const shiftAssignmentController = require('../controllers/shiftAssignment.controller');
const { authenticate, requireHr } = require('../middleware/auth.jwt');

/**
 * Base Route: /api/shift-assignment
 */

// CRUD Routes for Shift Assignments
router.post('/', authenticate, requireHr, shiftAssignmentController.createAssignment);
router.get('/', authenticate, requireHr, shiftAssignmentController.getAssignments);
router.delete('/:id', authenticate, requireHr, shiftAssignmentController.deleteAssignment);

module.exports = router;
