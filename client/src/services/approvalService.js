import api from '../utils/api';

export const approvalService = {
  getPendingApprovals: async () => {
    const response = await api.get('/approvals/my-approvals');
    return response.data;
  },

  getApprovalHistory: async () => {
    const response = await api.get('/approvals/history');
    return response.data;
  },

  getApprovalDetails: async (id) => {
    const response = await api.get(`/approvals/${id}`);
    return response.data;
  },

  processAction: async (id, action, comments) => {
    const response = await api.post(`/approvals/${id}/action`, { action, comments });
    return response.data;
  },

  getWorkflows: async () => {
    const response = await api.get('/approvals/workflows');
    return response.data;
  },

  createWorkflow: async (data) => {
    const response = await api.post('/approvals/workflows', data);
    return response.data;
  },

  updateWorkflow: async (id, data) => {
    const response = await api.put(`/approvals/workflows/${id}`, data);
    return response.data;
  },

  deleteWorkflow: async (id) => {
    const response = await api.delete(`/approvals/workflows/${id}`);
    return response.data;
  }
};
