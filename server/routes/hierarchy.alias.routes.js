const express = require('express');
const hierarchyController = require('../controllers/hierarchy.controller');
const { verifyToken, authorizeRoles, checkCompanyScope, hierarchyValidationMiddleware } = require('../middleware/hierarchy.middleware');

function scopedRouter(entity) {
  const router = express.Router();
  router.use(verifyToken, checkCompanyScope);
  const map = {
    'sub-companies': {
      list: hierarchyController.listSubCompanies,
      create: hierarchyController.createSubCompany,
      get: hierarchyController.getSubCompany,
      update: hierarchyController.updateSubCompany,
      createRoles: ['MAIN_COMPANY_ADMIN'],
      updateRoles: ['MAIN_COMPANY_ADMIN'],
      readRoles: ['SUPER_ADMIN', 'MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN']
    },
    branches: {
      list: hierarchyController.listBranches,
      create: hierarchyController.createBranch,
      get: hierarchyController.getBranch,
      update: hierarchyController.updateBranch,
      createRoles: ['MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN'],
      updateRoles: ['MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN']
    },
    divisions: {
      list: hierarchyController.listDivisions,
      create: hierarchyController.createDivision,
      get: hierarchyController.getDivision,
      update: hierarchyController.updateDivision,
      createRoles: ['MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD'],
      updateRoles: ['MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD']
    },
    departments: {
      list: hierarchyController.listDepartments,
      create: hierarchyController.createDepartment,
      get: hierarchyController.getDepartment,
      update: hierarchyController.updateDepartment,
      createRoles: ['MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD'],
      updateRoles: ['MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD']
    },
    designations: {
      list: hierarchyController.listDesignations,
      create: hierarchyController.createDesignation,
      get: hierarchyController.getDesignation,
      update: hierarchyController.updateDesignation,
      createRoles: ['MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'],
      updateRoles: ['MAIN_COMPANY_ADMIN', 'SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD']
    }
  }[entity];

  router.get('/', ...(map.readRoles ? [authorizeRoles(map.readRoles)] : []), map.list);
  router.post('/', authorizeRoles(map.createRoles), hierarchyValidationMiddleware, map.create);
  router.get('/:id', ...(map.readRoles ? [authorizeRoles(map.readRoles)] : []), map.get);
  router.put('/:id', authorizeRoles(map.updateRoles), hierarchyValidationMiddleware, map.update);
  return router;
}

module.exports = { scopedRouter };
