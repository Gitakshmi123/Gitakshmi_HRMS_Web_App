const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const checkModuleAccess = require('../middleware/moduleAccess.middleware');
const leaveCheck = checkModuleAccess('leave');
const hrCheck = checkModuleAccess('hr');
const { checkPermission } = require('../middleware/rbac.middleware');

// Apply hr search check strictly to all HR module routes
router.use('/hr', hrCheck);

const empCtrl = require('../controllers/hr.employee.controller');
const deptCtrl = require('../controllers/hr.department.controller');
const policyCtrl = require('../controllers/leavePolicy.controller');
const leaveTypeCtrl = require('../controllers/leaveType.controller');
const requestCtrl = require('../controllers/leaveRequest.controller');
const leaveAnalyticsCtrl = require('../controllers/leaveAnalytics.controller');
const applicantCtrl = require('../controllers/applicant.controller');
const trackerCtrl = require('../controllers/trackerController');
const reqCtrl = require('../controllers/requirement.controller');

// Multer Config for Resume Parsing
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

/* -----------------------------------------
   EMPLOYEES
----------------------------------------- */
router.get('/hr/employees', auth.authenticate, checkPermission('people.employees', 'view'), empCtrl.list);
router.get('/hr/applicants', auth.authenticate, checkPermission('hiring.tracker', 'view'), reqCtrl.getApplicants);
router.post('/hr/employees', auth.authenticate, checkPermission('people.employees', 'create'), empCtrl.create);

// APPLICANTS - RESUME PARSING
router.post('/hr/applicants/parse-resume', auth.requireHr, upload.single('resume'), applicantCtrl.parseResume);
router.get('/hr/resume/:filename', auth.requireHr, applicantCtrl.getResumeFile);


// ⚠️ SPECIFIC ROUTES BEFORE GENERIC :ID ROUTES (important for Express routing)
// Employee ID Preview (Auto-generate preview request)
router.post('/hr/employees/preview', auth.requireHr, empCtrl.preview);

router.get('/hr/employees/me', auth.authenticate, empCtrl.me);
router.get('/hr/employees/top-level', auth.authenticate, checkPermission('people.employees', 'view'), auth.requireHr, empCtrl.getTopLevelEmployees);
router.get('/hr/employees/hierarchy', auth.authenticate, checkPermission('people.employees', 'view'), auth.requireHr, empCtrl.getHierarchy);

// ID-based routes
router.get('/hr/employees/:id', auth.authenticate, checkPermission('people.employees', 'view'), empCtrl.get);
router.get('/hr/employees/:id/leave-balance', auth.authenticate, checkPermission('people.employees', 'view'), empCtrl.getLeaveBalance);
router.put('/hr/employees/:id', auth.authenticate, checkPermission('people.employees', 'edit'), empCtrl.update);
router.delete('/hr/employees/:id', auth.authenticate, checkPermission('people.employees', 'delete'), empCtrl.remove);
router.post('/hr/employees/:id/set-manager', auth.authenticate, checkPermission('people.employees', 'edit'), auth.requireHr, empCtrl.setManager);
router.delete('/hr/employees/:id/manager', auth.authenticate, checkPermission('people.employees', 'edit'), auth.requireHr, empCtrl.removeManager);
router.get('/hr/employees/:id/direct-reports', auth.authenticate, checkPermission('people.employees', 'view'), auth.requireHr, empCtrl.directReports);
router.get('/hr/employees/:id/manager', auth.authenticate, checkPermission('people.employees', 'view'), auth.requireHr, empCtrl.getManager);
router.get('/hr/employees/:id/reporting-chain', auth.authenticate, checkPermission('people.employees', 'view'), auth.requireHr, empCtrl.reportingChain);
router.get('/hr/employees/:id/org-tree', auth.authenticate, checkPermission('people.org', 'view'), auth.requireHr, empCtrl.orgTree);

/* -----------------------------------------
   ORG ROOT & COMPANY TREE
----------------------------------------- */
router.get('/hr/org/root', auth.authenticate, checkPermission('people.org', 'view'), auth.requireHr, empCtrl.getOrgRoot);
router.post('/hr/org/root', auth.authenticate, checkPermission('people.org', 'edit'), auth.requireHr, empCtrl.setOrgRoot);
router.get('/hr/org/tree', auth.authenticate, checkPermission('people.org', 'view'), auth.requireHr, empCtrl.companyOrgTree);

