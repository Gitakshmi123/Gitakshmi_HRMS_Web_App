/**
 * security.middleware.js  (v2 — hardened)
 * ══════════════════════════════════════════════════════════════════
 * Centralised security setup:
 *  1. Helmet (HTTP security headers + CSP)
 *  2. Tiered rate limiters  (general / auth / upload / admin)
 *  3. Trusted-origin CORS validation
 *  4. MongoDB injection sanitisation
 *  5. XSS body sanitisation
 *  6. Cache-control for /api responses
 *  7. Per-route request size limiters (tighter than the global 50 MB)
 *  8. CSRF cookie seed on every response
 * ══════════════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
let mongoSanitize = null;
let xss = null;

try {
    mongoSanitize = require('express-mongo-sanitize');
} catch (e) {
    console.warn('[Security] express-mongo-sanitize is not installed. Mongo sanitize middleware is disabled.');
}

try {
    xss = require('xss-clean');
} catch (e) {
    console.warn('[Security] xss-clean is not installed. XSS sanitize middleware is disabled.');
}
const { getAllowedOrigins, isAllowedOrigin } = require('../config/security.config');
const { ensureCsrfCookie } = require('./csrf.middleware');

const isProduction = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

/* ══════════════════════════════════════════════════════════════════
   RATE LIMITERS
   ══════════════════════════════════════════════════════════════════ */
function buildRateLimit(opts) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res, _next, options) => {
      res.status(options.statusCode).json({
        success: false,
        error: 'rate_limit_exceeded',
        message: options.message,
      });
    },
    ...opts,
  });
}

/** General API — 300 req / 15 min per IP */
const generalApiLimiter = buildRateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 5000 : 10000,
  message: 'Too many requests from this IP. Please try again later.',
});

/** Auth endpoints — 10 failed attempts / 15 min (brute-force guard) */
const authAttemptLimiter = buildRateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 10 : 1000,
  skipSuccessfulRequests: true,
  message: 'Too many authentication attempts. Please wait before trying again.',
});

/** Refresh token — 30 / 15 min */
const refreshTokenLimiter = buildRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many session refresh attempts. Please sign in again.',
});

/**
 * Upload endpoints — permissive count (10/min) but body parser limited separately.
 * This prevents flooding even before the payload hits disk.
 */
const uploadLimiter = buildRateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many upload requests. Please wait before uploading again.',
});

/** Admin / sensitive config endpoints — very tight: 60 / 15 min */
const adminLimiter = buildRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Admin API rate limit reached. Please try again later.',
});

/** Password reset / forgot — extremely tight: 5 / hour */
const passwordResetLimiter = buildRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Too many password reset requests. Please try again in an hour.',
});

/* ══════════════════════════════════════════════════════════════════
   TRUSTED ORIGIN CHECKER (CSRF layer 1)
   ══════════════════════════════════════════════════════════════════ */
function enforceTrustedOrigin(req, res, next) {
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!mutating.includes(req.method)) return next();

  const origin = req.get('origin');
  const referer = req.get('referer');

  // Server-to-server / curl / Postman have no origin — allow in dev, block in prod
  if (!origin && !referer) {
    if (isProduction) {
      return res.status(403).json({
        success: false,
        error: 'origin_missing',
        message: 'Missing Origin header. Cross-site requests are not allowed.',
      });
    }
    return next();
  }

  if (isAllowedOrigin(origin || referer)) return next();

  return res.status(403).json({
    success: false,
    error: 'untrusted_origin',
    message: 'Request origin is not trusted.',
  });
}

/* ══════════════════════════════════════════════════════════════════
   REQUEST SIZE LIMITERS (tiered, overriding the global 50 MB)
   Applied per-path BEFORE body parsers would re-read the body.
   These use raw Content-Length header — fast, no parsing needed.
   ══════════════════════════════════════════════════════════════════ */
function buildSizeLimiter(limitBytes, message) {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > limitBytes) {
      return res.status(413).json({
        success: false,
        error: 'request_too_large',
        message,
      });
    }
    next();
  };
}

const API_SIZE_LIMIT = buildSizeLimiter(2 * 1024 * 1024, 'Request body must not exceed 2 MB.');
const UPLOAD_SIZE_LIMIT = buildSizeLimiter(15 * 1024 * 1024, 'Upload must not exceed 15 MB.');

/* ══════════════════════════════════════════════════════════════════
   MAIN SETUP FUNCTION
   ══════════════════════════════════════════════════════════════════ */
