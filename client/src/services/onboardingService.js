import api from '../utils/api';

const onboardingService = {
  getDashboard: () => api.get('/onboarding/dashboard').then((res) => res.data),
  getPipeline: () => api.get('/onboarding/pipeline').then((res) => res.data),
  movePipelineCard: (id, status) => api.patch(`/onboarding/pipeline/${id}/status`, { status }).then((res) => res.data),
  inviteCandidate: (payload) => api.post('/onboarding/invite', payload).then((res) => res.data),
  verifyOnboarding: (payload) => api.post('/onboarding/verify', payload).then((res) => res.data),
  activateOnboarding: (payload) => api.post('/onboarding/activate', payload).then((res) => res.data),
  getPublicPortal: (token) => api.get(`/onboarding?token=${token}`).then((res) => res.data),
  savePublicProgress: (token, payload) => api.post('/onboarding/progress', { token, payload }).then((res) => res.data),
  submitPublicPortal: (formData) => api.post('/onboarding/submit', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  }).then((res) => res.data),
  getTemplates: () => api.get('/onboarding/templates').then((res) => res.data),
  createTemplate: (payload) => api.post('/onboarding/templates', payload).then((res) => res.data),
  updateTemplate: (id, payload) => api.put(`/onboarding/templates/${id}`, payload).then((res) => res.data),
  publishTemplate: (id) => api.post(`/onboarding/templates/${id}/publish`).then((res) => res.data),
  duplicateTemplate: (id) => api.post(`/onboarding/templates/${id}/duplicate`).then((res) => res.data),
  getInstances: () => api.get('/onboarding/instances').then((res) => res.data),
  getInstance: (id) => api.get(`/onboarding/${id}`).then((res) => res.data),
  startOnboarding: (payload) => api.post('/onboarding/start', payload).then((res) => res.data),
  getTaskBoard: () => api.get('/onboarding/task-board').then((res) => res.data),
  updateTask: (id, payload) => api.patch(`/onboarding/tasks/${id}`, payload).then((res) => res.data),
  uploadDocument: (formData) => api.post('/onboarding/documents/upload', formData).then((res) => res.data),
  verifyDocument: (id, payload) => api.patch(`/onboarding/documents/${id}/verify`, payload).then((res) => res.data),
  getMyPortal: () => api.get('/onboarding/my-portal').then((res) => res.data),
  updateMyProfile: (payload) => api.patch('/onboarding/employee/profile', payload).then((res) => res.data),
  acceptOffer: () => api.post('/onboarding/employee/accept-offer').then((res) => res.data),
  getSuperAdminOverview: () => api.get('/superadmin/onboarding/overview').then((res) => res.data),
};

export default onboardingService;
