/**
 * proxy.employees.routes.js
 * ─────────────────────────────────────────────────────────────────
 * Proxy layer for employee-related endpoints.
 *
 * Public surface  :  /api/proxy/employees/**
 * Internal target :  INTERNAL_EMPLOYEES_URL  (default: same server
 *                    at /api/employee/**)
 *
 * Security guarantees
 *   • Every route requires a valid JWT (via `authenticate` middleware)
 *   • Auth token is automatically forwarded to the internal service
 *   • Responses are sanitised before reaching the browser
 *   • Real internal URLs are never exposed in errors or logs
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const express = require('express');
const axios = require('axios');
const { authenticate } = require('../middleware/auth.jwt');
const {
    buildProxyHeaders,
    sanitizeResponse,
    stripResponseHeaders,
    proxyErrorHandler,
} = require('../middleware/proxy.middleware');
const { getServiceUrl } = require('../config/internalServices.config');

const router = express.Router();

/* ── All employee proxy routes require authentication ─────────── */
router.use(authenticate);

/* ─────────────────────────────────────────────────────────────────
   Helper: forward() – generic request forwarder
   ─────────────────────────────────────────────────────────────────
   Constructs an axios call to the internal service, waits for the
   response, sanitises it, and writes it to `res`.
   ───────────────────────────────────────────────────────────────── */
async function forward(req, res, targetUrl) {
    try {
        const upstreamRes = await axios({
            method: req.method,
            url: targetUrl,
            headers: buildProxyHeaders(req),
            // For PATCH/POST/PUT pass the parsed body
            data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
            params: req.query,
            timeout: 25000,
            // Do NOT follow redirects automatically – propagate them
            maxRedirects: 0,
            validateStatus: () => true, // handle all statuses ourselves
        });

        stripResponseHeaders(res);

        const sanitised = sanitizeResponse(upstreamRes.data);
        return res.status(upstreamRes.status).json(sanitised);
    } catch (err) {
        return proxyErrorHandler(err, res, 'proxy:employees');
    }
}

/* ──────────────────────────────────────────────────────────────────
   Routes
   ────────────────────────────────────────────────────────────────── */

/** GET  /api/proxy/employees           – list / search employees */
router.get('/', (req, res) => {
    const base = getServiceUrl('employees');
    return forward(req, res, `${base}/`);
});

/** GET  /api/proxy/employees/:id       – employee detail */
router.get('/:id', (req, res) => {
    const base = getServiceUrl('employees');
    return forward(req, res, `${base}/${req.params.id}`);
});

/** POST /api/proxy/employees           – create employee */
router.post('/', (req, res) => {
    const base = getServiceUrl('employees');
    return forward(req, res, `${base}/`);
});

/** PUT  /api/proxy/employees/:id       – full update */
router.put('/:id', (req, res) => {
    const base = getServiceUrl('employees');
    return forward(req, res, `${base}/${req.params.id}`);
});

/** PATCH /api/proxy/employees/:id      – partial update */
router.patch('/:id', (req, res) => {
    const base = getServiceUrl('employees');
    return forward(req, res, `${base}/${req.params.id}`);
});

/** DELETE /api/proxy/employees/:id     – deactivate / delete */
router.delete('/:id', (req, res) => {
    const base = getServiceUrl('employees');
    return forward(req, res, `${base}/${req.params.id}`);
});

/**
 * Wildcard catch-all – proxies any sub-path not matched above.
 * Example: /api/proxy/employees/bulk-import  →  /api/employee/bulk-import
 */
router.all('/*', (req, res) => {
    const base = getServiceUrl('employees');
    const sub = req.params[0] || '';
    return forward(req, res, `${base}/${sub}`);
});

module.exports = router;
