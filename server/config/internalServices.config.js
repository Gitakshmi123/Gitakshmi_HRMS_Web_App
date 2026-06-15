/**
 * internalServices.config.js
 * ─────────────────────────────────────────────────────────────────
 * Single source of truth for every internal service URL.
 *
 * Rule: Route files MUST import from here – never hard-code URLs.
 * In production these values come from env vars; in development they
 * fall back to the local Express server itself (same process).
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

/**
 * The port this Express process is listening on.
 * Used to construct self-referencing "internal" URLs in development.
 */
const SELF_PORT = process.env.PORT || 5003;

/**
 * Base URL of the current server process.
 * All internal services in dev are actually routes on this same server,
 * so the proxy simply calls back to itself internally.
 */
const SELF_BASE = `http://127.0.0.1:${SELF_PORT}`;

/**
 * Service registry.
 *
 * Each entry maps a logical service name → base URL.
 * Override any of these via env vars for staging / production
 * micro-service splits.
 *
 * Pattern:  INTERNAL_<SERVICE>_URL=http://my-service:PORT
 */
const INTERNAL_SERVICES = {
    /** Employee management micro-service (/api/employee routes) */
    employees: process.env.INTERNAL_EMPLOYEES_URL || `${SELF_BASE}/api/employee`,

    /** Onboarding service (/api/onboarding routes) */
    onboarding: process.env.INTERNAL_ONBOARDING_URL || `${SELF_BASE}/api/onboarding`,

    /** Payroll / salary service (/api/payroll routes) */
    payroll: process.env.INTERNAL_PAYROLL_URL || `${SELF_BASE}/api/payroll`,

    /** HR core service (/api/hr routes) */
    hr: process.env.INTERNAL_HR_URL || `${SELF_BASE}/api`,

    /** Attendance service (/api/attendance routes) */
    attendance: process.env.INTERNAL_ATTENDANCE_URL || `${SELF_BASE}/api/attendance`,

    /** Recruitment service (/api/recruitment routes) */
    recruitment: process.env.INTERNAL_RECRUITMENT_URL || `${SELF_BASE}/api`,
};

/**
 * Retrieve a service base URL by name.
 * Throws if the service is unknown so misfires are caught early.
 *
 * @param {string} name  Key from INTERNAL_SERVICES
 * @returns {string}     Base URL (no trailing slash)
 */
function getServiceUrl(name) {
    const url = INTERNAL_SERVICES[name];
    if (!url) {
        throw new Error(`[ProxyConfig] Unknown internal service: "${name}"`);
    }
    return url.replace(/\/$/, ''); // normalise: no trailing slash
}

module.exports = {
    INTERNAL_SERVICES,
    getServiceUrl,
    SELF_BASE,
};
