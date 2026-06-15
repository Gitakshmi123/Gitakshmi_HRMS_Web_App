const express = require('express');
const router = express.Router();
const deductionController = require('../controllers/deduction.controller');
const auth = require('../middleware/auth.jwt');
const tenantMiddleware = require('../middleware/tenant.middleware');

// Public prefix handled in index.js: /api/deductions and /api/employee-deductions

// Master Deduction Routes
router.post('/create', auth.authenticate, auth.requireHr, tenantMiddleware, deductionController.createDeduction);
router.get('/', auth.authenticate, auth.requireHr, tenantMiddleware, deductionController.getDeductions);
router.put('/:id', auth.authenticate, auth.requireHr, tenantMiddleware, deductionController.updateDeduction);
router.patch('/:id/status', auth.authenticate, auth.requireHr, tenantMiddleware, deductionController.updateStatus);
router.delete('/:id', auth.authenticate, auth.requireHr, tenantMiddleware, deductionController.deleteDeduction);

// Employee Deduction Routes
router.post('/assign', auth.authenticate, auth.requireHr, tenantMiddleware, deductionController.assignToEmployee);
router.get('/employee/:employeeId/plan', auth.authenticate, auth.requireHr, tenantMiddleware, deductionController.getEmployeeDeductionPlan);
router.get('/employee/:employeeId', auth.authenticate, auth.requireHr, tenantMiddleware, deductionController.getEmployeeDeductions);
router.put('/employee-assignment/:assignmentId', auth.authenticate, auth.requireHr, tenantMiddleware, deductionController.updateEmployeeDeduction);
router.delete('/employee-assignment/:assignmentId', auth.authenticate, auth.requireHr, tenantMiddleware, deductionController.deleteEmployeeDeduction);

module.exports = router;
