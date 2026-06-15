const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const REQUIRED_PRODUCT = String(process.env.SSO_REQUIRED_PRODUCT || 'HRMS').toLowerCase();
const AUTHZ_BYPASS = String(process.env.AUTHZ_BYPASS || '').toLowerCase() === 'true' || process.env.NODE_ENV !== 'production';
const LEGACY_DEV_SECRET = 'hrms_secret_key_123';
const LEGACY_GT_ONE_DEV_SECRET = 'gt_one_sso_secret_key_2026_64_chars_long_and_secure';
const NON_TENANT_MARKERS = new Set([
  '',
  'null',
  'undefined',
  'none',
  'n/a',
  'na',
  'test',
  'demo',
  'gitakshmi-one',
]);

function cleanSecret(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

function getJwtVerifyCandidates() {
  const candidates = [];
  const add = (secret) => {
    const normalized = cleanSecret(secret);
    if (!normalized) return;
    if (!candidates.includes(normalized)) candidates.push(normalized);
  };

  add(process.env.SSO_JWT_SECRET);
  add(process.env.JWT_SECRET);
  add(process.env.JWT_ACCESS_SECRET);

  const commaSeparated = String(process.env.SSO_JWT_SECRETS || '').split(',');
  commaSeparated.forEach(add);

  // Backward compatibility for older SSO issuer defaults in local/dev.
  if (process.env.NODE_ENV !== 'production') {
    add(LEGACY_DEV_SECRET);
    add(LEGACY_GT_ONE_DEV_SECRET);
    add('secret');
    add('hrms_enterprise_dev_secret');
    add('access_secret_123');
  }

  return candidates;
}

function verifyJwtWithCandidates(token) {
  const candidates = getJwtVerifyCandidates();
  if (!candidates.length) {
    const e = new Error('sso_secret_missing');
    e.code = 'SSO_SECRET_MISSING';
    throw e;
  }

  let lastError = null;
  for (const secret of candidates) {
    try {
      return jwt.verify(token, secret);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('invalid_token');
}

exports.verifyJwtWithCandidates = verifyJwtWithCandidates;

function normalizeTenantIdentifier(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (NON_TENANT_MARKERS.has(raw.toLowerCase())) return null;
  return raw;
}

function isValidTenantObjectId(value) {
  const normalized = normalizeTenantIdentifier(value);
  if (!normalized) return false;
  return mongoose.Types.ObjectId.isValid(normalized);
}

function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  const compact = r.replace(/[\s-]+/g, '_');
  const aliases = {
    superadmin: 'super_admin',
    super_admin: 'super_admin',
    companyadmin: 'company_admin',
    company_admin: 'company_admin',
    companysuperadmin: 'company_super_admin',
    company_superadmin: 'company_super_admin',
    company_super_admin: 'company_super_admin',
    companyadminsuper: 'company_super_admin',
    maincompanyadmin: 'main_company_admin',
    main_company_admin: 'main_company_admin',
    subcompanyadmin: 'sub_company_admin',
    sub_company_admin: 'sub_company_admin',
    branchhead: 'branch_head',
    branch_head: 'branch_head',
    divisionhead: 'division_head',
    division_head: 'division_head',
    departmenthead: 'department_head',
    department_head: 'department_head',
    hradmin: 'hr_admin',
    hr_admin: 'hr_admin',
    hrmanager: 'hr_manager',
    hr_manager: 'hr_manager'
  };
  return aliases[compact] || compact;
}

async function resolveRoleFromUserCollection(req, currentRole) {
  const role = normalizeRole(currentRole);
  if (role && role !== 'employee' && role !== 'manager') return role;

  try {
    let User;
    try {
      User = mongoose.model('User');
    } catch (_) {
      User = require('../models/User');
    }

    const email = String(req.user?.email || '').trim();
    if (!email) return role;

    const emailRegex = new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const tenantId = String(req.user?.tenantId || req.user?.companyId || req.tenantId || '').trim();
    const query = { email: emailRegex };

    if (tenantId) {
      query.$or = [
        { tenant: tenantId },
        { companyId: tenantId }
      ];
    }

    const userDoc = await User.findOne(query).select('role').lean();
    const resolved = normalizeRole(userDoc?.role);
    return resolved || role;
  } catch (_) {
    return role;
  }
}

function getTokenFromHeader(req) {
  // 1. Try Authorization header (Standard Bearer Token)
  // 1. Try Authorization header (Standard Bearer Token)
  const h = req.headers.authorization || req.headers.Authorization;
  if (h) {
    const parts = h.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  }
  
  // 2. Try SSO Shared Cookie (from .gitakshmi.com or localhost)
  if (req.cookies) {
    // Support both SSO cookie, HRMS first-party auth cookies, and Job Portal candidate cookies.
    return req.cookies.candidateAccessToken || req.cookies.sso_token || req.cookies.accessToken || req.cookies.token || req.cookies.jwt || null;
  }
  
  return null;
}

function hasProductAccess(payload) {
  const role = normalizeRole(payload?.role);
  if (['psa', 'super_admin', 'company_super_admin', 'company_admin', 'admin', 'hr', 'hr_admin', 'hr_manager', 'sub_company_admin', 'branch_head', 'division_head', 'department_head', 'designation_head'].includes(role)) return true;

  const products = payload?.products;
  // Backward compatibility:
  // Local/unified login tokens may not carry `products` but still include tenant/company context.
  // In that case, treat token as HRMS-authorized.
  if (!products) {
    return Boolean(payload?.tenantId || payload?.companyId || payload?.companyCode);
  }

  if (Array.isArray(products)) {
    return products.some((p) => {
      if (typeof p === 'string') return p.toLowerCase() === REQUIRED_PRODUCT;
      if (p && typeof p === 'object') {
        const code = String(p.code || p.name || p.product || '').toLowerCase();
        const enabled = p.enabled === undefined ? true : Boolean(p.enabled);
        return code === REQUIRED_PRODUCT && enabled;
      }
      return false;
    });
  }

  if (typeof products === 'string') {
    return products.toLowerCase() === REQUIRED_PRODUCT;
  }

  if (typeof products === 'object') {
    return Object.keys(products).some((k) => String(k || '').toLowerCase() === REQUIRED_PRODUCT && Boolean(products[k]));
  }

  return false;
}

exports.authenticate = (req, res, next) => {
  try {
    if (!getJwtVerifyCandidates().length) {
      return res.status(500).json({ message: 'sso_secret_missing' });
    }

    const token = getTokenFromHeader(req);
    if (!token) return res.status(401).json({ message: 'no_token' });
    let payload = null;
    try {
      payload = verifyJwtWithCandidates(token);
    } catch (verifyErr) {
      if (process.env.NODE_ENV !== 'production') {
        const decoded = jwt.decode(token);
        if (decoded && typeof decoded === 'object') {
          const sig = token.split('.')[2] || 'no-sig';
          if (!global.loggedJwtWarns) global.loggedJwtWarns = new Set();
          if (!global.loggedJwtWarns.has(sig)) {
            global.loggedJwtWarns.add(sig);
            console.warn(`[AUTH_JWT] Verify failed in dev; using decoded payload: ${verifyErr.message} (Warning logged once per token)`);
          }
          payload = decoded;
        }
      }
      if (!payload) throw verifyErr;
    }

    if (!AUTHZ_BYPASS && !hasProductAccess(payload)) {
      return res.status(403).json({
        message: 'access_denied',
        detail: `User is not authorized for ${REQUIRED_PRODUCT.toUpperCase()}`
      });
    }

    const { normalizeTokenPayload } = require('../utils/token.utils');
    const normalizedPayload = normalizeTokenPayload(payload);

    const requestedTenant = normalizeTenantIdentifier(req.headers['x-tenant-id'] || req.headers['x-company-id']);
    const normalizedRole = normalizeRole(normalizedPayload.role);
    const canSelectTenant = ['psa', 'super_admin'].includes(normalizedRole);
    const payloadTenant = canSelectTenant && isValidTenantObjectId(requestedTenant)
      ? requestedTenant
      : normalizeTenantIdentifier(normalizedPayload.tenantId || normalizedPayload.companyId);
    const existingTenant = normalizeTenantIdentifier(req.tenantId);
    let resolvedTenantId = payloadTenant;

    // Guard: sometimes upstream sets tenantId to the base database name / placeholders.
    try {
      const baseDbName = String(mongoose.connection?.name || '').trim();
      const tid = String(resolvedTenantId || '').trim();
      if (tid && baseDbName && !mongoose.Types.ObjectId.isValid(tid)) {
        if (tid.toLowerCase() === baseDbName.toLowerCase() || tid === 'gitakshmi-one') {
          resolvedTenantId = undefined;
        }
      }
    } catch (_) {
      // ignore
    }

    // Preserve tenant resolved by tenant middleware when token tenant is placeholder/stale.
    if (!isValidTenantObjectId(resolvedTenantId) && isValidTenantObjectId(existingTenant)) {
      resolvedTenantId = existingTenant;
    }

    // If still not a valid ObjectId, avoid overriding req.tenantId with a broken value.
    if (!isValidTenantObjectId(resolvedTenantId)) {
      resolvedTenantId = undefined;
    }

    const payloadCompanyId = normalizeTenantIdentifier(normalizedPayload.companyId);
    const resolvedCompanyId = isValidTenantObjectId(payloadCompanyId)
      ? payloadCompanyId
      : (resolvedTenantId || payloadCompanyId || undefined);

    // Normalize role casing for downstream middleware checks.
    req.user = {
      ...normalizedPayload,
      userId: normalizedPayload.id,
      mainCompanyId: normalizedPayload.mainCompanyId || resolvedTenantId || resolvedCompanyId,
      subCompanyId: normalizedPayload.subCompanyId || null,
      branchId: normalizedPayload.branchId || null,
      divisionId: normalizedPayload.divisionId || null,
      departmentId: normalizedPayload.departmentId || null,
      designationId: normalizedPayload.designationId || null,
      tenantId: resolvedTenantId,
      companyId: resolvedCompanyId,
      role: normalizedRole
    };
    
    // Final safety: Only set req.tenantId if it was actually resolved to a valid ObjectId
    if (isValidTenantObjectId(resolvedTenantId)) {
        req.tenantId = String(resolvedTenantId);
    }
    next();
  } catch (err) {
    const candidates = getJwtVerifyCandidates();
    console.error(`[AUTH_JWT] Failed to verify token:`, {
      error: err.message,
      name: err.name,
      secretsCount: candidates.length,
      tokenPreview: req.headers.authorization ? req.headers.authorization.substring(0, 20) + '...' : 'NONE'
    });

    if (err?.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'token_expired' });
    }
    return res.status(401).json({ message: 'invalid_token' });
  }
};

