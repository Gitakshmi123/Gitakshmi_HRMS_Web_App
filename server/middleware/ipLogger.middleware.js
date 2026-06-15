/**
 * ipLogger.middleware.js
 * ══════════════════════════════════════════════════════════════════
 * Structured IP / request logger + suspicious pattern detector.
 *
 * Features
 * ────────
 * • Logs every /api request to logs/access.log (JSON, one line each)
 * • Tracks per-IP request counts in a sliding 1-minute window
 * • Sends 429 and blocks IPs that exceed the burst threshold
 * • Emits "SUSPICIOUS" warnings for known attack patterns in URLs
 * • Log files rotate automatically at midnight (daily)
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');

/* ─── Config ────────────────────────────────────────────────────── */
const LOGS_DIR = path.resolve(process.cwd(), 'logs');
const BURST_WINDOW_MS = 60_000;           // 1 minute sliding window
const BURST_MAX = parseInt(process.env.IP_BURST_MAX || '200', 10);
const BLOCK_DURATION = parseInt(process.env.IP_BLOCK_MS || '300000', 10); // 5 min

/* ─── Suspicious URL patterns ───────────────────────────────────── */
const SUSPICIOUS_PATTERNS = [
    /\.\.\//,                       // path traversal
    /<script/i,                     // XSS probe in URL
    /union.*select/i,               // SQL injection probe
    /\$where/i,                     // MongoDB operator injection via URL
    /\/etc\/passwd/i,               // unix file read probe
    /\beval\b/i,                    // code execution probe
    /base64_decode/i,               // PHP exploit probe
    /cmd\.exe/i,                    // windows shell probe
    /\/\.git\//,                    // git exposure probe
    /\/admin\/config/i,             // admin config probe
    /wp-admin|wp-login/i,           // WordPress scanner
];

/* ─── In-memory IP state ─────────────────────────────────────────
   Map<ip, { windowStart: number, count: number, blockedUntil: number }>
   ──────────────────────────────────────────────────────────────── */
const ipState = new Map();

/* ─── Log file helpers ──────────────────────────────────────────── */
function ensureLogsDir() {
    if (!fs.existsSync(LOGS_DIR)) {
        fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
}

function getLogFilePath() {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return path.join(LOGS_DIR, `access_${stamp}.log`);
}

function appendLog(entry) {
    try {
        ensureLogsDir();
        fs.appendFileSync(getLogFilePath(), JSON.stringify(entry) + '\n', 'utf8');
    } catch (_) {
        // never crash the request pipeline because of a log failure
    }
}

/* ─── IP helpers ────────────────────────────────────────────────── */
function resolveIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return String(forwarded).split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
}

function trackIp(ip) {
    const now = Date.now();
    let state = ipState.get(ip);

    if (!state) {
        state = { windowStart: now, count: 0, blockedUntil: 0 };
        ipState.set(ip, state);
    }

    // Reset window if expired
    if (now - state.windowStart > BURST_WINDOW_MS) {
        state.windowStart = now;
        state.count = 0;
    }

    state.count += 1;

    // Auto-block if threshold exceeded
    if (state.count > BURST_MAX && state.blockedUntil === 0) {
        state.blockedUntil = now + BLOCK_DURATION;
    }

    return state;
}

function isBlocked(state) {
    if (state.blockedUntil === 0) return false;
    if (Date.now() > state.blockedUntil) {
        state.blockedUntil = 0;
        state.count = 0;
        return false;
    }
    return true;
}

function isSuspicious(url) {
    return SUSPICIOUS_PATTERNS.some((re) => re.test(url));
}

/* ─── Periodic clean-up (every 10 min, remove stale entries) ─────  */
setInterval(() => {
    const cutoff = Date.now() - BURST_WINDOW_MS * 5;
    for (const [ip, state] of ipState.entries()) {
        if (state.windowStart < cutoff && state.blockedUntil === 0) {
            ipState.delete(ip);
        }
    }
}, 10 * 60 * 1000).unref();

/* ══════════════════════════════════════════════════════════════════
   Middleware export
   ══════════════════════════════════════════════════════════════════ */
function ipLogger(req, res, next) {
    const ip = resolveIp(req);
    const startTime = Date.now();
    const state = trackIp(ip);
    const suspicious = isSuspicious(req.url || '');

    // Block IPs that exceeded the burst limit
    if (isBlocked(state)) {
        const entry = {
            ts: new Date().toISOString(),
            event: 'BLOCKED',
            ip,
            method: req.method,
            url: req.url,
            ua: req.get('user-agent') || '',
        };
        appendLog(entry);
        return res.status(429).json({
            success: false,
            error: 'ip_blocked',
            message: 'Your IP has been temporarily blocked due to excessive requests.',
        });
    }

    // Log suspicious requests immediately
    if (suspicious) {
        const entry = {
            ts: new Date().toISOString(),
            event: 'SUSPICIOUS',
            ip,
            method: req.method,
            url: req.url,
            ua: req.get('user-agent') || '',
            tenantId: req.tenantId || null,
            userId: req.user?.id || null,
        };
        appendLog(entry);
        // Respond immediately — do not pass to controller
        return res.status(400).json({
            success: false,
            error: 'invalid_request',
            message: 'Request contains invalid characters or patterns.',
        });
    }

    // Attach ip to req for downstream use (audit logger)
    req.clientIp = ip;

    // Log after response finishes (captures status code)
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const entry = {
            ts: new Date().toISOString(),
            event: 'REQUEST',
            ip,
            method: req.method,
            url: req.url,
            status: res.statusCode,
            ms: duration,
            ua: req.get('user-agent') || '',
            tenantId: req.tenantId || null,
            userId: req.user?.id || null,
        };
        appendLog(entry);
    });

    next();
}

module.exports = ipLogger;
module.exports.resolveIp = resolveIp;