/* -----------------------------------------
   DEPARTMENTS
----------------------------------------- */
router.get('/hr/departments', auth.authenticate, checkPermission('people.departments', 'view'), deptCtrl.list);
router.post('/hr/departments', auth.authenticate, checkPermission('people.departments', 'create'), deptCtrl.create);
router.put('/hr/departments/:id', auth.authenticate, checkPermission('people.departments', 'edit'), deptCtrl.update);
router.delete('/hr/departments/:id', auth.authenticate, checkPermission('people.departments', 'delete'), deptCtrl.remove);
router.get('/hr/departments/hierarchy/full', auth.authenticate, checkPermission('people.departments', 'view'), auth.requireHr, deptCtrl.getFullOrgHierarchy);
router.post('/hr/departments/bulk-upload', auth.authenticate, checkPermission('people.departments', 'create'), deptCtrl.bulkUploadDepartments);

/* -----------------------------------------
   LEAVES
----------------------------------------- */
/* -----------------------------------------
   LEAVE POLICIES
----------------------------------------- */
// Test route
router.get('/hr/leave-policies/test', auth.requireHr, (req, res) => {
   res.json({ message: 'Test route works', user: req.user, tenantId: req.tenantId });
});

// Formula Simulation & Explanation Routes
const formulaSimCtrl = require('../controllers/formulaSimulationController');
router.post('/hr/formula/simulate', auth.authenticate, checkPermission('leave.policies', 'view'), formulaSimCtrl.simulateFormula);
router.post('/hr/formula/explain', auth.authenticate, checkPermission('leave.policies', 'view'), formulaSimCtrl.explainFormula);

router.post('/hr/leave-policies', auth.authenticate, checkPermission('leave.policies', 'create'), policyCtrl.createPolicy);
router.get('/hr/leave-policies', auth.authenticate, checkPermission('leave.policies', 'view'), policyCtrl.getPolicies);
router.get('/hr/leave-policies/custom/mappings', auth.authenticate, checkPermission('leave.policies', 'view'), policyCtrl.getCustomMappings);
router.post('/hr/leave-policies/custom/mappings', auth.authenticate, checkPermission('leave.policies', 'create'), auth.requireHr, policyCtrl.createCustomMapping);
router.put('/hr/leave-policies/custom/mappings/:id', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, policyCtrl.updateCustomMapping);
router.delete('/hr/leave-policies/custom/mappings/:id', auth.authenticate, checkPermission('leave.policies', 'delete'), auth.requireHr, policyCtrl.deleteCustomMapping);
router.post('/hr/leave-policies/custom/apply', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, policyCtrl.applyCustomMappings);
router.get('/hr/leave-policies/:id', auth.authenticate, checkPermission('leave.policies', 'view'), policyCtrl.getPolicyById);
router.put('/hr/leave-policies/:id', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, policyCtrl.updatePolicy);
router.post('/hr/leave-policies/:id/sync', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, policyCtrl.syncPolicy);
// Leave Types
router.post('/hr/leave-types', auth.authenticate, checkPermission('leave.policies', 'create'), auth.requireHr, leaveTypeCtrl.createLeaveType);
router.get('/hr/leave-types', auth.authenticate, checkPermission('leave.policies', 'view'), leaveTypeCtrl.getLeaveTypes);
router.put('/hr/leave-types/:id', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, leaveTypeCtrl.updateLeaveType);
router.delete('/hr/leave-types/:id', auth.authenticate, checkPermission('leave.policies', 'delete'), auth.requireHr, leaveTypeCtrl.deleteLeaveType);

router.post('/hr/leave-policies/apply-existing', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, policyCtrl.applyPolicyToExistingEmployees);
router.patch('/hr/leave-policies/:id/status', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, policyCtrl.togglePolicyStatus);
router.delete('/hr/leave-policies/:id', auth.authenticate, checkPermission('leave.policies', 'delete'), auth.requireHr, policyCtrl.deletePolicy);
router.post('/hr/assign-policy', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, policyCtrl.assignPolicyToEmployee);

