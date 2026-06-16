/**
 * apiSanitizer.js
 * ═══════════════════════════════════════════════════════════════════
 * Production-grade API response sanitisation and standardisation.
 *
 * Responsibilities
 * ───────────────
 * 1.  sanitizeData()          – Recursively strips ALL sensitive fields
 *                               from any value (object / array / scalar).
 * 2.  sanitizeEmployee()      – Employee-specific field allowlist.
 * 3.  sanitizeOnboarding()    – Onboarding instance with token strip.
 * 4.  sanitizeAuthResponse()  – Auth payloads (login / getMe).
 * 5.  sanitizePayroll()       – Payroll records with banking strip.
 * 6.  sendSuccess()           – Uniform { success, data, message } shape.
 * 7.  sendError()             – Uniform { success, error, message } shape.
 * 8.  apiResponseGuard (MW)   – Express middleware that patches res.json()
 *                               at the start of every /api request so ALL
 *                               controllers benefit automatically.
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

/* ─── Master sensitive-key registry ──────────────────────────────── */
const ALWAYS_STRIP = new Set([
    /* Auth / tokens */
    'password',
    'passwordHash',
    'passwordResetToken',
    'passwordResetExpiry',
    'refreshToken',
    'refreshTokenHash',
    'tokenHash',
    'accessToken',
    'verificationToken',
    'activationToken',
    'resetToken',
    'resetTokenExpiry',
    'onboardingTokenHash',         // onboarding invite hash
    'jti',
    'twoFactorSecret',
    'totpSecret',
    'backupCodes',
    'encryptedToken',
    'rawToken',

    /* Internal / debug leakage */
    '__v',
    'stack',
    'stackTrace',
    'debugInfo',
    '_debug',
    'internalNote',
    'internalNotes',
    'internalCalcTrace',
    'engineDebug',
    'debug_stack',                 // hr.employee.controller leak
    'onboardingTempPassword',      // written into employee.meta

    /* Banking / financial PII */
    'bankAccountNumber',
    
    'bankIfscRaw',
    'bankRoutingNumber',
    'rawTaxTable',
    'pfAccountRaw',

    /* System keys never useful to client */
    'tenantSecret',
    'encryptionKey',
    'apiSecret',
    'webhookSecret',
]);

/* ─── Keys zeroed-out IN THE META SUB-OBJECT specifically ──────── */
const META_STRIP = new Set([
    'onboardingTempPassword',
    'internalNote',
    'internalNotes',
]);

/* ─── Max recursion depth (guard against very deep objects) ─────── */
const MAX_DEPTH = 12;

/* ═══════════════════════════════════════════════════════════════════
   1.  sanitizeData  –  Generic recursive strip
   ═══════════════════════════════════════════════════════════════════ */
function sanitizeData(value, depth = 0) {
    if (depth > MAX_DEPTH) return value;
    if (value === null || value === undefined) return value;

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeData(item, depth + 1));
    }

    // Passthrough complex types that should NOT be recursively sanitized as generic objects
    if (
        value instanceof Date ||
        value instanceof RegExp ||
        (value.constructor && value.constructor.name === 'ObjectId') ||
        (value.constructor && value.constructor.name === 'ObjectID') ||
        value._bsontype === 'ObjectID' ||
        Buffer.isBuffer(value)
    ) {
        return value;
    }

    if (typeof value === 'object') {
        const cleaned = {};
        for (const [key, val] of Object.entries(value)) {
            if (ALWAYS_STRIP.has(key)) continue;

            // Special-case: sanitize meta sub-object but keep the rest
            if (key === 'meta' && val && typeof val === 'object') {
                const cleanMeta = {};
                for (const [mKey, mVal] of Object.entries(val)) {
                    if (META_STRIP.has(mKey)) continue;
                    cleanMeta[mKey] = sanitizeData(mVal, depth + 2);
                }
                cleaned[key] = cleanMeta;
                continue;
            }

            cleaned[key] = sanitizeData(val, depth + 1);
        }
        return cleaned;
    }

    return value;
}

/* ═══════════════════════════════════════════════════════════════════
   2.  sanitizeEmployee  –  Allowlist projection
       Only the fields the frontend legitimately needs are forwarded.
       This prevents over-fetching even if the DB returns extra columns.
   ═══════════════════════════════════════════════════════════════════ */
