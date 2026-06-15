/**
 * response.js
 * ─────────────────────────────────────────────────────────────────
 * Lightweight response helpers that enforce the standard envelope:
 *   { success: true,  data: {},     message: "" }
 *   { success: false, error: "<code>", message: "" }
 *
 * These are thin wrappers around the full apiSanitizer helpers;
 * they exist so legacy code importing from './utils/response' gets
 * the upgraded behaviour automatically.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const { sendSuccess, sendError, sanitizeData } = require('./apiSanitizer');

/**
 * Send a successful JSON response.
 * @param {object} res        Express response
 * @param {*}      data       Payload (auto-sanitized)
 * @param {number} [status]   HTTP status (default 200)
 * @param {string} [message]  Optional message
 */
exports.success = (res, data, status = 200, message = '') =>
    sendSuccess(res, data, message, status);

/**
 * Send an error JSON response.
 * @param {object} res        Express response
 * @param {string} message    Human-readable description
 * @param {number} [status]   HTTP status (default 500)
 * @param {string} [code]     Machine-readable error code
 */
exports.error = (res, message, status = 500, code = 'server_error') =>
    sendError(res, message, status, code);

/**
 * Directly expose sanitizeData for controllers that need it.
 */
exports.sanitize = sanitizeData;
