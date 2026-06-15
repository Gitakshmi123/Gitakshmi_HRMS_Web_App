/**
 * csrf.middleware.js
 * ══════════════════════════════════════════════════════════════════
 * Stateless CSRF protection via the Double-Submit Cookie pattern.
 *
 * HOW IT WORKS
 * ────────────
 * 1. On the first request (any method to /api/auth/csrf-token),
 *    the server generates a cryptographically random token and sends
 *    it as BOTH:
 *      a. an HttpOnly=false cookie  ("csrf_token")   ← JS can read it
 *      b. a header in the response  (X-CSRF-Token)   ← fallback
 *
 * 2. For every state-mutating request (POST / PUT / PATCH / DELETE),
 *    the client must include the token in the `x-csrf-token` header.
 *    The server validates that the header value matches the cookie.
 *
 * 3. Because cross-origin (CSRF) requests cannot read `document.cookie`
 *    on a different origin, an attacker can never obtain and replay
 *    a valid cookie+header pair.
 *
 * WHY NOT csurf?
 * ─────────────────────────────────────────────────────────────────
 *  `csurf` was deprecated in 2023. This is a clean, zero-dependency
 *  equivalent that works with SPA frontends using credentials.
 *
 * EXEMPTIONS (safe to skip CSRF)
 * ────────────────────────────────────────────────────────────────
 * • GET / HEAD / OPTIONS           (safe idempotent methods)
 * • /api/public/*                  (no auth state involved)
 * • /api/auth/refresh-token        (relies on HttpOnly cookie only)
 * • Requests with a valid Bearer   (API clients, documented exception)
 * • Onboarding portal token flow   (candidate side, no session)
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

const crypto = require('crypto');

/* ─── Cookie name ────────────────────────────────────────────────── */
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_BYTE_LENGTH = 32; // 32 bytes → 64-char hex

function generateToken() {
    return crypto.randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
}

/* ─── Routes where CSRF is not enforced ─────────────────────────── */
const CSRF_EXEMPT = [
    /^\/api\/public\//,
    /^\/api\/auth\/refresh-token$/,
    /^\/api\/candidate\//,         // public job portal
    /^\/api\/onboarding(\/|$)/,    // onboarding portal (token-based protection)
    /^\/api\/health$/,
    /^\/api\/debug/,
];

function isCsrfExempt(path) {
    return CSRF_EXEMPT.some((re) => re.test(path));
}

/* ─── Cookie options ─────────────────────────────────────────────── */
function getCookieOptions() {
    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    return {
        httpOnly: false,          // MUST be readable by JS so the client can echo it
        secure: isProduction,   // HTTPS only in prod
        sameSite: 'lax',         // 'strict' breaks cross-origin navigation flows
        maxAge: 24 * 60 * 60 * 1000, // 24 hours (ms)
        path: '/',
    };
}

/* ══════════════════════════════════════════════════════════════════
   issuecsrfToken — handler for GET /api/auth/csrf-token
   ══════════════════════════════════════════════════════════════════ */
function issueCsrfToken(req, res) {
    const token = generateToken();
    res.cookie(CSRF_COOKIE_NAME, token, getCookieOptions());
    return res.json({ success: true, csrfToken: token });
}

/* ══════════════════════════════════════════════════════════════════
   csrfProtect — per-request enforcement middleware
   ══════════════════════════════════════════════════════════════════ */
function csrfProtect(req, res, next) {
    const safe = ['GET', 'HEAD', 'OPTIONS'];
    if (safe.includes(req.method)) return next();
    if (isCsrfExempt(req.path)) return next();

    // API clients using Authorization: Bearer <token> are exempt
    // (they authenticate per-request, CSRF is irrelevant)
    const authHeader = req.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) return next();

    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const headerToken = req.headers[CSRF_HEADER_NAME];

    if (!cookieToken || !headerToken) {
        return res.status(403).json({
            success: false,
            error: 'csrf_token_missing',
            message: 'CSRF token required. Fetch a token from /api/auth/csrf-token.',
        });
    }

    // Constant-time comparison to prevent timing attacks
    const cookieBuf = Buffer.from(cookieToken, 'utf8');
    const headerBuf = Buffer.from(headerToken, 'utf8');

    const lengthOk = cookieBuf.length === headerBuf.length;
    const valueOk = lengthOk && crypto.timingSafeEqual(cookieBuf, headerBuf);

    if (!valueOk) {
        return res.status(403).json({
            success: false,
            error: 'csrf_token_invalid',
            message: 'CSRF token mismatch. The request has been rejected.',
        });
    }

    // Rotate token on each mutating request (optional but recommended)
    const newToken = generateToken();
    res.cookie(CSRF_COOKIE_NAME, newToken, getCookieOptions());
    res.setHeader(CSRF_HEADER_NAME, newToken); // Expose updated token in response header

    next();
}

/* ══════════════════════════════════════════════════════════════════
   Ensure a CSRF cookie exists — attach to every response if absent
   (allows clients to lazy-fetch the token without a dedicated call)
   ══════════════════════════════════════════════════════════════════ */
function ensureCsrfCookie(req, res, next) {
    if (!req.cookies?.[CSRF_COOKIE_NAME]) {
        res.cookie(CSRF_COOKIE_NAME, generateToken(), getCookieOptions());
    }
    next();
}

module.exports = { csrfProtect, issueCsrfToken, ensureCsrfCookie, CSRF_COOKIE_NAME };
