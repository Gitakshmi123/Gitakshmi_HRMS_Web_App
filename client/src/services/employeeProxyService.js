/**
 * employeeProxyService.js
 * ─────────────────────────────────────────────────────────────────
 * Frontend service for employee data.
 *
 * Route: /api/proxy/employees  →  server proxy  →  internal employee service
 *
 * Import this instead of calling raw axios or api.js with '/employee/*'.
 * ─────────────────────────────────────────────────────────────────
 */

import proxyApi from '../utils/proxyApi';

const employeeProxyService = {
    /** List / search employees.  Pass query params via `params` object. */
    list: (params = {}) =>
        proxyApi.get('/employees', { params }).then((r) => r.data),

    /** Fetch a single employee by ID */
    getById: (id) =>
        proxyApi.get(`/employees/${id}`).then((r) => r.data),

    /** Create a new employee record */
    create: (payload) =>
        proxyApi.post('/employees', payload).then((r) => r.data),

    /** Full update of an employee record */
    update: (id, payload) =>
        proxyApi.put(`/employees/${id}`, payload).then((r) => r.data),

    /** Partial update of an employee record */
    patch: (id, payload) =>
        proxyApi.patch(`/employees/${id}`, payload).then((r) => r.data),

    /** Deactivate / delete an employee */
    remove: (id) =>
        proxyApi.delete(`/employees/${id}`).then((r) => r.data),

    /**
     * Generic passthru for any employee sub-path not listed above.
     * @param {string} subPath  – e.g. 'bulk-import', 'export/csv'
     * @param {'GET'|'POST'|'PUT'|'PATCH'|'DELETE'} method
     * @param {object} [payload]
     * @param {object} [params]
     */
    custom: (subPath, method = 'GET', payload, params) =>
        proxyApi({
            method,
            url: `/employees/${subPath}`,
            data: payload,
            params,
        }).then((r) => r.data),
};

export default employeeProxyService;
