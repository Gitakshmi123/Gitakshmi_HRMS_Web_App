const express = require('express');
const router = express.Router();
const payrollController = require('../controllers/payroll.controller');

const benefitController = require('../controllers/benefit.controller');
const payrollRunController = require('../controllers/payrollRun.controller');
const payslipController = require('../controllers/payslip.controller');
const salaryTemplateController = require('../controllers/salaryTemplate.controller');
const salaryAssignmentController = require('../controllers/salaryAssignment.controller');
const payrollCanonicalController = require('../controllers/payrollCanonical.controller');
const payrollPhase1Controller = require('../controllers/payrollPhase1.controller');
const payrollPhase2Controller = require('../controllers/payrollPhase2.controller');
const auth = require('../middleware/auth.jwt');
const checkModuleAccess = require('../middleware/moduleAccess.middleware');
const { checkPermission } = require('../middleware/rbac.middleware');
const tenantMiddleware = require('../middleware/tenant.middleware');
const minimumWageController = require('../controllers/minimumWage.controller');

const payrollProcessController = require('../controllers/payrollProcess.controller');

const payrollDashboardController = require('../controllers/payrollDashboard.controller');
const debugRoutesEnabled =
	String(process.env.ENABLE_DEBUG_ROUTES || '').trim().toLowerCase() === 'true';
const elevatedPayslipRoles = new Set([
	'psa',
	'super_admin',
	'admin',
	'company_super_admin',
	'company_admin',
	'hr',
	'hr_admin',
]);

function allowPayslipPdfAccess(req, res, next) {
	const roleName = auth.normalizeRoleName(req.user?.role || '');
	if (elevatedPayslipRoles.has(roleName)) {
		return next();
	}

	return checkPermission(['employee.payslips', 'payroll.payslips'], 'view')(req, res, next);
}

// Apply auth and tenant middleware to all payroll routes
router.use(auth.authenticate);
router.use(checkModuleAccess('payroll'));
router.use(tenantMiddleware);

