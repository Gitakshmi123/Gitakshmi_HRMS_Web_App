const express = require('express');
const router = express.Router();

router.use((req, res, next) => {
    console.log(`[DEBUG_EMPLOYEE_ROUTER] ${req.method} ${req.path}`);
    next();
});

const auth = require('../middleware/auth.jwt');
const checkModuleAccess = require('../middleware/moduleAccess.middleware');
const requireActiveEmployee = require('../middleware/requireActiveEmployee');
const { checkPermission } = require('../middleware/rbac.middleware');
const leaveCheck = checkModuleAccess('leave');
const empCtrl = require('../controllers/employee.controller');
const employeeSalaryController = require('../controllers/employeeSalary.controller');
const requestCtrl = require('../controllers/leaveRequest.controller');
const leavePolicyCtrl = require('../controllers/leavePolicy.controller');
const payslipCtrl = require('../controllers/payslip.controller');
const attendCtrl = require('../controllers/attendance.controller'); // Import Attendance Controller
const payrollPhase1Ctrl = require('../controllers/payrollPhase1.controller');
const hierarchyController = require('../controllers/hierarchy.controller');
const hierarchy = require('../middleware/hierarchy.middleware');

// Enterprise hierarchy employee collection:
// GET/POST /api/employees
router.get('/', auth.authenticate, hierarchy.filterByScope, hierarchyController.listEmployees);
router.post(
    '/',
    auth.authenticate,
    hierarchy.filterByScope,
    hierarchy.authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'),
    hierarchy.hierarchyValidationMiddleware,
    hierarchyController.createEmployee
);

// profile (GET allowed for deactivated to show banner; write blocked by requireActiveEmployee)
router.get('/profile', auth.authenticate, empCtrl.getProfile);
router.post('/profile/ensure-policy', auth.authenticate, requireActiveEmployee, empCtrl.ensureMyPolicy);

// attendance
router.post('/attendance/toggle', auth.authenticate, checkPermission('employee.attendance', 'create'), requireActiveEmployee, attendCtrl.punch);
router.get('/attendance', auth.authenticate, checkPermission('employee.attendance', 'view'), attendCtrl.getMyAttendance);

// leaves
router.post('/leaves/apply', auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'view'), requireActiveEmployee, requestCtrl.applyLeave);
router.put('/leaves/edit/:id', auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'edit'), requireActiveEmployee, requestCtrl.editLeave);
router.post('/leaves/cancel/:id', auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'delete'), requireActiveEmployee, requestCtrl.cancelLeave);
router.post('/leaves/early-return/:id', auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'edit'), requireActiveEmployee, requestCtrl.earlyReturn);
router.get('/leaves/history', auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'view'), requestCtrl.getMyLeaves);
router.get('/leaves/balances', auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'view'), requestCtrl.getMyBalances);
router.get('/leaves/approved-dates', auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'view'), requestCtrl.getApprovedDates);
router.post('/leaves/opening-balance', auth.authenticate, leaveCheck, auth.requireHr, requestCtrl.setOpeningBalance);
router.get('/leaves/ledger', auth.authenticate, leaveCheck, requestCtrl.getLeaveLedger);
router.get('/leaves/workforce-visibility', auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'view'), requestCtrl.getWorkforceVisibility);


// leave encashment (employee side)
const encashmentCtrl = require('../controllers/leaveEncashment.controller');
router.get('/leaves/encashment/config', auth.authenticate, leaveCheck, encashmentCtrl.getConfig);
router.get('/leaves/encashment/requests', auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'view'), encashmentCtrl.getMyRequests);
router.post('/leaves/encashment/requests', auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'view'), requireActiveEmployee, encashmentCtrl.applyRequest);
router.post('/leaves/encashment/requests/:id/cancel', auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'delete'), requireActiveEmployee, encashmentCtrl.cancelRequest);

// leave policies applicable to the current employee
router.get(['/leaves/policies', '/leave-policies'], auth.authenticate, leaveCheck, checkPermission('employee.attendance', 'view'), leavePolicyCtrl.getMyPolicies);