const EMPLOYEE_PUBLIC_FIELDS = new Set([
    '_id', 'id',
    'employeeId', 'employeeCode',
    'firstName', 'lastName', 'middleName', 'name', 'fullName',
    'email', 'contactNo',
    'gender', 'dob', 'maritalStatus', 'bloodGroup', 'nationality',
    'fatherName', 'motherName',
    'emergencyContactName', 'emergencyContactNumber',
    'department', 'departmentId',
    'designation', 'designationId', 'role', 'jobType', 'employeeType', 'workMode',
    'grade', 'gradeId', 'band', 'bandId',
    'salary', 'payrollTemplateId', 'salaryTemplateId',
    'joiningDate', 'exitDate',
    'profilePic',
    'status', 'isActive',
    'manager',
    'shiftId',
    'leavePolicy', 'leaveBalance', 'leaveBalanceYear',
    'tempAddress', 'permAddress',
    /* Bank — only non-sensitive summary fields */
    'bankName', 'bankBranch', 'ifscCode',
    /* Education summary */
    'education',
    /* Salary flags (NOT raw amounts) */
    'salaryAssigned', 'salaryLocked',
    /* System */
    'createdAt', 'updatedAt',
    'bankDetails',
    'documents',
    'experience',
    'lastStep',
    /* Missing details from excel bulk upload */
    'personalEmail', 'highestQualification', 'marriageDate',
    'spouseDetails', 'children', 'brothers', 'sisters',
]);

const { stringifyId } = require('./idUtils');

/**
 * Sanitize an employee object to public fields only.
 * Accepts both plain objects and Mongoose documents.
 *
 * @param {object} employee
 * @returns {object}
 */
function sanitizeEmployee(employee) {
    if (!employee) return null;
    const raw = typeof employee.toObject === 'function' ? employee.toObject() : { ...employee };
    // Strip sensitive keys first
    const stripped = sanitizeData(raw);
    // Then apply allowlist
    const result = {};
    for (const key of Object.keys(stripped)) {
        if (EMPLOYEE_PUBLIC_FIELDS.has(key)) {
            // Force ID fields to strings to prevent Buffer object leakage
            if ((key === '_id' || key === 'id') && stripped[key]) {
                result[key] = stringifyId(stripped[key]);
            } else {
                result[key] = stripped[key];
            }
        }
    }
    return result;
}

/* ═══════════════════════════════════════════════════════════════════
   3.  sanitizeOnboarding  –  Strip tokens + internal calc fields
   ═══════════════════════════════════════════════════════════════════ */
const ONBOARDING_STRIP_EXTRA = new Set([
    'onboardingTokenHash',
    'onboardingTokenExpiresAt',    // not needed by client, computed server-side
    'inviteEmailSentAt',           // internal telemetry
]);

function sanitizeOnboarding(instance) {
    if (!instance) return null;
    const raw = typeof instance.toObject === 'function' ? instance.toObject() : { ...instance };
    const stripped = sanitizeData(raw);
    for (const key of ONBOARDING_STRIP_EXTRA) {
        delete stripped[key];
    }
    return stripped;
}

/* ═══════════════════════════════════════════════════════════════════
   4.  sanitizeAuthResponse  –  Login / getMe payloads
       Ensures the {success, user, company, enabledModules} envelope
       never contains raw tokens, passwords, or stack traces.
   ═══════════════════════════════════════════════════════════════════ */
function sanitizeAuthResponse(payload) {
    if (!payload) return payload;
    // The auth controller already uses sanitizeUserForClient, but apply
    // the generic strip as a second pass safety net.
    return sanitizeData(payload);
}

/* ═══════════════════════════════════════════════════════════════════
   5.  sanitizePayroll  –  Additional banking/financial strip
   ═══════════════════════════════════════════════════════════════════ */
const PAYROLL_EXTRA_STRIP = new Set([
    'bankAccountNumber',
    'accountNumber',
    'bankRoutingNumber',
    'rawTaxTable',
    'internalCalcTrace',
    'engineDebug',
    'pfAccountRaw',
    'generatorTrace',
]);

