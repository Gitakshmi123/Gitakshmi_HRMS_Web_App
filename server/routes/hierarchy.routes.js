const express = require('express');
const router = express.Router();
const hierarchyController = require('../controllers/hierarchy.controller');
const { verifyToken, authorizeRoles, checkCompanyScope, hierarchyValidationMiddleware } = require('../middleware/hierarchy.middleware');

// All hierarchy routes require token and company scope
router.use(verifyToken);
router.use(checkCompanyScope);

// Dashboard
router.get('/stats', hierarchyController.getDashboardStats);
router.get('/tree', hierarchyController.getHierarchyTree);
router.post('/employees/rebuild-chains', authorizeRoles('SUPER_ADMIN', 'MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN'), hierarchyController.rebuildAllEmployeeReportingChains);

// Singular endpoints used by the dedicated Hierarchy Tree page
router.post('/branch', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN'), hierarchyValidationMiddleware, hierarchyController.createBranch);
router.post('/division', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD'), hierarchyValidationMiddleware, hierarchyController.createDivision);
router.post('/department', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD'), hierarchyValidationMiddleware, hierarchyController.createDepartment);
router.post('/designation', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'), hierarchyValidationMiddleware, hierarchyController.createDesignation);
router.post('/employee', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'), hierarchyValidationMiddleware, hierarchyController.createEmployee);

// Sub Companies (Main Admin Only)
router.post('/sub-companies', authorizeRoles('MAIN_COMPANY_ADMIN'), hierarchyValidationMiddleware, hierarchyController.createSubCompany);
router.get('/sub-companies', authorizeRoles('SUPER_ADMIN', 'MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN'), hierarchyController.listSubCompanies);
router.get('/sub-companies/:id', authorizeRoles('SUPER_ADMIN', 'MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN'), hierarchyController.getSubCompany);
router.put('/sub-companies/:id', authorizeRoles('MAIN_COMPANY_ADMIN'), hierarchyValidationMiddleware, hierarchyController.updateSubCompany);

// Branches
router.post('/branches', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN'), hierarchyValidationMiddleware, hierarchyController.createBranch);
router.get('/branches', hierarchyController.listBranches);
router.get('/branches/:id', hierarchyController.getBranch);
router.put('/branches/:id', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN'), hierarchyValidationMiddleware, hierarchyController.updateBranch);

// Divisions
router.post('/divisions', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD'), hierarchyValidationMiddleware, hierarchyController.createDivision);
router.get('/divisions', hierarchyController.listDivisions);
router.get('/divisions/:id', hierarchyController.getDivision);
router.put('/divisions/:id', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD'), hierarchyValidationMiddleware, hierarchyController.updateDivision);

// Departments
router.post('/departments', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD'), hierarchyValidationMiddleware, hierarchyController.createDepartment);
router.get('/departments', hierarchyController.listDepartments);
router.get('/departments/:id', hierarchyController.getDepartment);
router.put('/departments/:id', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD'), hierarchyValidationMiddleware, hierarchyController.updateDepartment);

// Designations
router.post('/designations', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'), hierarchyValidationMiddleware, hierarchyController.createDesignation);
router.get('/designations', hierarchyController.listDesignations);
router.get('/designations/:id', hierarchyController.getDesignation);
router.put('/designations/:id', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'), hierarchyValidationMiddleware, hierarchyController.updateDesignation);

// Employees
router.get('/employees', hierarchyController.listEmployees);
router.post('/employees', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'), hierarchyValidationMiddleware, hierarchyController.createEmployee);
router.get('/employees/:employeeId/chain', hierarchyController.getEmployeeReportingChain);
router.post('/employees/:employeeId/rebuild-chain', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'), hierarchyController.rebuildEmployeeReportingChain);
router.get('/employees/:id', hierarchyController.getEmployee);
router.put('/employees/:id', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'), hierarchyValidationMiddleware, hierarchyController.updateEmployee);
router.patch('/employees/:employeeId/assign-role', authorizeRoles('MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD'), hierarchyController.assignRole);

module.exports = router;
