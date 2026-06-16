import api from '../utils/api';

const data = (response) => response.data;

export const orgService = {
  getSubCompanies: () => api.get('/organization/sub-companies').then(data),
  getBranches: (subCompanyId) => {
    const url = (subCompanyId && subCompanyId !== 'undefined' && subCompanyId !== 'null')
      ? `/organization/branches?subCompanyId=${encodeURIComponent(subCompanyId)}`
      : '/organization/branches';
    return api.get(url).then(data);
  },
  getDivisions: (branchId) => {
    const url = (branchId && branchId !== 'undefined' && branchId !== 'null')
      ? `/organization/divisions?branchId=${encodeURIComponent(branchId)}`
      : '/organization/divisions';
    return api.get(url).then(data);
  },
  getDepartments: (divisionId) => {
    const url = (divisionId && divisionId !== 'undefined' && divisionId !== 'null')
      ? `/organization/departments?divisionId=${encodeURIComponent(divisionId)}`
      : '/organization/departments';
    return api.get(url).then(data);
  },
  getDesignations: (departmentId) => {
    const url = (departmentId && departmentId !== 'undefined' && departmentId !== 'null')
      ? `/organization/designations?departmentId=${encodeURIComponent(departmentId)}`
      : '/organization/designations';
    return api.get(url).then(data);
  },
  getEmployees: (departmentId, designationId) => {
    let url = `/organization/employees`;
    const parts = [];
    if (designationId && designationId !== 'undefined' && designationId !== 'null') {
      parts.push(`designationId=${encodeURIComponent(designationId)}`);
    }
    if (departmentId && departmentId !== 'undefined' && departmentId !== 'null') {
      parts.push(`departmentId=${encodeURIComponent(departmentId)}`);
    }
    if (parts.length > 0) {
      url += `?${parts.join('&')}`;
    }
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
