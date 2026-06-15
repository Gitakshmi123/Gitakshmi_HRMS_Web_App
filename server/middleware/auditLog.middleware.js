/**
 * auditLog.middleware.js
 * ══════════════════════════════════════════════════════════════════
 * Automatic audit trail for all mutating API actions.
 *
 * Records:
 *   • Who   — user id, role, email
 *   • What  — HTTP method + route
 *   • From  — IP address + user-agent
 *   • When  — ISO timestamp
 *   • Body  — sanitised request body (sensitive keys stripped)
 *   • Result — HTTP status code
 *
 * Writes to: MongoDB `SecurityAuditLog` collection in the main DB.
 *
 * Only logs POST / PUT / PATCH / DELETE (read-only GETs are tracked
 * by the IP logger, not the audit log, to avoid write-heavy overhead).
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

const mongoose = require('mongoose');
const { resolveIp } = require('./ipLogger.middleware');

/* ─── Sensitive keys never written to audit log ─────────────────── */
const STRIP_FROM_BODY = new Set([
    'password', 'passwordHash', 'refreshToken', 'token', 'accessToken',
    'newPassword', 'oldPassword', 'confirmPassword',
    'twoFactorSecret', 'totpSecret', 'backupCodes',
    'accountNumber', 'bankAccountNumber', 'bankRoutingNumber',
    'cvv', 'cardNumber', 'otp',
]);

/* ─── Max body size to persist (prevent huge payloads in audit) ──── */
const MAX_BODY_BYTES = 4096; // 4 KB

/* ─── Model definition ──────────────────────────────────────────── */
const SecurityAuditLogSchema = new mongoose.Schema(
    {
        /* Actor */
        userId: { type: String, index: true },
        userRole: { type: String },
        userEmail: { type: String },

        /* Request */
        method: { type: String, required: true },
        route: { type: String, required: true, index: true },
        statusCode: { type: Number },
        ip: { type: String, index: true },
        userAgent: { type: String },

        /* Tenant context */
        tenantId: { type: String, index: true },

        /* Payload (sanitised) */
        requestBody: { type: mongoose.Schema.Types.Mixed },

        /* Outcome */
        durationMs: { type: Number },
        flagged: { type: Boolean, default: false },
        flagReason: { type: String },
    },
    {
        timestamps: true,
        collection: 'security_audit_logs',
    }
);

SecurityAuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }); // TTL: 90 days

let SecurityAuditLog;
function getAuditModel() {
    if (SecurityAuditLog) return SecurityAuditLog;
    try {
        SecurityAuditLog = mongoose.model('SecurityAuditLog');
    } catch (_) {
        SecurityAuditLog = mongoose.model('SecurityAuditLog', SecurityAuditLogSchema);
    }
    return SecurityAuditLog;
}

/* ─── Body sanitiser ─────────────────────────────────────────────── */
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return undefined;

    const cleaned = {};
    for (const [key, value] of Object.entries(body)) {
        if (STRIP_FROM_BODY.has(key)) {
            cleaned[key] = '[REDACTED]';
        } else if (typeof value === 'string' && value.length > 500) {
            cleaned[key] = `[TRUNCATED:${value.length}chars]`;
        } else if (typeof value === 'object' && value !== null) {
            cleaned[key] = sanitizeBody(value);
        } else {
            cleaned[key] = value;
        }
    }

    // Enforce max size
    try {
        const serialized = JSON.stringify(cleaned);
        if (Buffer.byteLength(serialized) > MAX_BODY_BYTES) {
            return { __truncated: true, __reason: `body_exceeds_${MAX_BODY_BYTES}bytes` };
        }
    } catch (_) {
        return { __error: 'body_serialisation_failed' };
    }

    return cleaned;
}

/* ─── Routes that should NOT be logged (high-frequency / noisy) ─── */
const SKIP_ROUTES = /\/(health|ping|metrics|favicon|debug-comp)\b/i;

/* ══════════════════════════════════════════════════════════════════
   Middleware export
   ══════════════════════════════════════════════════════════════════ */
function auditLogger(req, res, next) {
    // Only audit mutating requests
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        return next();
    }

    // Skip noisy / internal endpoints
    if (SKIP_ROUTES.test(req.path)) {
        return next();
    }

    const startTime = Date.now();

    res.on('finish', () => {
        // Fire-and-forget — never block the response
        setImmediate(async () => {
            try {
                const Model = getAuditModel();
                const doc = {
                    userId: req.user?.id || req.user?._id || null,
                    userRole: req.user?.role || null,
                    userEmail: req.user?.email || null,
                    method: req.method,
                    route: req.originalUrl || req.url,
                    statusCode: res.statusCode,
                    ip: req.clientIp || resolveIp(req),
                    userAgent: req.get('user-agent') || null,
                    tenantId: req.tenantId || req.user?.tenantId || null,
                    requestBody: sanitizeBody(req.body),
                    durationMs: Date.now() - startTime,
                    flagged: false,
                };

                // Flag potentially suspicious outcomes
                if (res.statusCode === 401 || res.statusCode === 403) {
                    doc.flagged = true;
                    doc.flagReason = 'auth_failure';
                } else if (res.statusCode >= 500) {
                    doc.flagged = true;
                    doc.flagReason = 'server_error';
                }

                await Model.create(doc);
            } catch (_) {
                // Silently ignore — never crash the app because of audit logging
            }
        });
    });

    next();
}

/**
 * Convenience: look up recent audit logs for a specific user or IP.
 * Can be called from an admin controller.
 */
async function queryAuditLogs({ userId, ip, tenantId, limit = 50, onlyFlagged = false } = {}) {
    const Model = getAuditModel();
    const filter = {};
    if (userId) filter.userId = userId;
    if (ip) filter.ip = ip;
    if (tenantId) filter.tenantId = tenantId;
    if (onlyFlagged) filter.flagged = true;

    return Model
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
}

module.exports = auditLogger;
module.exports.queryAuditLogs = queryAuditLogs;
module.exports.getAuditModel = getAuditModel;
module.exports.SecurityAuditLogSchema = SecurityAuditLogSchema;
