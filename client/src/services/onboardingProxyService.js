/**
 * onboardingProxyService.js
 * ─────────────────────────────────────────────────────────────────
 * Frontend service for onboarding data — routes through the proxy.
 *
 * Route: /api/proxy/onboarding  →  server proxy  →  internal service
 *
 * Drop-in replacement for the existing onboardingService.js that was
 * calling /api/onboarding directly. API shape is identical.
 * ─────────────────────────────────────────────────────────────────
 */

import proxyApi from '../utils/proxyApi';

const onboardingProxyService = {
    /* ── HR-facing endpoints (require authentication) ──────────── */

    getDashboard: () =>
        proxyApi.get('/onboarding/dashboard').then((r) => r.data),

    getPipeline: () =>
        proxyApi.get('/onboarding/pipeline').then((r) => r.data),

    movePipelineCard: (id, status) =>
        proxyApi.patch(`/onboarding/pipeline/${id}/status`, { status }).then((r) => r.data),

    inviteCandidate: (payload) =>
        proxyApi.post('/onboarding/invite', payload).then((r) => r.data),

    verifyOnboarding: (payload) =>
        proxyApi.post('/onboarding/verify', payload).then((r) => r.data),

    activateOnboarding: (payload) =>
        proxyApi.post('/onboarding/activate', payload).then((r) => r.data),

    getTemplates: () =>
        proxyApi.get('/onboarding/templates').then((r) => r.data),

    createTemplate: (payload) =>
        proxyApi.post('/onboarding/templates', payload).then((r) => r.data),

    updateTemplate: (id, payload) =>
        proxyApi.put(`/onboarding/templates/${id}`, payload).then((r) => r.data),

    getInstances: () =>
        proxyApi.get('/onboarding/instances').then((r) => r.data),

    getInstance: (id) =>
        proxyApi.get(`/onboarding/${id}`).then((r) => r.data),

    startOnboarding: (payload) =>
        proxyApi.post('/onboarding/start', payload).then((r) => r.data),

    getTaskBoard: () =>
        proxyApi.get('/onboarding/task-board').then((r) => r.data),

    updateTask: (id, payload) =>
        proxyApi.patch(`/onboarding/tasks/${id}`, payload).then((r) => r.data),

    uploadDocument: (formData) =>
        proxyApi
            .post('/onboarding/documents/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            .then((r) => r.data),

    verifyDocument: (id, payload) =>
        proxyApi
            .patch(`/onboarding/documents/${id}/verify`, payload)
            .then((r) => r.data),

    getMyPortal: () =>
        proxyApi.get('/onboarding/my-portal').then((r) => r.data),

    updateMyProfile: (payload) =>
        proxyApi.patch('/onboarding/employee/profile', payload).then((r) => r.data),

    acceptOffer: () =>
        proxyApi.post('/onboarding/employee/accept-offer').then((r) => r.data),

    /* ── Public candidate portal (no auth cookie needed) ────────── */

    getPublicPortal: (token) =>
        proxyApi.get(`/onboarding/portal/${token}`).then((r) => r.data),

    savePublicProgress: (token, payload) =>
        proxyApi.post('/onboarding/progress', { token, payload }).then((r) => r.data),

    submitPublicPortal: (formData) =>
        proxyApi
            .post('/onboarding/submit', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 60000,
            })
            .then((r) => r.data),

    /* ── Super-admin overview ────────────────────────────────────── */
    getSuperAdminOverview: () =>
        // Super-admin route is not onboarding-scoped; keep using main api
        import('../utils/api').then(({ default: api }) =>
            api.get('/superadmin/onboarding/overview').then((r) => r.data)
        ),
};

export default onboardingProxyService;
