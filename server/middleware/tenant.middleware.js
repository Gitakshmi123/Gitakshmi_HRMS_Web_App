// middleware/tenant.middleware.js
const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const { getRequestAccessToken, verifyJwtWithCandidates } = require('./auth.jwt');
const DEBUG_TENANT_RESOLVE = String(process.env.DEBUG_TENANT_RESOLVE || '').toLowerCase() === 'true';

function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  return r === 'superadmin' ? 'super_admin' : r;
}

const AUTH_TENANT_SKIP_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/login-unified',
  '/api/auth/login/unified',
  '/api/auth/login-hr',
  '/api/auth/login-employee',
  '/api/auth/employee-otp/request',
  '/api/auth/employee-otp/verify',
  '/api/auth/refresh-token',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/sso/me'
]);

module.exports = async function tenantResolver(req, res, next) {
  try {
    // 1. Skip tenant resolution for non-API/health/discovery routes
    if (
      req.method === 'OPTIONS' ||
      req.path === '/api/health' ||
      req.path === '/health' ||
      req.path === '/api/auth/sso-login' ||
      AUTH_TENANT_SKIP_PATHS.has(req.path) ||
      AUTH_TENANT_SKIP_PATHS.has('/api' + req.path)
    ) {
      return next();
    }

    const socialOAuthPaths = [
      '/social-media/linkedin/connect', '/social-media/linkedin/callback',
      '/social-media/facebook/connect', '/social-media/facebook/callback',
      '/social-media/instagram/connect', '/social-media/instagram/callback'
    ];
    if (socialOAuthPaths.some(path => req.path.includes(path))) {
      return next();
    }

    // 2. Handle Public Routes Discovery (paths are /api/public/... in this app)
    if (req.path.startsWith('/api/public/') || req.path.startsWith('/public/') ||
        req.path.startsWith('/api/candidate/document-upload/') || req.path.startsWith('/candidate/document-upload/')) {
      let tenantId = req.headers["x-tenant-id"] || req.query.tenantId;

      // Extract from path if token starts with a valid ObjectId followed by underscore
      if (!tenantId) {
        const offerMatch = req.path.match(/\/offer\/([a-f0-9]{24})_/i);
        if (offerMatch) {
          tenantId = offerMatch[1];
        }
      }

      if (!tenantId) {
        // Matches /candidate-documents/{action}/{tenantId}_{rest} (public candidate doc portal)
        const candidateDocMatch = req.path.match(/\/candidate-documents\/(?:token|save-draft|submit|upload|reference-data|draft)\/([a-f0-9]{24})_/i);
        if (candidateDocMatch) {
          tenantId = candidateDocMatch[1];
        }
      }

      if (!tenantId) {
        // Matches /candidate/document-upload/{tenantId}_{rest}/{action}
        // e.g. /candidate/document-upload/6649abc...def_xyz123.../reference-data
        const empFormMatch = req.path.match(/\/candidate\/document-upload\/([a-f0-9]{24})_/i) ||
                             req.path.match(/\/document-upload\/([a-f0-9]{24})_/i);
        if (empFormMatch) {
          tenantId = empFormMatch[1];
        }
      }

      if (tenantId && mongoose.Types.ObjectId.isValid(String(tenantId))) {
        req.tenantId = tenantId;
        req.tenantDB = await getTenantDB(tenantId);
        return next();
      }

      // For ALL public routes, we allow it to proceed to next() even without a tenantId header.
      return next();
    }

    // 3. Early check for PSA (Super Admin) to avoid unnecessary resolution attempts
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader) {
      try {
        const token = authHeader.split(' ')[1];
        if (token) {
          const decoded = require('jsonwebtoken').decode(token);
          const role = String(decoded?.role || '').toLowerCase();
          if (['psa', 'superadmin', 'super_admin'].includes(role) && !req.headers["x-tenant-id"] && !req.headers["x-company-id"]) {
            // PSA is performing a global action, no tenant resolution needed.
            req.tenantId = null;
            req.tenantDB = null; 
            return next();
          }
        }
      } catch (e) { /* ignore and continue to full resolution */ }
    }

    // 3. Resolve Tenant Identity from user, headers, or JWT
    const explicitTenantHeader = req.headers["x-tenant-id"] || req.headers["x-company-id"] || null;
    let tenantId = req.user?.tenantId || req.user?.tenant || req.user?.companyId || explicitTenantHeader;
    let tokenCompanyCode = req.user?.companyCode || req.headers["x-company-code"] || null;

    if (!tenantId || (!req.user && !req.candidate)) {
      const queryToken = req.query.token;
      const token = queryToken || getRequestAccessToken(req);

      if (token) {
        try {
          const payload = verifyJwtWithCandidates(token);
          // An explicit tenant header comes from the currently selected company in the HRMS UI.
          // Do not let an old/stale bearer token silently switch the request back to another tenant.
          tenantId = explicitTenantHeader || payload.tenantId || payload.tenant || payload.companyId || tenantId;
          tokenCompanyCode = payload.companyCode || payload.company_code || tokenCompanyCode;
        } catch (e) {
          // Token might be invalid or expire, but we continue to check other identity methods
        }
      }
    }

    // If the token/session only provides companyCode (common in some SSO payloads),
    // use it to resolve the tenant ObjectId via code in the next step.
    if (!tenantId && tokenCompanyCode) {
      tenantId = tokenCompanyCode;
    }

    try {
      const baseDbName = String(mongoose.connection?.name || '').trim();
      const tid = String(tenantId || '').trim();
      if (tid && !mongoose.Types.ObjectId.isValid(tid)) {
        // GT-ONE/Gitakshmi-one dependency removed
        // if (baseDbName && (tid.toLowerCase() === baseDbName.toLowerCase() || tid === 'gitakshmi-one')) {
        if (baseDbName && tid.toLowerCase() === baseDbName.toLowerCase()) {
          tenantId = null;
        }
      }
    } catch (_e) {
      // ignore
    }

    // Removed dangerous fallback to pick first active tenant
    if (!tenantId || !mongoose.Types.ObjectId.isValid(String(tenantId))) {
      // In production, we should fail or return 400.
      // For now, just let it proceed to next() and the controllers will handle missing tenantDB.
      req.tenantId = null;
    }

    req.tenantId = tenantId;
    // Keep req.user tenant fields in sync so controllers using req.user.tenantId won't crash.
    if (req.user && tenantId) {
      const prev = req.user.tenantId || req.user.tenant || req.user.companyId;
      const prevStr = prev ? String(prev).trim() : '';
      const nextStr = String(tenantId).trim();
      if (!prevStr || prevStr.toLowerCase() === nextStr.toLowerCase() || !mongoose.Types.ObjectId.isValid(prevStr)) {
        req.user.tenantId = tenantId;
      } else {
        // If upstream mistakenly set base DB name, overwrite with resolved tenant.
        const baseDbName = String(mongoose.connection?.name || '').trim();
        // if (baseDbName && (prevStr.toLowerCase() === baseDbName.toLowerCase() || prevStr === 'gitakshmi-one')) {
        if (baseDbName && prevStr.toLowerCase() === baseDbName.toLowerCase()) {
          req.user.tenantId = tenantId;
        }
      }
      // companyId is treated as tenant id in many legacy controllers
      if (!req.user.companyId || !mongoose.Types.ObjectId.isValid(String(req.user.companyId))) {
        req.user.companyId = tenantId;
      }
    }

    if (!tenantId) {
      return next();
    }

    // 5. Database Resolution (ID or Code)
    if (!mongoose.Types.ObjectId.isValid(String(tenantId))) {
      const Tenant = mongoose.model('Tenant');
      const t = await Tenant.findOne({ code: tenantId }).select('_id').lean();
      if (t) {
        req.tenantId = t._id.toString();
        tenantId = req.tenantId;
      } else {
        // Removed dangerous fallback
        req.tenantId = null;
        tenantId = null;
      }
    } else {
      const Tenant = mongoose.model('Tenant');
      const exists = await Tenant.findById(tenantId).select('_id code').lean();
      if (!exists) {
        // Fallback discovery if ID in token is stale
        if (tokenCompanyCode) {
          const t = await Tenant.findOne({ code: tokenCompanyCode }).select('_id').lean();
          if (t) {
            req.tenantId = t._id.toString();
            tenantId = req.tenantId;
          } else {
            // Removed dangerous fallback
            req.tenantId = null;
            tenantId = null;
          }
        } else {
          // Removed dangerous fallback
          req.tenantId = null;
          tenantId = null;
        }
      }
    }

    // Final safety: never allow base DB name (or any non-ObjectId) to leak through in dev.
    // If we still don't have a valid ObjectId here, pick the first active tenant.
    if (!mongoose.Types.ObjectId.isValid(String(req.tenantId || tenantId))) {
       req.tenantId = null;
       tenantId = null;
    }

    // Attach Tenant DB
    req.tenantDB = await getTenantDB(req.tenantId || tenantId);
    if (DEBUG_TENANT_RESOLVE) {
      console.log(`[TENANT_RESOLVE] Path: ${req.path} | Tenant: ${req.tenantId} | DB: ${req.tenantDB?.name}`);
    }

    // Final safety: if we still don't have a tenantDB, it means the identifier was invalid or missing.
    // We no longer fallback to picking the first active tenant as it causes data leakage.
    next();
  } catch (err) {
    console.error("Tenant resolve failed:", err.message);
    if (!res.headersSent) {
      res.status(400).json({ error: "tenant_not_resolved", message: err.message });
    }
  }
};