/**
 * requireAdminOrHr
 * ──────────────────────────────────────────────────────────────────
 * This middleware checks if a user has administrative privileges.
 * UPDATED to be compatible with Dynamic RBAC:
 *   - Allows traditional roles (HR, Admin, etc.)
 *   - Allows any user that has been explicitly granted permissions in the User record.
 */
exports.requireAdminOrHr = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'no_user' });
  if (AUTHZ_BYPASS) {
    req.tenantId = req.user?.tenantId || req.user?.companyId || req.tenantId;
    return next();
  }

  const role = await resolveRoleFromUserCollection(req, req.user.role);
  const BYPASS_ROLES = ['admin', 'psa', 'super_admin', 'hr', 'company_admin', 'company_super_admin'];

  // 1. Grant access if user role is in bypass list
  if (BYPASS_ROLES.includes(role)) {
    if (req.user.tenantId) req.tenantId = req.user.tenantId;
    return next();
  }

  // 2. DYNAMIC RBAC FALLBACK:
  // If role is employee/manager, they might have explicit permissions in the User database.
  // We check if this user has an entry in the User collection with permissions.
  try {
    const User = mongoose.model('User');
    const userDoc = await User.findOne({ 
      email: { $regex: new RegExp(`^${req.user.email.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, 
      tenant: req.user.tenantId || req.tenantId
    }).select('permissions role');

    if (userDoc && Array.isArray(userDoc.permissions) && userDoc.permissions.length > 0) {
       // If they have permissions, we let them through to the ACTUAL controller 
       // or the next checkPermission middleware. 
       if (req.user.tenantId) req.tenantId = req.user.tenantId;
       return next();
    }
  } catch (err) {
    console.error("[requireAdminOrHr] Dynamic RBAC Check Failed:", err.message);
  }

  console.warn(`[requireAdminOrHr] Forbidden: ${req.user.id} (Role: ${role})`);
  return res.status(403).json({
    success: false,
    message: 'Forbidden: Administrative access required (HR Permission required).',
    receivedRole: req.user.role
  });
};

/**
 * requireHr
 * ──────────────────────────────────────────────────────────────────
 * Specifically intended for endpoints originally hardcoded for HR.
 * Modified to allow any user with explicit RBAC permissions.
 */
exports.requireHr = async (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'no_user' });
  if (AUTHZ_BYPASS) {
    req.tenantId = req.user?.tenantId || req.user?.companyId || req.tenantId;
    return next();
  }

  const role = await resolveRoleFromUserCollection(req, req.user.role);
  const allowedRoles = ['hr', 'admin', 'psa', 'company_admin', 'company_super_admin', 'super_admin'];

  if (allowedRoles.includes(role)) {
    if (req.user.tenantId) req.tenantId = req.user.tenantId;
    return next();
  }

  // Fallback check for Dynamic RBAC
  try {
    const User = mongoose.model('User');
    const userDoc = await User.findOne({ 
      email: { $regex: new RegExp(`^${req.user.email.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, 
      tenant: req.user.tenantId || req.tenantId
    }).select('permissions');

    if (userDoc && Array.isArray(userDoc.permissions) && userDoc.permissions.length > 0) {
       if (req.user.tenantId) req.tenantId = req.user.tenantId;
       return next();
    }
  } catch (err) {
    console.error("[requireHr] Dynamic RBAC Check Failed:", err.message);
  }

  console.warn(`[requireHr] Forbidden: Role '${role}' not in allowed list.`);
  return res.status(403).json({ success: false, message: 'Administrative access required (HR).' });
};

exports.requirePsa = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'no_user' });
  const isBypass = String(process.env.AUTHZ_BYPASS || '').toLowerCase() === 'true';
  if (isBypass) return next();

  const role = String(req.user?.role || '').toLowerCase();
  if (['admin', 'hr', 'company_admin', 'company_super_admin', 'psa'].includes(role)) {
    return next();
  }
  return res.status(403).json({ message: 'forbidden' });
};

exports.authorize = (roles = []) => {
  if (typeof roles === 'string') roles = [roles];

  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });

    const userRole = req.user.role ? req.user.role.toLowerCase() : '';
    const allowedRoles = roles.map(r => r.toLowerCase());

    if (roles.length && !allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Forbidden: Insufficient Permissions' });
    }

    next();
  };
};

exports.normalizeRoleName = normalizeRole;
exports.normalizeRole = normalizeRole;
exports.getRequestAccessToken = getTokenFromHeader;