// Regularization
const regCtrl = require('../controllers/regularization.controller');
router.post('/regularization', auth.authenticate, checkPermission('employee.attendance', 'create'), requireActiveEmployee, regCtrl.createRequest);
router.get('/regularization/my', auth.authenticate, checkPermission('employee.attendance', 'view'), regCtrl.getMyRequests);

// Team Lead routes
router.get('/leaves/team-requests', auth.authenticate, leaveCheck, checkPermission('leave.requests', 'view'), requestCtrl.getTeamLeaves);
router.post('/leaves/requests/:id/approve', auth.authenticate, leaveCheck, checkPermission('leave.requests', 'edit'), requireActiveEmployee, requestCtrl.approveLeave);
router.post('/leaves/requests/:id/reject', auth.authenticate, leaveCheck, checkPermission('leave.requests', 'edit'), requireActiveEmployee, requestCtrl.rejectLeave);

router.get('/regularization/team-requests', auth.authenticate, checkPermission('attendance.dashboard', 'view'), regCtrl.getTeamRequests);
router.post('/regularization/requests/:id/approve', auth.authenticate, checkPermission('attendance.dashboard', 'edit'), requireActiveEmployee, regCtrl.approveRequest);
router.post('/regularization/requests/:id/reject', auth.authenticate, checkPermission('attendance.dashboard', 'edit'), requireActiveEmployee, regCtrl.rejectRequest);


// payslips
router.get('/payslips', auth.authenticate, checkPermission('employee.payslips', 'view'), payslipCtrl.getMyPayslips);
router.post('/payslips/:id/generate-pdf', auth.authenticate, checkPermission('employee.payslips', 'view'), payslipCtrl.generatePayslipPDF);
router.get('/tax-profile', auth.authenticate, checkPermission('employee.payslips', 'view'), payrollPhase1Ctrl.getMyTaxProfile);
router.post('/tax-profile', auth.authenticate, checkPermission('employee.payslips', 'view'), requireActiveEmployee, payrollPhase1Ctrl.createMyTaxProfile);
router.get('/reporting-tree', auth.authenticate, checkPermission('overview.dashboard', 'view'), empCtrl.getReportingTree);
router.get('/birthdays-today', auth.authenticate, requireActiveEmployee, empCtrl.getBirthdaysToday);
router.get('/birthdays/:id/wishes', auth.authenticate, requireActiveEmployee, empCtrl.getBirthdayWishes);
router.post('/birthdays/:id/wish', auth.authenticate, requireActiveEmployee, empCtrl.addBirthdayWish);

// Enterprise hierarchy role assignment:
// PATCH /api/employees/:employeeId/assign-role
router.patch(
    '/:employeeId/assign-role',
    auth.authenticate,
    hierarchy.filterByScope,
    hierarchy.authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD'),
    hierarchyController.assignRole
);

// Salary Assignment (New Requirement)
router.post('/:id/salary-assignment', auth.requireHr, employeeSalaryController.assignSalary);
router.get('/:id/salary-assignment', auth.requireHr, employeeSalaryController.getSalaryAssignment);

// Bulk Employee Upload Routes
router.get('/bulk/template', auth.requireHr, empCtrl.downloadEmployeeTemplate);
router.post('/bulk/upload', auth.requireHr, empCtrl.bulkUploadEmployees);

router.get('/:id', auth.authenticate, hierarchy.filterByScope, hierarchyController.getEmployee);
router.put(
    '/:id',
    auth.authenticate,
    hierarchy.filterByScope,
    hierarchy.authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'),
    hierarchy.hierarchyValidationMiddleware,
    hierarchyController.updateEmployee
);

// 404 Catch-all for Employee router
router.use((req, res) => {
    console.warn(`[EMPLOYEE_ROUTER_404] ${req.method} ${req.originalUrl} - No route matched in employee router.`);
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found in employee module.` });
});

module.exports = router;
// exported above
