/**
 * proxy.payroll.routes.js
 * ─────────────────────────────────────────────────────────────────
 * Proxy layer for payroll-related endpoints.
 *
 * Public surface  :  /api/proxy/payroll/**
 * Internal target :  INTERNAL_PAYROLL_URL  (default: same server
 *                    at /api/payroll/**)
 *
 * All routes require authentication.
 * Financial data fields (raw salary breakdowns, banking details) are
 * sanitised before the response reaches the browser.
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

/* ── All payroll proxy routes require authentication ──────────── */
router.use(authenticate);

/* ─────────────────────────────────────────────────────────────────
   Payroll-specific response sanitiser
   ─────────────────────────────────────────────────────────────────
   Extends the base sanitiser by removing additional payroll-private
   fields (bank account numbers, raw tax values intended only for
   the payroll engine, etc.) before the response is streamed.
   ───────────────────────────────────────────────────────────────── */
const PAYROLL_STRIP_KEYS = new Set([
    'bankAccountNumber',
    'bankIfscRaw',
    'bankRoutingNumber',
    'rawTaxTable',
    'internalCalcTrace',
    'engineDebug',
    'pfAccountRaw',
]);

function sanitizePayrollResponse(data) {
    if (data === null || data === undefined) return data;
    const base = sanitizeResponse(data);

    function stripPayroll(value, depth = 0) {
        if (depth > 10) return value;
        if (Array.isArray(value)) return value.map((v) => stripPayroll(v, depth + 1));
        if (value !== null && typeof value === 'object') {
            const cleaned = {};
            for (const [key, val] of Object.entries(value)) {
                if (PAYROLL_STRIP_KEYS.has(key)) continue;
                cleaned[key] = stripPayroll(val, depth + 1);
            }
            return cleaned;
        }
        return value;
    }

    return stripPayroll(base);
}

/* ─────────────────────────────────────────────────────────────────
   Helper: forward()
   ─────────────────────────────────────────────────────────────────
   Generic axios forwarder with payroll-specific sanitisation.
   ───────────────────────────────────────────────────────────────── */
async function forward(req, res, targetUrl) {
    try {
        const upstreamRes = await axios({
            method: req.method,
            url: targetUrl,
            headers: buildProxyHeaders(req),
            data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
            params: req.query,
            timeout: 30000,
            maxRedirects: 0,
            validateStatus: () => true,
        });

        stripResponseHeaders(res);
        const sanitised = sanitizePayrollResponse(upstreamRes.data);
        return res.status(upstreamRes.status).json(sanitised);
    } catch (err) {
        return proxyErrorHandler(err, res, 'proxy:payroll');
    }
}

/* ──────────────────────────────────────────────────────────────────
   Routes
   ────────────────────────────────────────────────────────────────── */

/** GET  /api/proxy/payroll              – list payroll records */
router.get('/', (req, res) => {
    const base = getServiceUrl('payroll');
    return forward(req, res, `${base}/`);
});

/** POST /api/proxy/payroll/run          – trigger payroll run */
router.post('/run', (req, res) => {
    const base = getServiceUrl('payroll');
    return forward(req, res, `${base}/run`);
});

/** GET  /api/proxy/payroll/summary      – payroll summary */
router.get('/summary', (req, res) => {
    const base = getServiceUrl('payroll');
    return forward(req, res, `${base}/summary`);
});

/** GET  /api/proxy/payroll/slips        – payslip list */
router.get('/slips', (req, res) => {
    const base = getServiceUrl('payroll');
    return forward(req, res, `${base}/slips`);
});

/** GET  /api/proxy/payroll/slips/:id    – individual payslip */
router.get('/slips/:id', (req, res) => {
    const base = getServiceUrl('payroll');
    return forward(req, res, `${base}/slips/${req.params.id}`);
});

/** POST /api/proxy/payroll/adjustments  – create adjustment */
router.post('/adjustments', (req, res) => {
    const base = getServiceUrl('payroll');
    return forward(req, res, `${base}/adjustments`);
});

/** GET  /api/proxy/payroll/:id          – single payroll record */
router.get('/:id', (req, res) => {
    const base = getServiceUrl('payroll');
    return forward(req, res, `${base}/${req.params.id}`);
});

/** PUT  /api/proxy/payroll/:id          – update payroll record */
router.put('/:id', (req, res) => {
    const base = getServiceUrl('payroll');
    return forward(req, res, `${base}/${req.params.id}`);
});

/** PATCH /api/proxy/payroll/:id         – partial update */
router.patch('/:id', (req, res) => {
    const base = getServiceUrl('payroll');
    return forward(req, res, `${base}/${req.params.id}`);
});

/** Wildcard catch-all */
router.all('/*', (req, res) => {
    const base = getServiceUrl('payroll');
    const sub = req.params[0] || '';
    return forward(req, res, `${base}/${sub}`);
});

module.exports = router;