// DEBUG: Create & assign default policy to all employees (HR only)
router.post('/hr/leave-policies/ensure-default', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, policyCtrl.ensureDefaultPolicyForTenant);

// Accrual Endpoints (HR only)
router.post('/hr/leave-policies/accrual/run-monthly', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, policyCtrl.accrueMonthly);
router.post('/hr/leave-policies/accrual/run-carryforward', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, policyCtrl.carryForward);

/* -----------------------------------------
   REGULARIZATION (Admin)
----------------------------------------- */
const regCtrl = require('../controllers/regularization.controller');
router.get('/hr/regularization', auth.authenticate, checkPermission('leave.requests', 'view'), auth.requireHr, regCtrl.getAllRequests);
router.post('/hr/regularization/:id/approve', auth.authenticate, checkPermission('leave.requests', 'edit'), auth.requireHr, regCtrl.approveRequest);
router.post('/hr/regularization/:id/reject', auth.authenticate, checkPermission('leave.requests', 'edit'), auth.requireHr, regCtrl.rejectRequest);

/* -----------------------------------------
   LEAVE REQUESTS (HR APPROVALS)
----------------------------------------- */
router.get('/hr/leaves/requests', auth.authenticate, checkPermission('leave.requests', 'view'), requestCtrl.getAllLeaves);
router.post('/hr/leaves/requests/:id/approve', auth.authenticate, checkPermission('leave.requests', 'edit'), requestCtrl.approveLeave);
router.post('/hr/leaves/requests/:id/reject', auth.authenticate, checkPermission('leave.requests', 'edit'), requestCtrl.rejectLeave);

// Leave Analytics Endpoints
router.get('/hr/leaves/analytics/policy-assignments', auth.authenticate, checkPermission('leave.policies', 'view'), leaveAnalyticsCtrl.getPolicyAssignmentAnalytics);
router.get('/hr/leaves/analytics/policy-assignments/:policyId/employees', auth.authenticate, checkPermission('leave.policies', 'view'), leaveAnalyticsCtrl.getEmployeesForPolicy);
router.get('/hr/leaves/analytics/balances', auth.authenticate, checkPermission('leave.policies', 'view'), leaveAnalyticsCtrl.getLeaveBalanceAnalytics);
router.get('/hr/leaves/analytics/utilization', auth.authenticate, checkPermission('leave.policies', 'view'), leaveAnalyticsCtrl.getLeaveUtilizationReport);
router.get('/hr/leaves/analytics/pending', auth.authenticate, checkPermission('leave.requests', 'view'), leaveAnalyticsCtrl.getPendingLeaveReport);
router.get('/hr/leaves/analytics/ledger-audit', auth.authenticate, checkPermission('leave.policies', 'view'), leaveAnalyticsCtrl.getLeaveLedgerAuditReport);
router.get('/hr/leaves/analytics/monthly-trends', auth.authenticate, checkPermission('leave.policies', 'view'), leaveAnalyticsCtrl.getMonthlyLeaveTrends);
router.get('/hr/leaves/analytics/high-users', auth.authenticate, checkPermission('leave.policies', 'view'), leaveAnalyticsCtrl.getHighLeaveUsers);
router.get('/hr/leaves/analytics/sick-leave', auth.authenticate, checkPermission('leave.policies', 'view'), leaveAnalyticsCtrl.getSickLeaveAnalysis);
router.get('/hr/leaves/analytics/liability', auth.authenticate, checkPermission('leave.policies', 'view'), leaveAnalyticsCtrl.getLeaveLiability);
router.get('/hr/leaves/analytics/all-requests', auth.authenticate, checkPermission('leave.requests', 'view'), leaveAnalyticsCtrl.getAllLeaveRequestsReport);
router.get('/hr/leaves/analytics/employee-summary', auth.authenticate, checkPermission('leave.policies', 'view'), leaveAnalyticsCtrl.getEmployeeLeaveSummary);
router.get('/hr/leaves/analytics/master-report', auth.authenticate, checkPermission('leave.policies', 'view'), leaveAnalyticsCtrl.getMasterLeaveReport);
router.post('/hr/leaves/analytics/import-opening-balances', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, leaveAnalyticsCtrl.importOpeningBalances);

