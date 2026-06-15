const express = require('express');
const auth = require('../middleware/auth.jwt');
const { checkPermission } = require('../middleware/rbac.middleware');
const controller = require('../controllers/gradeBand.controller');

const router = express.Router();

router.use(auth.authenticate);

router.get('/bands', checkPermission('people.employees', 'view'), controller.listBands);
router.post('/bands', checkPermission('people.employees', 'edit'), controller.createBand);

router.get('/designation-mappings', checkPermission('people.employees', 'view'), controller.listMappings);
router.post('/designation-mappings', checkPermission('people.employees', 'edit'), controller.createMapping);

router.get('/grade-by-designation', checkPermission('people.employees', 'view'), controller.getGradeByDesignation);
router.get('/band-by-salary', checkPermission('people.employees', 'view'), controller.getBandBySalary);
router.get('/payroll-template', checkPermission('people.employees', 'view'), controller.getPayrollTemplate);
router.get('/resolve', checkPermission('people.employees', 'view'), controller.resolveAssignment);
router.post('/resolve', checkPermission('people.employees', 'view'), controller.resolveAssignment);

router.post('/employees/:employeeId/promotion', checkPermission('people.employees', 'edit'), controller.updatePromotion);

module.exports = router;
