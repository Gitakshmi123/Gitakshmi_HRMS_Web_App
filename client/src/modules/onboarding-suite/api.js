import api from '../../utils/api';

const base = '/onboarding-suite';

export const onboardingSuiteApi = {
  listTemplates: () => api.get(`${base}/templates`).then((res) => res.data),
  createTemplate: (payload) => api.post(`${base}/templates`, payload).then((res) => res.data),

  listAssignments: (params = {}) => api.get(`${base}/assignments`, { params }).then((res) => res.data),
  createAssignment: (payload) => api.post(`${base}/assignments`, payload).then((res) => res.data),
  getAssignment: (assignmentId) => api.get(`${base}/assignments/${assignmentId}`).then((res) => res.data),

  startStep: (assignmentId, stepKey) =>
    api.post(`${base}/assignments/${assignmentId}/steps/${stepKey}/start`).then((res) => res.data),
  completeStep: (assignmentId, stepKey, payload) =>
    api.post(`${base}/assignments/${assignmentId}/steps/${stepKey}/complete`, { payload }).then((res) => res.data),
  retryStep: (assignmentId, stepKey) =>
    api.post(`${base}/assignments/${assignmentId}/steps/${stepKey}/retry`).then((res) => res.data),

  approve: (approvalId, payload = {}) => api.post(`${base}/approvals/${approvalId}/approve`, payload).then((res) => res.data),
  reject: (approvalId, payload = {}) => api.post(`${base}/approvals/${approvalId}/reject`, payload).then((res) => res.data),

  uploadDocument: (formData) =>
    api.post(`${base}/documents/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((res) => res.data),
  reviewDocument: (documentId, payload) => api.patch(`${base}/documents/${documentId}/review`, payload).then((res) => res.data),

  registerFace: (payload) => api.post(`${base}/face/register`, payload).then((res) => res.data),
  approveFace: (faceProfileId, payload) => api.post(`${base}/face/${faceProfileId}/approve`, payload).then((res) => res.data),
  verifyFace: (payload) => api.post(`${base}/face/verify`, payload).then((res) => res.data),
  punch: (type, payload) => api.post(`${base}/attendance/${type}`, payload).then((res) => res.data),
};

export default onboardingSuiteApi;
