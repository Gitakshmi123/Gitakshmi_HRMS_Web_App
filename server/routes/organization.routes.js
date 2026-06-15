const express = require('express');
const auth = require('../middleware/auth.jwt');
const controller = require('../controllers/organization.controller');
const hierarchyController = require('../controllers/hierarchy.controller');

const router = express.Router();
const protect = auth.authenticate;

router.get('/sub-companies', protect, controller.getSubCompanies);
router.get('/branches', protect, controller.getBranches);
router.get('/divisions', protect, controller.getDivisions);
router.get('/departments', protect, controller.getDepartments);
router.get('/designations', protect, controller.getDesignations);
router.get('/employees', protect, controller.getEmployees);
router.get('/assignable-employees', protect, controller.listAssignableEmployees);
router.get('/potential-heads', protect, controller.listPotentialHeads);
router.get('/preview-code', protect, controller.previewCode);

router.post('/branch', protect, controller.createBranch);
router.post('/division', protect, controller.createDivision);
router.post('/department', protect, controller.createDepartment);
router.post('/designation', protect, controller.createDesignation);
router.post('/designation/:designationId/assign-employee', protect, controller.assignEmployeeToDesignation);
router.post('/employee', protect, controller.createEmployee);
router.post('/sub-company', protect, controller.createSubCompany);

router.put('/sub-company/:id', protect, hierarchyController.updateSubCompany);
router.put('/branch/:id', protect, hierarchyController.updateBranch);
router.put('/division/:id', protect, hierarchyController.updateDivision);
router.put('/department/:id', protect, hierarchyController.updateDepartment);
router.put('/designation/:id', protect, hierarchyController.updateDesignation);
router.put('/employee/:id', protect, hierarchyController.updateEmployee);

// Delete Routes
router.delete('/sub-company/:id', protect, hierarchyController.deleteSubCompany);
router.delete('/branch/:id', protect, hierarchyController.deleteBranch);
router.delete('/division/:id', protect, hierarchyController.deleteDivision);
router.delete('/department/:id', protect, hierarchyController.deleteDepartment);
router.delete('/designation/:id', protect, hierarchyController.deleteDesignation);
router.delete('/employee/:id', protect, hierarchyController.deleteEmployee);

module.exports = router;
