/**
 * error.middleware.js  (hardened — no stack trace leakage)
 * ══════════════════════════════════════════════════════════════════
 * Global Express error handler. Must be the LAST middleware.
 *
 * Security rules:
 *  ① Never expose stack traces in production (attackers map them)
 *  ② Never expose raw MongoDB error messages to the client
 *  ③ Log full details server-side, return generic message client-side
 *  ④ Uniform response shape: { success, error, message }
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

function appendErrorLog(text) {
  try {
    const logFile = path.join(process.cwd(), 'logs', `error_${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(logFile, text + '\n', 'utf8');
  } catch (_) { /* never crash the error handler itself */ }
}

module.exports = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  const logLine =
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl || req.path} | ` +
    `IP:${req.clientIp || req.ip} | User:${req.user?.id || 'anon'} | ` +
    `Error(${err.status || err.statusCode || 500}): ${err.message}\n${err.stack || ''}`;

  appendErrorLog(logLine);
  if (!isProduction) console.error('[global-error]', err);

  // Already sent — nothing we can do
  if (res.headersSent) return next(err);

  /* ── Mongoose validation error ─────────────────────────────── */
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {})
      .map((e) => e.message)
      .join(', ');
    return res.status(400).json({
      success: false,
      error: 'validation_error',
      message: messages || 'Validation failed',
    });
  }

  /* ── Mongoose duplicate key ─────────────────────────────────── */
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    return res.status(400).json({
      success: false,
      error: 'duplicate_entry',
      message: `${field} already exists`,
    });
  }

  /* ── JWT / Auth errors ──────────────────────────────────────── */
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'invalid_token',
      message: 'Authentication token is invalid or expired.',
    });
  }

  /* ── Body parser too large ──────────────────────────────────── */
  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      error: 'request_too_large',
      message: 'Request body is too large.',
    });
  }

  /* ── Custom errors with explicit status ─────────────────────── */
  if (err.status || err.statusCode) {
    return res.status(err.status || err.statusCode).json({
      success: false,
      error: err.error || 'error',
      message: err.message || 'Request failed',
    });
  }

  /* ── Default 500 ─────────────────────────────────────────────── */
  return res.status(500).json({
    success: false,
    error: 'server_error',
    // In production never expose internal error text
    message: isProduction
      ? 'An unexpected error occurred. Please contact support.'
      : (err.message || 'Internal server error'),
  });
};
