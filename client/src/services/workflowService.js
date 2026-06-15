import api from '../utils/api';

const unwrap = (response) => response.data;

export const workflowService = {
  listWorkflows: (params = {}) => api.get('/workflows', { params }).then(unwrap),
  getWorkflow: (id) => api.get(`/workflows/${id}`).then(unwrap),
  createWorkflow: (payload) => api.post('/workflows', payload).then(unwrap),
  updateWorkflow: (id, payload) => api.put(`/workflows/${id}`, payload).then(unwrap),
  publishWorkflow: (id) => api.post(`/workflows/${id}/publish`).then(unwrap),
  disableWorkflow: (id) => api.post(`/workflows/${id}/disable`).then(unwrap),
  startWorkflow: (payload) => api.post('/workflows/start', payload).then(unwrap),
  getInbox: (params = {}) => api.get('/workflows/inbox', { params }).then(unwrap),
  getInstance: (id) => api.get(`/workflows/instances/${id}`).then(unwrap),
  processAction: (id, payload) => api.post(`/workflows/instances/${id}/actions`, payload).then(unwrap),
  listDelegations: (params = {}) => api.get('/workflows/delegations', { params }).then(unwrap),
  createDelegation: (payload) => api.post('/workflows/delegations', payload).then(unwrap),
  revokeDelegation: (id) => api.post(`/workflows/delegations/${id}/revoke`).then(unwrap),
};

export default workflowService;