// Leave Encashment (HR)
const encashmentCtrl = require('../controllers/leaveEncashment.controller');
router.get('/hr/leaves/encashment/config', auth.authenticate, checkPermission('leave.policies', 'view'), encashmentCtrl.getConfig);
router.post('/hr/leaves/encashment/config', auth.authenticate, checkPermission('leave.policies', 'edit'), auth.requireHr, encashmentCtrl.saveConfig);
router.get('/hr/leaves/encashment/requests', auth.authenticate, checkPermission('leave.requests', 'view'), encashmentCtrl.getAllRequests);
router.post('/hr/leaves/encashment/requests/:id/approve', auth.authenticate, checkPermission('leave.requests', 'edit'), auth.requireHr, encashmentCtrl.approveRequest);
router.post('/hr/leaves/encashment/requests/:id/reject', auth.authenticate, checkPermission('leave.requests', 'edit'), auth.requireHr, encashmentCtrl.rejectRequest);

// Calendar (HR) - Month overview and day detail
const calendarCtrl = require('../controllers/calendar.controller');
if (calendarCtrl && typeof calendarCtrl.getCalendar === 'function') {
   router.get('/hr/calendar', auth.authenticate, checkPermission('attendance.calendar', 'view'), auth.requireHr, calendarCtrl.getCalendar);
}
if (calendarCtrl && typeof calendarCtrl.getCalendarDetail === 'function') {
   router.get('/hr/calendar/detail', auth.authenticate, checkPermission('attendance.calendar', 'view'), auth.requireHr, calendarCtrl.getCalendarDetail);
}
if (calendarCtrl && typeof calendarCtrl.getAttendanceCalendar === 'function') {
   router.get('/hr/attendance-calendar', auth.authenticate, checkPermission('attendance.calendar', 'view'), auth.requireHr, calendarCtrl.getAttendanceCalendar);
}
if (calendarCtrl && typeof calendarCtrl.getAttendanceCalendarDetail === 'function') {
   router.get('/hr/attendance-calendar/detail', auth.authenticate, checkPermission('attendance.calendar', 'view'), auth.requireHr, calendarCtrl.getAttendanceCalendarDetail);
}
if (calendarCtrl && typeof calendarCtrl.getWorkforceAnalyticsCalendar === 'function') {
   router.get('/hr/workforce-analytics-calendar', auth.authenticate, checkPermission('attendance.calendar', 'view'), auth.requireHr, calendarCtrl.getWorkforceAnalyticsCalendar);
}


// Offer Templates
router.use('/hr/offer-templates', require('./offerTemplate.routes'));

// Career Builder
router.use('/hr/career', require('./career.routes'));

// Bulk Upload Template
router.get('/hr/bulk/template', auth.authenticate, checkPermission('people.employees', 'view'), auth.requireAdminOrHr, empCtrl.downloadBulkUploadTemp);
router.post('/hr/bulk/upload', auth.authenticate, checkPermission('people.employees', 'create'), auth.requireAdminOrHr, empCtrl.bulkUploadEmployees);

/* -----------------------------------------
   CANDIDATE STATUS TRACKER
----------------------------------------- */
router.get('/hr/candidate-status', auth.authenticate, checkPermission('hiring.tracker', 'view'), trackerCtrl.getCandidates);
router.get('/hr/candidate-status/candidates/:id', auth.authenticate, checkPermission('hiring.tracker', 'view'), trackerCtrl.getCandidateById);
router.get('/hr/candidate-status/:id', auth.authenticate, checkPermission('hiring.tracker', 'view'), trackerCtrl.getCandidateById);
router.get('/hr/candidate-status/:id/timeline', auth.authenticate, checkPermission('hiring.tracker', 'view'), trackerCtrl.getTimeline);
router.get('/hr/candidate/:id/status', auth.authenticate, checkPermission('hiring.tracker', 'view'), trackerCtrl.getStatus);
router.post('/hr/candidate-status/:id/status', auth.authenticate, checkPermission('hiring.tracker', 'edit'), trackerCtrl.updateStatus);
router.post('/hr/candidate-status/seed', auth.authenticate, auth.requirePsa, trackerCtrl.seedData);

module.exports = router;