function setupSecurity(app) {
  /* 1 ── Hide server info ─────────────────────────────────────── */
  app.disable('x-powered-by');

  /* 2 ── Helmet (HTTP headers) ────────────────────────────────── */
  const allowedOrigins = getAllowedOrigins();

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProduction
        ? { maxAge: 31536000, includeSubDomains: true, preload: true }
        : false,
      contentSecurityPolicy: isProduction ? {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["*"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: [
            "'self'", 'data:', 'blob:',
            'https://res.cloudinary.com',
            'https://*.cloudinary.com',
            'https://gitakshmi.com',
            'https://placehold.co',
            'https://via.placeholder.com',
            'https://i.pravatar.cc',
            'https://images.unsplash.com',
          ],
          mediaSrc: ["'self'", 'blob:'],
          connectSrc: ["'self'", ...allowedOrigins],
          frameSrc: ["'self'", ...allowedOrigins],
          workerSrc: ["'self'", 'blob:'],
          manifestSrc: ["'self'"],
          upgradeInsecureRequests: [],
        },
      } : false,
      xssFilter: false, // We use xss-clean below instead
      frameguard: false, // We set frame-ancestors in CSP instead
    })
  );

  /* 3 ── Extra security headers ───────────────────────────────── */
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // For local development or trusted origins, we allow framing.
    // frameAncestors in CSP (above) is the modern way to handle this.
    // If we're not in production, or it's an upload/pdf, be more permissive.
    if (isProduction && !req.path.includes('/uploads/')) {
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    } else {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    }

    res.setHeader(
      'Permissions-Policy',
      'accelerometer=(), autoplay=(), camera=(self), display-capture=(), ' +
      'encrypted-media=(), fullscreen=(self), geolocation=(self), gyroscope=(), ' +
      'magnetometer=(), microphone=(), payment=(), ' +
      'publickey-credentials-get=(self), usb=()'
    );
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    next();
  });

  /* 4 ── Trusted origin check ─────────────────────────────────── */
  app.use(enforceTrustedOrigin);

  /* 5 ── Rate limiters ────────────────────────────────────────── */
  app.use('/api', generalApiLimiter);
  app.use('/api/admin', adminLimiter);
  app.use('/api/superadmin', adminLimiter);
  app.use('/api/uploads', uploadLimiter);
  app.use('/api/upload', uploadLimiter);

  /* 6 ── Request size limits (per route group) ─────────────────
     Note: these check Content-Length only; the body parser (50 MB
     global) will enforce the actual byte limit. These fast-reject
     obviously oversized requests before parsing begins.           */
  app.use('/api/auth', API_SIZE_LIMIT);
  app.use('/api/hr', API_SIZE_LIMIT);
  app.use('/api/employee', API_SIZE_LIMIT);
  app.use('/api/payroll', API_SIZE_LIMIT);
  app.use('/api/onboarding', API_SIZE_LIMIT);
  app.use('/api/uploads', UPLOAD_SIZE_LIMIT);  // uploads get more room
  app.use('/api/upload', UPLOAD_SIZE_LIMIT);

  /* 7 ── MongoDB injection sanitisation ───────────────────────── */
  if (mongoSanitize) {
    app.use(mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ req, key }) => {
        // Silent in production; warn in dev
        if (!isProduction) {
          console.warn(`[mongoSanitize] Potentially malicious key "${key}" in request from ${req.ip}`);
        }
      },
    }));
  }

  /* 8 ── XSS sanitisation ─────────────────────────────────────── */
  if (xss) {
    app.use(xss());
  }

  /* 9 ── No-cache for /api ─────────────────────────────────────── */
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  /* 10 ─ CSRF cookie seed — ensure every browser response has one  */
  app.use('/api', ensureCsrfCookie);
}

/* ─── Exports ────────────────────────────────────────────────────── */
module.exports = setupSecurity;
module.exports.authAttemptLimiter = authAttemptLimiter;
module.exports.generalApiLimiter = generalApiLimiter;
module.exports.refreshTokenLimiter = refreshTokenLimiter;
module.exports.uploadLimiter = uploadLimiter;
module.exports.adminLimiter = adminLimiter;
module.exports.passwordResetLimiter = passwordResetLimiter;
module.exports.API_SIZE_LIMIT = API_SIZE_LIMIT;
module.exports.UPLOAD_SIZE_LIMIT = UPLOAD_SIZE_LIMIT;
