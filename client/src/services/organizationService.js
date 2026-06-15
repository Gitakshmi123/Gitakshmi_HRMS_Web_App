import api from '../utils/api';

const data = (response) => response.data;

export const orgService = {
  getSubCompanies: () => api.get('/organization/sub-companies').then(data),
  getBranches: (subCompanyId) => api.get(`/organization/branches?subCompanyId=${encodeURIComponent(subCompanyId)}`).then(data),
  getDivisions: (branchId) => api.get(`/organization/divisions?branchId=${encodeURIComponent(branchId)}`).then(data),
  getDepartments: (divisionId) => api.get(`/organization/departments?divisionId=${encodeURIComponent(divisionId)}`).then(data),
  getDesignations: (departmentId) => api.get(`/organization/designations?departmentId=${encodeURIComponent(departmentId)}`).then(data),
  getEmployees: (departmentId, designationId) => {
    let url = `/organization/employees?`;
    if (designationId) url += `designationId=${encodeURIComponent(designationId)}`;
    else url += `departmentId=${encodeURIComponent(departmentId)}`;
    return api.get(url).then(data);
  },
  getAssignableEmployees: (designationId, search = '') => api.get('/organization/assignable-employees', {
    params: { designationId, search }
  }).then(data),
  getPotentialHeads: () => api.get('/organization/potential-heads').then(data),

  createBranch: (payload) => api.post('/organization/branch', payload).then(data),
  createDivision: (payload) => api.post('/organization/division', payload).then(data),
  createDepartment: (payload) => api.post('/organization/department', payload).then(data),
  createDesignation: (payload) => api.post('/organization/designation', payload).then(data),
  createEmployee: (payload) => api.post('/organization/employee', payload).then(data),
  createSubCompany: (payload) => api.post('/organization/sub-company', payload).then(data),
  assignEmployeeToDesignation: (designationId, payload) => api.post(`/organization/designation/${designationId}/assign-employee`, payload).then(data),
  
  updateSubCompany: (id, payload) => api.put(`/organization/sub-company/${id}`, payload).then(data),
  updateBranch: (id, payload) => api.put(`/organization/branch/${id}`, payload).then(data),
  updateDivision: (id, payload) => api.put(`/organization/division/${id}`, payload).then(data),
  updateDepartment: (id, payload) => api.put(`/organization/department/${id}`, payload).then(data),
  updateDesignation: (id, payload) => api.put(`/organization/designation/${id}`, payload).then(data),
  updateEmployee: (id, payload) => api.put(`/organization/employee/${id}`, payload).then(data),

  deleteSubCompany: (id) => api.delete(`/organization/sub-company/${id}`).then(data),
  deleteBranch: (id) => api.delete(`/organization/branch/${id}`).then(data),
  deleteDivision: (id) => api.delete(`/organization/division/${id}`).then(data),
  deleteDepartment: (id) => api.delete(`/organization/department/${id}`).then(data),
  deleteDesignation: (id) => api.delete(`/organization/designation/${id}`).then(data),
  deleteEmployee: (id) => api.delete(`/organization/employee/${id}`).then(data),
};

export default orgService;
