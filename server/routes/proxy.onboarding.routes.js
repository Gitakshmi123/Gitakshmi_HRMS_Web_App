/**
 * proxy.onboarding.routes.js
 * ─────────────────────────────────────────────────────────────────
 * Proxy layer for onboarding endpoints.
 *
 * Public surface  :  /api/proxy/onboarding/**
 * Internal target :  INTERNAL_ONBOARDING_URL  (default: same server
 *                    at /api/onboarding/**)
 *
 * Special cases
 *   • /api/proxy/onboarding/:token  – public portal (no auth guard)
 *   • /api/proxy/onboarding/submit  – multipart/form-data passthru
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

/* ─────────────────────────────────────────────────────────────────
   Helper: forward()
   ─────────────────────────────────────────────────────────────────
   Generic axios-based forwarder shared by all handlers in this file.
   ───────────────────────────────────────────────────────────────── */
async function forward(req, res, targetUrl, extraAxiosOptions = {}) {
    try {
        const upstreamRes = await axios({
            method: req.method,
            url: targetUrl,
            headers: buildProxyHeaders(req),
            data: ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : undefined,
            params: req.query,
            timeout: 60000, // onboarding file-uploads can be slow
            maxRedirects: 0,
            validateStatus: () => true,
            ...extraAxiosOptions,
        });

        stripResponseHeaders(res);
        const sanitised = sanitizeResponse(upstreamRes.data);
        return res.status(upstreamRes.status).json(sanitised);
    } catch (err) {
        return proxyErrorHandler(err, res, 'proxy:onboarding');
    }
}

/* ──────────────────────────────────────────────────────────────────
   Public routes (no auth required)
   ────────────────────────────────────────────────────────────────── */

/** GET  /api/proxy/onboarding/portal/:token  – candidate public portal */
router.get('/portal/:token', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/${req.params.token}`);
});

/** POST /api/proxy/onboarding/progress        – save candidate progress */
router.post('/progress', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/progress`);
});

/** POST /api/proxy/onboarding/submit          – final form submission */
router.post('/submit', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/submit`);
});

/* ──────────────────────────────────────────────────────────────────
   Authenticated routes
   ────────────────────────────────────────────────────────────────── */

/* Apply auth for all routes below this line */
router.use(authenticate);

/** GET  /api/proxy/onboarding/dashboard   – HR dashboard stats */
router.get('/dashboard', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/dashboard`);
});

/** GET  /api/proxy/onboarding/pipeline    – kanban pipeline */
router.get('/pipeline', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/pipeline`);
});

/** PATCH /api/proxy/onboarding/pipeline/:id/status  – move card */
router.patch('/pipeline/:id/status', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/pipeline/${req.params.id}/status`);
});

/** POST /api/proxy/onboarding/invite      – invite candidate */
router.post('/invite', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/invite`);
});

/** POST /api/proxy/onboarding/verify      – verify token */
router.post('/verify', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/verify`);
});

/** POST /api/proxy/onboarding/activate    – activate account */
router.post('/activate', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/activate`);
});

/** POST /api/proxy/onboarding/start       – start onboarding flow */
router.post('/start', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/start`);
});

/** GET  /api/proxy/onboarding/templates   – list templates */
router.get('/templates', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/templates`);
});

/** POST /api/proxy/onboarding/templates   – create template */
router.post('/templates', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/templates`);
});

/** PUT  /api/proxy/onboarding/templates/:id */
router.put('/templates/:id', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/templates/${req.params.id}`);
});

/** GET  /api/proxy/onboarding/instances   – list instances */
router.get('/instances', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/instances`);
});

/** GET  /api/proxy/onboarding/task-board  – task board */
router.get('/task-board', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/task-board`);
});

/** PATCH /api/proxy/onboarding/tasks/:id  – update task */
router.patch('/tasks/:id', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/tasks/${req.params.id}`);
});

/** POST /api/proxy/onboarding/documents/upload  – document upload */
router.post('/documents/upload', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/documents/upload`);
});

/** PATCH /api/proxy/onboarding/documents/:id/verify  – verify doc */
router.patch('/documents/:id/verify', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/documents/${req.params.id}/verify`);
});

/** GET  /api/proxy/onboarding/my-portal  – employee portal */
router.get('/my-portal', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/my-portal`);
});

/** PATCH /api/proxy/onboarding/employee/profile  – update profile */
router.patch('/employee/profile', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/employee/profile`);
});

/** POST /api/proxy/onboarding/employee/accept-offer */
router.post('/employee/accept-offer', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/employee/accept-offer`);
});

/** GET  /api/proxy/onboarding/:id        – instance by id */
router.get('/:id', (req, res) => {
    const base = getServiceUrl('onboarding');
    return forward(req, res, `${base}/${req.params.id}`);
});

/** Wildcard catch-all for any sub-paths not matched above */
router.all('/*', (req, res) => {
    const base = getServiceUrl('onboarding');
    const sub = req.params[0] || '';
    return forward(req, res, `${base}/${sub}`);
});

module.exports = router;