function stripPayrollExtra(value, depth = 0) {
    if (depth > MAX_DEPTH) return value;
    if (Array.isArray(value)) return value.map((v) => stripPayrollExtra(v, depth + 1));
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
        const cleaned = {};
        for (const [key, val] of Object.entries(value)) {
            if (PAYROLL_EXTRA_STRIP.has(key)) continue;
            cleaned[key] = stripPayrollExtra(val, depth + 1);
        }
        return cleaned;
    }
    return value;
}

function sanitizePayroll(record) {
    if (!record) return null;
    const raw = typeof record.toObject === 'function' ? record.toObject() : { ...record };
    return stripPayrollExtra(sanitizeData(raw));
}

/* ═══════════════════════════════════════════════════════════════════
   6.  sendSuccess / sendError  –  Uniform envelope helpers
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Send a standardised success response.
 *
 * Shape: { success: true, data: <cleaned>, message: "" }
 *
 * @param {object} res       – Express response object
 * @param {*}      data      – Payload to send (will be sanitized)
 * @param {string} [message] – Optional human-readable message
 * @param {number} [status]  – HTTP status (default 200)
 */
function sendSuccess(res, data, message = '', status = 200) {
    const cleaned = sanitizeData(data);
    return res.status(status).json({
        success: true,
        data: cleaned,
        message,
    });
}

/**
 * Send a standardised error response.
 *
 * Shape: { success: false, error: <code>, message: <text> }
 * Never leaks stack traces or internal error objects in production.
 *
 * @param {object} res       – Express response object
 * @param {string} message   – Human-readable error description
 * @param {number} [status]  – HTTP status (default 500)
 * @param {string} [code]    – Machine-readable error code
 */
function sendError(res, message, status = 500, code = 'server_error') {
    const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
    return res.status(status).json({
        success: false,
        error: code,
        message: isProduction && status === 500
            ? 'An unexpected error occurred. Please contact support.'
            : message,
    });
}

/* ═══════════════════════════════════════════════════════════════════
   7.  apiResponseGuard  –  Express middleware (auto-apply sanitiser)
   ═══════════════════════════════════════════════════════════════════
   Monkey-patches res.json() on every /api request so every controller
   that calls res.json(payload) gets automatic sanitisation without
   having to be individually modified.

   IMPORTANT: This is a last-resort safety net, NOT a replacement for
   per-entity allowlists. Controllers should still use the dedicated
   sanitize functions where possible for tighter control.
   ═══════════════════════════════════════════════════════════════════ */
const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

function apiResponseGuard(req, res, next) {
    const originalJson = res.json.bind(res);

    res.json = function guardedJson(body) {
        // Only intercept JSON responses for /api paths
        if (!req.path || !req.path.startsWith('/')) {
            return originalJson(body);
        }

        if (body === null || body === undefined || typeof body !== 'object') {
            return originalJson(body);
        }

        // Strip top-level sensitive fields
        const sanitized = sanitizeData(body);

        // In production, remove any accidentally included stack or debug info
        if (isProduction) {
            delete sanitized.stack;
            delete sanitized.stackTrace;
            delete sanitized.debug_stack;
            delete sanitized._debug;
        }

        return originalJson(sanitized);
    };

    next();
}

/* ═══════════════════════════════════════════════════════════════════
   8.  Helper: toStandardShape
   ═══════════════════════════════════════════════════════════════════
   Wraps an arbitrary response body in the standard envelope if it
   doesn't already have the { success, data, message } shape.
   Useful for legacy controllers that just return raw data.
   ═══════════════════════════════════════════════════════════════════ */
function toStandardShape(body) {
    if (body === null || body === undefined) {
        return { success: true, data: null, message: '' };
    }
    // Already standardised
    if (typeof body === 'object' && 'success' in body) return body;

    // Array response
    if (Array.isArray(body)) {
        return { success: true, data: body, message: '' };
    }

    return { success: true, data: body, message: '' };
}

/* ─── Exports ────────────────────────────────────────────────────── */
module.exports = {
    sanitizeData,
    sanitizeEmployee,
    sanitizeOnboarding,
    sanitizeAuthResponse,
    sanitizePayroll,
    sendSuccess,
    sendError,
    apiResponseGuard,
    toStandardShape,
    ALWAYS_STRIP,
};
