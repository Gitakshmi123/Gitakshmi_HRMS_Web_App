const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const checkModuleAccess = require('../middleware/moduleAccess.middleware');
const reportCtrl = require('../controllers/report.controller');

const reportsCheck = checkModuleAccess('reports');

router.get('/existing-employees', auth.authenticate, reportsCheck, auth.requireHr, reportCtrl.existingEmployeeReport);
router.get('/replacements', auth.authenticate, reportsCheck, auth.requireHr, reportCtrl.replacementReport);
router.get('/analytics', auth.authenticate, reportsCheck, auth.requireHr, reportCtrl.headcountAnalytics);
router.get('/sla', auth.authenticate, reportsCheck, auth.requireHr, reportCtrl.slaReport);
router.get('/dashboard-summary', auth.authenticate, reportsCheck, auth.requireHr, reportCtrl.dashboardSummary);

module.exports = router;
