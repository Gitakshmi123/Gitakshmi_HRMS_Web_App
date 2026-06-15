import api from '../utils/api';

const unwrap = (response) => response.data;

export const getHierarchyTree = () =>
  api.get('/hierarchy/tree').then(unwrap);

export const createBranch = (data) =>
  api.post('/hierarchy/branch', data).then(unwrap);

export const createDivision = (data) =>
  api.post('/hierarchy/division', data).then(unwrap);

export const createDepartment = (data) =>
  api.post('/hierarchy/department', data).then(unwrap);

export const createDesignation = (data) =>
  api.post('/hierarchy/designation', data).then(unwrap);

export const createEmployee = (data) =>
  api.post('/hierarchy/employee', data).then(unwrap);

export const getEmployeeChain = (employeeId, params = {}) =>
  api.get(`/hierarchy/employees/${employeeId}/chain`, { params }).then(unwrap);

export const rebuildEmployeeChain = (employeeId, data = {}) =>
  api.post(`/hierarchy/employees/${employeeId}/rebuild-chain`, data).then(unwrap);

export const rebuildAllEmployeeChains = () =>
  api.post('/hierarchy/employees/rebuild-chains').then(unwrap);

export default {
  getHierarchyTree,
  createBranch,
  createDivision,
  createDepartment,
  createDesignation,
  createEmployee,
  getEmployeeChain,
  rebuildEmployeeChain,
  rebuildAllEmployeeChains,
};
