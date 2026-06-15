/**
 * proxy.middleware.js
 * ─────────────────────────────────────────────────────────────────
 * Shared helpers used by every proxy route.
 *
 * Responsibilities
 *   1.  attachProxyAuth     – copies the caller's JWT (cookie or
 *                             Authorization header) into the outgoing
 *                             internal request so the upstream service
 *                             can authenticate the call.
 *   2.  sanitizeResponse    – strips internal implementation details
 *                             (stack traces, __v, raw _id, etc.) from
 *                             the upstream JSON before it reaches the
 *                             browser.
 *   3.  proxyErrorHandler   – uniform error shape for failed upstream
 *                             calls so the frontend always gets a
 *                             predictable error contract.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const { getRequestAccessToken } = require('./auth.jwt');

/* ── Sensitive top-level keys that must never reach the browser ── */
const STRIP_KEYS = new Set([
    '__v',
    'password',
    'passwordHash',
    'refreshToken',
    'resetToken',
    'resetTokenExpiry',
    'verificationToken',
    'twoFactorSecret',
    'encryptedToken',
    'rawToken',
    'internalNote',
    'internalNotes',
    'debugInfo',
    'stackTrace',
    'stack',
]);

/* ── Internal request headers the browser should never see ─────── */
const STRIP_RESPONSE_HEADERS = [
    'x-powered-by',
    'x-internal-service',
    'x-forwarded-for',
    'x-real-ip',
    'server',
];

/* ─────────────────────────────────────────────────────────────────
   1.  attachProxyAuth
   ─────────────────────────────────────────────────────────────────
   Reads the caller's access-token and injects it into `headers` so
   the outgoing axios/fetch call carries it to the upstream service.
   Called before every internal request.
   ───────────────────────────────────────────────────────────────── */
function attachProxyAuth(req, headers = {}) {
    const token = getRequestAccessToken(req);
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Pass tenant context so upstream services don't need to re-resolve it
    if (req.tenantId) {
        headers['X-Tenant-ID'] = String(req.tenantId);
    }
    if (req.user?.companyCode) {
        headers['X-Company-Code'] = String(req.user.companyCode);
    }

    // Never let the browser's origin leak to internal services
    delete headers['origin'];
    delete headers['referer'];

    return headers;
}

/* ─────────────────────────────────────────────────────────────────
   2.  sanitizeResponse
   ─────────────────────────────────────────────────────────────────
   Recursively removes keys listed in STRIP_KEYS from any plain
   object / array in the upstream payload.
   ───────────────────────────────────────────────────────────────── */
function sanitizeValue(value, depth = 0) {
    if (depth > 10) return value; // guard against circular-like deep nesting
    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item, depth + 1));
    }
    if (value !== null && typeof value === 'object') {
        const cleaned = {};
        for (const [key, val] of Object.entries(value)) {
            if (STRIP_KEYS.has(key)) continue;
            cleaned[key] = sanitizeValue(val, depth + 1);
        }
        return cleaned;
    }
    return value;
}

function sanitizeResponse(data) {
    if (data === null || data === undefined) return data;
    return sanitizeValue(data);
}

/* ─────────────────────────────────────────────────────────────────
   3.  buildProxyHeaders
   ─────────────────────────────────────────────────────────────────
   Constructs the full set of headers for an outgoing proxy request,
   inheriting safe request headers (Content-Type, Accept, etc.) and
   injecting auth + tenant context.
   ───────────────────────────────────────────────────────────────── */
const FORWARDED_REQUEST_HEADERS = [
    'content-type',
    'accept',
    'accept-language',
    'accept-encoding',
    'cache-control',
];

function buildProxyHeaders(req, extra = {}) {
    const headers = {};

    for (const name of FORWARDED_REQUEST_HEADERS) {
        const value = req.headers[name];
        if (value) headers[name] = value;
    }

    // Identify this as an internal proxy call so upstream can log/filter
    headers['X-Proxy-Source'] = 'hrms-proxy';
    headers['X-Request-ID'] =
        req.headers['x-request-id'] || `proxy-${Date.now()}`;

    return attachProxyAuth(req, { ...headers, ...extra });
}

/* ─────────────────────────────────────────────────────────────────
   4.  stripResponseHeaders
   ─────────────────────────────────────────────────────────────────
   Remove internal implementation headers from the express response
   object before data is sent to the client.
   ───────────────────────────────────────────────────────────────── */
function stripResponseHeaders(res) {
    for (const header of STRIP_RESPONSE_HEADERS) {
        res.removeHeader(header);
    }
}

/* ─────────────────────────────────────────────────────────────────
   5.  proxyErrorHandler
   ─────────────────────────────────────────────────────────────────
   Converts upstream errors (axios errors, timeout, etc.) into a
   consistent, sanitized JSON response the frontend can rely on.
   ───────────────────────────────────────────────────────────────── */
function proxyErrorHandler(err, res, context = 'proxy') {
    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

    if (err.response) {
        // Upstream returned an HTTP error – forward the status but sanitize body
        const upstreamStatus = err.response.status || 502;
        const upstreamData = sanitizeResponse(err.response.data) || {};

        return res.status(upstreamStatus).json({
            success: false,
            error: upstreamData.error || 'upstream_error',
            message: upstreamData.message || 'Upstream service returned an error.',
            ...(isProduction ? {} : { _debug: { context, status: upstreamStatus } }),
        });
    }

    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
        return res.status(503).json({
            success: false,
            error: 'service_unavailable',
            message: 'The requested service is temporarily unavailable.',
            ...(isProduction ? {} : { _debug: { context, code: err.code } }),
        });
    }

    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        return res.status(504).json({
            success: false,
            error: 'gateway_timeout',
            message: 'The upstream service did not respond in time.',
            ...(isProduction ? {} : { _debug: { context } }),
        });
    }

    // Generic fallback
    return res.status(502).json({
        success: false,
        error: 'bad_gateway',
        message: isProduction
            ? 'An unexpected gateway error occurred.'
            : err.message || 'Unknown proxy error',
        ...(isProduction ? {} : { _debug: { context } }),
    });
}

module.exports = {
    attachProxyAuth,
    buildProxyHeaders,
    sanitizeResponse,
    stripResponseHeaders,
    proxyErrorHandler,
};
