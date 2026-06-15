/**
 * payrollProxyService.js
 * ─────────────────────────────────────────────────────────────────
 * Frontend service for payroll data — routes through the proxy.
 *
 * Route: /api/proxy/payroll  →  server proxy  →  internal payroll service
 *
 * The server-side proxy additionally strips bank account numbers
 * and internal calculation traces before forwarding the response.
 * ─────────────────────────────────────────────────────────────────
 */

import proxyApi from '../utils/proxyApi';

const payrollProxyService = {
    /** List payroll records for the current month / tenant */
    list: (params = {}) =>
        proxyApi.get('/payroll', { params }).then((r) => r.data),

    /** Fetch a single payroll record */
    getById: (id) =>
        proxyApi.get(`/payroll/${id}`).then((r) => r.data),

    /** Trigger a payroll run */
    runPayroll: (payload) =>
        proxyApi.post('/payroll/run', payload).then((r) => r.data),

    /** Payroll summary stats */
    getSummary: (params = {}) =>
        proxyApi.get('/payroll/summary', { params }).then((r) => r.data),

    /** List payslips */
    getPayslips: (params = {}) =>
        proxyApi.get('/payroll/slips', { params }).then((r) => r.data),

    /** Single payslip */
    getPayslip: (id) =>
        proxyApi.get(`/payroll/slips/${id}`).then((r) => r.data),

    /** Create a payroll adjustment */
    createAdjustment: (payload) =>
        proxyApi.post('/payroll/adjustments', payload).then((r) => r.data),

    /** Full update */
    update: (id, payload) =>
        proxyApi.put(`/payroll/${id}`, payload).then((r) => r.data),

    /** Partial update */
    patch: (id, payload) =>
        proxyApi.patch(`/payroll/${id}`, payload).then((r) => r.data),

    /**
     * Generic passthru for any payroll sub-path not listed above.
     * @param {string} subPath  e.g. 'corrections/bulk'
     * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
     * @param {object} [payload]
     * @param {object} [params]
     */
    custom: (subPath, method = 'GET', payload, params) =>
        proxyApi({
            method,
            url: `/payroll/${subPath}`,
            data: payload,
            params,
        }).then((r) => r.data),
};

export default payrollProxyService;
