import api from '../utils/api';

/**
 * Exit / Offboarding API — Full HRMS Lifecycle (Employee + HR)
 *
 * Stage flow:
 *   Requested → HR Review → Notice Period → Clearance → FNF → Letters Generated → Deactivated
 */
const exitAPI = {
    // ── Employee ────────────────────────────────────────────────────────────
    /** Check if current employee can submit an exit request (salary structure, status, profile) */
    getCanSubmit: () =>
        api.get('/exit/can-submit').then(r => r.data),
    submitRequest: (payload) =>
        api.post('/exit/request', payload).then(r => r.data),

    getMyRequests: () =>
        api.get('/exit/my-requests').then(r => r.data),

    /** Employee submits exit clearance / handover (knowledge transfer) form */
    submitClearanceForm: (id, payload) =>
        api.put(`/exit/clearance/${id}`, payload).then(r => r.data),

    /** Employee submits exit interview feedback */
    submitInterview: (id, payload) =>
        api.put(`/exit/interview/${id}`, payload).then(r => r.data),

    // ── HR ──────────────────────────────────────────────────────────────────
    getAllRequests: (params = {}) =>
        api.get('/exit/all', { params }).then(r => r.data),

    getAnalytics: () =>
        api.get('/exit/analytics').then(r => r.data),

    /** HR advances stage (stage, remarks?, lastWorkingDate?) */
    updateStage: (id, payload) =>
        api.put(`/exit/stage/${id}`, payload).then(r => r.data),

    /** HR approves — moves directly to Notice Period */
    approveRequest: (id, payload = {}) =>
        api.put(`/exit/approve/${id}`, payload).then(r => r.data),

    rejectRequest: (id, remarks) =>
        api.put(`/exit/reject/${id}`, { remarks }).then(r => r.data),

    /** HR updates asset return checklist */
    updateAssets: (id, payload) =>
        api.put(`/exit/assets/${id}`, payload).then(r => r.data),

    /** HR updates department exit task list */
    updateTasks: (id, tasks) =>
        api.put(`/exit/tasks/${id}`, { tasks }).then(r => r.data),

    /** HR gets suggested FNF breakdown (salary pending, leave encashment, deductions, notice recovery) */
    getCalculateFNF: (id) =>
        api.get(`/exit/fnf/${id}/calculate`).then(r => r.data),

    /** HR processes Full & Final Settlement */
    processFNF: (id, payload) =>
        api.put(`/exit/fnf/${id}`, payload).then(r => r.data),

    /** HR generates Experience & Relieving letters */
    generateLetters: (id) =>
        api.post(`/exit/letters/${id}`).then(r => r.data),

    /** HR deactivates employee account */
    deactivateEmployee: (id) =>
        api.put(`/exit/deactivate/${id}`).then(r => r.data),
};

export default exitAPI;