if (debugRoutesEnabled) {
	router.get('/debug-me', auth.requirePsa, async (req, res) => {
		try {
			res.json({
				success: true,
				user: req.user,
				tenant: req.tenantId,
				dbName: req.tenantDB ? req.tenantDB.name : 'NONE',
				availableModels: Object.keys(req.tenantDB?.models || {})
			});
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});

	router.get('/test-comp', auth.requirePsa, async (req, res) => {
		try {
			const EmployeeCompensation = req.tenantDB.model('EmployeeCompensation');
			const Employee = req.tenantDB.model('Employee');
			// Get all active employees with their compensations
			const employees = await Employee.find({ status: { $regex: /^active$/i } });
			const results = [];
			for (let emp of employees) {
				const comp = await EmployeeCompensation.findOne({ employeeId: emp._id, status: 'ACTIVE' });
				results.push({
					name: `${emp.firstName} ${emp.lastName}`,
					compensation: comp
				});
			}
			res.json({ success: true, data: results });
		} catch (err) {
			res.status(500).json({ error: err.message });
		}
	});
}

// Admin-only setup: seed default components (safe to run multiple times)
router.post('/setup/default-components', auth.authorize('admin'), (req, res, next) => {
	// delegate to controller
	const payrollController = require('../controllers/payroll.controller');
	return payrollController.seedDefaultComponents(req, res, next);
});

// Earnings Routes (HR Only)
router.use('/earnings', auth.requireHr);
router.post('/earnings', payrollController.createEarning);
router.get('/earnings', payrollController.getEarnings);
router.put('/earnings/:id', payrollController.updateEarning);
router.delete('/earnings/:id', payrollController.deleteEarning);

// Benefits Routes (HR Only)
router.use('/benefits', auth.requireHr);
router.post('/benefits', benefitController.createBenefit);
router.get('/benefits', benefitController.getBenefits);
router.get('/benefits/:id', benefitController.getBenefitById);
router.put('/benefits/:id', benefitController.updateBenefit);
router.delete('/benefits/:id', benefitController.deleteBenefit);
router.patch('/benefits/:id/status', benefitController.toggleStatus);

// Minimum Wage Routes (HR Only)
router.get('/minimum-wages', auth.requireHr, minimumWageController.getAll);
router.post('/minimum-wages', auth.requireHr, minimumWageController.create);
router.put('/minimum-wages/:id', auth.requireHr, minimumWageController.update);
router.delete('/minimum-wages/:id', auth.requireHr, minimumWageController.delete);

// Salary template and assignment routes used by payroll UI
router.get('/salary-templates', auth.requireHr, salaryTemplateController.getTemplates);
router.post('/salary-templates', auth.requireHr, salaryTemplateController.createTemplate);
router.get('/salary-templates/:id', auth.requireHr, salaryTemplateController.getTemplateById);
router.put('/salary-templates/:id', auth.requireHr, salaryTemplateController.updateTemplate);
router.get('/salary-templates/:id/preview', auth.requireHr, salaryTemplateController.previewTemplate);
router.post('/calculate-breakup', auth.requireHr, salaryTemplateController.calculateBreakup);
router.post('/upload-ctc-excel', auth.requireHr, salaryTemplateController.uploadCtcExcel);
router.post('/assign-template', auth.requireHr, salaryAssignmentController.assignTemplate);
router.post('/assign-salary-excel', auth.requireHr, salaryAssignmentController.assignSalaryExcel);
router.get('/history/:employeeId', auth.requireHr, salaryAssignmentController.getAssignmentHistory);

// Canonical payroll data routes for salary versions and effective-dated profiles
router.post('/canonical/migrate', auth.requireHr, payrollCanonicalController.migrateCanonicalPayrollData);
router.get('/statutory-rules/current', auth.requireHr, payrollPhase1Controller.getCurrentStatutoryRuleSet);
router.post('/statutory-rules', auth.requireHr, payrollPhase1Controller.createStatutoryRuleSet);
router.get('/statutory-rules/presets', auth.requireHr, payrollPhase1Controller.getStatutoryRulePresets);
router.post('/statutory-rules/presets/:presetKey/seed', auth.requireHr, payrollPhase1Controller.seedStatutoryRulePreset);
router.get('/employees/:employeeId/payroll-profile', auth.requireHr, payrollCanonicalController.getEmployeePayrollProfile);
router.post('/employees/:employeeId/payroll-profile', auth.requireHr, payrollCanonicalController.createEmployeePayrollProfile);
router.get('/employees/:employeeId/salary-versions', auth.requireHr, payrollCanonicalController.getEmployeeSalaryVersions);
router.post('/employees/:employeeId/salary-versions', auth.requireHr, payrollCanonicalController.createEmployeeSalaryVersion);
router.get('/employees/:employeeId/payroll-validation', auth.requireHr, payrollCanonicalController.validateEmployeePayrollData);
router.get('/employees/:employeeId/tax-profile', auth.requireHr, payrollPhase1Controller.getEmployeeTaxProfile);
router.post('/employees/:employeeId/tax-profile', auth.requireHr, payrollPhase1Controller.createEmployeeTaxProfile);
router.get('/input-batches', auth.requireHr, payrollPhase2Controller.getPayrollInputBatches);
router.post('/input-batches', auth.requireHr, payrollPhase2Controller.createPayrollInputBatch);
router.get('/input-batches/:id', auth.requireHr, payrollPhase2Controller.getPayrollInputBatchById);
router.post('/input-batches/:id/transition', auth.requireHr, payrollPhase2Controller.transitionPayrollInputBatch);
router.post('/phase2/sync-indexes', auth.requireHr, payrollPhase2Controller.syncPhase2Indexes);








// Payroll Run Routes (HR Only)
router.use('/runs', auth.requireHr);
router.get('/filteredEmployees', auth.requireHr, payrollRunController.getFilteredEmployees);
router.post('/runs', payrollRunController.initiatePayrollRun);
router.get('/runs', auth.authenticate, checkPermission('payroll.run', 'view'), payrollRunController.getPayrollRuns);
router.get('/runs/:id', payrollRunController.getPayrollRunById);
router.get('/runs/:id/audit', payrollPhase1Controller.getPayrollRunAudit);
router.get('/runs/:id/summary', auth.requireHr, payrollPhase2Controller.getRunOperationalSummary);
router.get('/runs/:id/exports', auth.requireHr, payrollPhase2Controller.getRunExports);
router.post('/runs/:id/preflight', payrollRunController.preflightPayroll);
router.post('/runs/:id/calculate', payrollRunController.calculatePayroll);
router.post('/runs/:id/submit-approval', auth.requireHr, payrollPhase2Controller.submitRunForApproval);
router.post('/runs/:id/review-approval', auth.requireHr, payrollPhase2Controller.reviewRunApproval);
router.post('/runs/:id/approve', payrollRunController.approvePayroll);
router.post('/runs/:id/generate-exports', auth.requireHr, payrollPhase2Controller.generateRunExports);
router.post('/runs/:id/mark-paid', payrollRunController.markPayrollPaid);
router.post('/runs/:id/cancel', payrollRunController.cancelPayrollRun);

// Payslip Routes - Employee self-service
router.get('/payslips/my', payslipController.getMyPayslips);

// Payslip Preview Route (HR Only)
router.get('/payslips/:employeeId', auth.requireHr, payslipController.getPayslipByEmployeeAndMonth);

// Payslip Routes - HR routes (full access)
router.get('/payslips', auth.requireHr, payslipController.getPayslips);
router.post('/payslips/:id/generate-pdf', allowPayslipPdfAccess, payslipController.generatePayslipPDF);
// router.get('/payslips/:id/download', auth.requireHr, payslipController.downloadPayslipPDF); 




// Dashboard Routes (HR Only) - Analytics and Metrics
router.get('/dashboard', auth.authenticate, checkPermission('payroll.stats', 'view'), payrollDashboardController.getDashboardData);
router.get('/dashboard/stats', auth.requireHr, payrollDashboardController.getQuickStats);

// Setup for payroll process
router.get('/process/employees', auth.requireHr, payrollProcessController.getProcessEmployees);
router.post('/process/preview', auth.requireHr, payrollProcessController.previewPreview);
router.post('/process/run', auth.requireHr, payrollProcessController.runPayroll);

router.post('/bulk-create', auth.requireHr, payrollController.bulkCreateSalaryComponents);

module.exports = router;
