const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Tenant = require('../models/Tenant');
const getTenantDB = require('../utils/tenantDB');
const { sendMail } = require('../utils/emailService');
const { sanitizePermissions } = require('../utils/defaultRolePermissions');
const { normalizeRole, resolveUserPermissionBundle } = require('../utils/rbac');
const {
  ACCESS_TOKEN_COOKIE_MAX_AGE_MS,
  REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
  createRandomId,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
} = require('../utils/token.utils');
const {
  clearAuthCookies,
  setAccessTokenCookie,
  setRefreshTokenCookie,
} = require('../utils/authCookies');
const {
  sanitizeEnabledModules,
  sanitizeTenantForClient,
  sanitizeUserForClient,
} = require('../utils/responseSanitizer');
const { normalizeRoleName } = require('../middleware/auth.jwt');

const RefreshToken = require('../models/RefreshToken');

const ADMIN_ROLES = [
  'hr',
  'admin',
  'company_admin',
  'company_super_admin',
  'MAIN_COMPANY_ADMIN',
  'SUB_COMPANY_ADMIN',
  'BRANCH_HEAD',
  'DIVISION_HEAD',
  'DEPARTMENT_HEAD',
  'DESIGNATION_HEAD',
  'main_company_admin',
  'sub_company_admin',
  'branch_head',
  'division_head',
  'department_head',
  'designation_head'
];
const EMPLOYEE_PORTAL_USER_ROLES = new Set(['employee', 'staff', 'user', 'manager', 'EMPLOYEE']);

/** In-memory OTP store for employee passwordless login (restart clears OTPs). */
const employeeOtpEntries = new Map();

function getUserModel() {
  return mongoose.model('User');
}

function getSuperAdminConfig() {
  const configuredPassword = String(process.env.PSA_PASSWORD || '').trim();
  const configuredPasswordHash = String(process.env.PSA_PASSWORD_HASH || '').trim();
  const useDevFallbackPassword = !isProduction() && !configuredPassword && !configuredPasswordHash;

  return {
    email: String(process.env.PSA_EMAIL || process.env.SUPER_ADMIN_EMAIL || 'superadmin@hrms.com').trim().toLowerCase(),
    password: configuredPassword || (useDevFallbackPassword ? 'admin123' : ''),
    passwordHash: configuredPasswordHash,
    role: 'psa',
    name: String(process.env.PSA_NAME || 'Super Admin').trim(),
  };
}

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

function allowLegacyPlaintextPasswords() {
  const configured = String(process.env.ALLOW_LEGACY_PLAINTEXT_PASSWORDS || '').trim().toLowerCase();
  if (configured === 'true' || configured === '1' || configured === 'yes') return true;
  if (configured === 'false' || configured === '0' || configured === 'no') return false;
  return !isProduction();
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEnabledModuleMap(enabledModules = {}) {
  return sanitizeEnabledModules(enabledModules);
}

function enabledModulesToArray(enabledModules = {}) {
  const labelByKey = {
    hr: 'HR',
    payroll: 'Payroll',
    attendance: 'Attendance',
    leave: 'Leave',
    recruitment: 'Hiring',
    backgroundVerification: 'BGV',
    documentManagement: 'Documents',
    socialMediaIntegration: 'Social Media',
    employeePortal: 'Employee Portal',
    reports: 'Reports',
    onboarding: 'Onboarding',
    policy: 'Policy',
  };

  return Object.keys(labelByKey)
    .filter((key) => enabledModules?.[key] === true)
    .map((key) => labelByKey[key]);
}

function normalizeModuleKeyFromLabel(label = '') {
  const key = String(label || '').trim().toLowerCase();
  const map = {
    hr: 'hr',
    'hr management': 'hr',
    payroll: 'payroll',
    'payroll system': 'payroll',
    attendance: 'attendance',
    'attendance management': 'attendance',
    leave: 'leave',
    hiring: 'recruitment',
    recruitment: 'recruitment',
    bgv: 'backgroundVerification',
    'background verification': 'backgroundVerification',
    documents: 'documentManagement',
    'doc management': 'documentManagement',
    'document management': 'documentManagement',
    'social media': 'socialMediaIntegration',
    'social media integration': 'socialMediaIntegration',
    'employee portal': 'employeePortal',
    ess: 'employeePortal',
    reports: 'reports',
    onboarding: 'onboarding',
    policy: 'policy',
  };
  return map[key] || null;
}

function resolveCompanyModules(tenant) {
  if (Array.isArray(tenant?.modules) && tenant.modules.length > 0) {
    return tenant.modules.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return enabledModulesToArray(tenant?.enabledModules || {});
}

function resolveCompanyModuleKeys(tenant) {
  const labelModules = resolveCompanyModules(tenant);
  const keys = new Set();
  labelModules.forEach((label) => {
    const normalized = normalizeModuleKeyFromLabel(label);
    if (normalized) keys.add(normalized);
  });
  if (keys.size > 0) return Array.from(keys);
  return Object.keys(tenant?.enabledModules || {}).filter((key) => tenant?.enabledModules?.[key] === true);
}

function buildTenantPayload(tenant) {
  return sanitizeTenantForClient(tenant, {
    modules: resolveCompanyModules(tenant),
    moduleKeys: resolveCompanyModuleKeys(tenant),
    enabledModules: buildEnabledModuleMap(tenant?.enabledModules || {}),
  });
}

function buildPsaEnabledModules() {
  return {
    hr: true,
    payroll: true,
    attendance: true,
    leave: true,
    recruitment: true,
    backgroundVerification: true,
    documentManagement: true,
    socialMediaIntegration: true,
    onboarding: true,
    employeePortal: true,
    reports: true,
    policy: true,
  };
}

async function comparePassword(candidatePassword, storedPassword) {
  const rawStored = String(storedPassword || '');
  if (!rawStored) return false;
  if (rawStored.startsWith('$2')) {
    return bcrypt.compare(candidatePassword, rawStored);
  }
  if (!allowLegacyPlaintextPasswords()) return false;
  return rawStored === String(candidatePassword || '');
}

async function verifyEmployeePortalPassword(employee, tenant, password) {
  if (!password || !employee?.email || !tenant?._id) { console.log('DEBUG: missing inputs'); return false; }
  console.log('DEBUG: checking employee.password');
  if (employee.password && await comparePassword(password, employee.password)) { console.log('DEBUG: matched employee.password'); return true; }

  try {
    const User = getUserModel();
    const portalUser = await User.findOne({ email: normalizeEmail(employee.email) }).select('password role tenant mainCompanyId').lean();
    if (!portalUser?.password) { console.log('DEBUG: no portalUser password'); return false; }
    const portalTenantId = portalUser.tenant || portalUser.mainCompanyId;
    if (String(portalTenantId) !== String(tenant._id)) { console.log('DEBUG: tenant mismatch', portalTenantId, tenant._id); return false; }
    const r = String(portalUser.role || '').toLowerCase();
    if (!EMPLOYEE_PORTAL_USER_ROLES.has(r)) { console.log('DEBUG: bad role', r); return false; }
    const match = await comparePassword(password, portalUser.password);
    console.log('DEBUG: matched portalUser.password:', match);
    return match;
  } catch (err) {
    console.log('DEBUG: error in verify:', err);
    return false;
  }
}

async function verifySuperAdminPassword(password) {
  const config = getSuperAdminConfig();
  if (config.passwordHash) return bcrypt.compare(String(password || ''), config.passwordHash);
  if (config.password) return config.password === String(password || '');
  return false;
}

function getRequestMeta(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const ipAddress = Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor || req.ip || '').split(',')[0].trim() || null;
  return { ipAddress, userAgent: req.get('user-agent') || null };
}

async function createRefreshSession(req, res, authSubject) {
  const sessionId = createRandomId();
  const refreshTokenId = createRandomId();
  const accessToken = generateAccessToken(authSubject, sessionId);
  const refreshToken = generateRefreshToken(authSubject, sessionId, refreshTokenId);
  const decodedRefresh = jwt.decode(refreshToken);
  const meta = getRequestMeta(req);

  await RefreshToken.create({
    subjectId: String(authSubject.id),
    subjectType: authSubject.subjectType,
    tenantId: authSubject.tenantId ? String(authSubject.tenantId) : null,
    sessionId,
    jti: refreshTokenId,
    tokenHash: hashToken(refreshToken),
    email: authSubject.email || null,
    role: authSubject.role || null,
    companyCode: authSubject.companyCode || null,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    expiresAt: decodedRefresh?.exp ? new Date(decodedRefresh.exp * 1000) : new Date(Date.now() + REFRESH_TOKEN_COOKIE_MAX_AGE_MS),
  });

  setAccessTokenCookie(req, res, accessToken, ACCESS_TOKEN_COOKIE_MAX_AGE_MS);
  setRefreshTokenCookie(req, res, refreshToken, REFRESH_TOKEN_COOKIE_MAX_AGE_MS);
  return accessToken;
}

async function revokeRefreshToken(refreshTokenValue, reason, replacementJti = null) {
  if (!refreshTokenValue) return null;
  return RefreshToken.findOneAndUpdate(
    { tokenHash: hashToken(refreshTokenValue) },
    { $set: { revokedAt: new Date(), revokedReason: reason, replacedByJti: replacementJti, lastUsedAt: new Date() } },
    { new: true }
  ).lean();
}

function buildPsaAuthContext() {
  const config = getSuperAdminConfig();
  const enabledModules = buildPsaEnabledModules();
  const user = sanitizeUserForClient({ _id: 'psa_admin', name: config.name, email: config.email, role: config.role, permissions: [] }, {
    id: 'psa_admin', name: config.name, email: config.email, role: config.role, permissions: [], tenantId: null, companyId: null, groupId: null,
  });
  return {
    authSubject: { id: 'psa_admin', subjectType: 'psa', email: config.email, role: config.role, tenantId: null, companyCode: null, companyId: null, mainCompanyId: null, subCompanyId: null, branchId: null, divisionId: null, departmentId: null, designationId: null, groupId: null },
    user, company: null, enabledModules
  };
}

function buildPsaAuthContextFromDb(dbUser) {
  const enabledModules = buildPsaEnabledModules();
  const role = dbUser.role || 'psa';
  const user = sanitizeUserForClient(dbUser, {
    id: dbUser._id, name: dbUser.name || 'Super Admin', email: dbUser.email, role: role, permissions: [], tenantId: null, companyId: null, groupId: null,
  });
  return {
    authSubject: { id: dbUser._id, subjectType: 'psa', email: dbUser.email, role: role, tenantId: null, companyCode: null, companyId: null, mainCompanyId: null, subCompanyId: null, branchId: null, divisionId: null, departmentId: null, designationId: null, groupId: null },
    user, company: null, enabledModules
  };
}

function buildAdminAuthContext(userDoc, tenant) {
  const role = normalizeRoleName(userDoc?.role?.name || userDoc?.role || 'hr');
  let permissions = sanitizePermissions(userDoc?.permissions || []);
  if (!permissions || permissions.length === 0) {
    const { getDefaultPerms } = require('../utils/defaultRolePermissions');
    permissions = getDefaultPerms(role);
  }
  const tenantPayload = buildTenantPayload(tenant);
  return {
    authSubject: { id: userDoc._id, subjectType: 'user', email: normalizeEmail(userDoc.email), role, tenantId: tenant._id, companyCode: tenant.code || null, companyId: userDoc.companyId || tenant._id, mainCompanyId: userDoc.mainCompanyId || tenant._id, subCompanyId: userDoc.subCompanyId || null, branchId: userDoc.branchId || null, divisionId: userDoc.divisionId || null, departmentId: userDoc.departmentId || null, designationId: userDoc.designationId || null, groupId: userDoc.groupId || tenant.groupId || null },
    user: sanitizeUserForClient(userDoc, { id: userDoc._id, name: userDoc.name || tenant.ownerName || tenant.companyName || tenant.name, email: normalizeEmail(userDoc.email), role, permissions, companyCode: tenant.code || null, tenantId: tenant._id, companyId: userDoc.companyId || tenant._id, mainCompanyId: userDoc.mainCompanyId || tenant._id, subCompanyId: userDoc.subCompanyId || null, branchId: userDoc.branchId || null, divisionId: userDoc.divisionId || null, departmentId: userDoc.departmentId || null, designationId: userDoc.designationId || null, groupId: userDoc.groupId || tenant.groupId || null }),
    company: tenantPayload, enabledModules: tenantPayload.enabledModules
  };
}

function buildEmployeeAuthContext(employeeDoc, tenant, userDoc = null) {
  const role = normalizeRoleName(userDoc?.role || employeeDoc?.role || 'employee');
  let permissions = sanitizePermissions(userDoc?.permissions || []);
  if (!permissions || permissions.length === 0) {
    const { getDefaultPerms } = require('../utils/defaultRolePermissions');
    permissions = getDefaultPerms(role);
  }
  const tenantPayload = buildTenantPayload(tenant);
  return {
    authSubject: { id: employeeDoc._id, subjectType: 'employee', email: normalizeEmail(employeeDoc.email), role, tenantId: tenant._id, companyCode: tenant.code || null, companyId: userDoc?.companyId || tenant._id, mainCompanyId: employeeDoc.mainCompanyId || tenant._id, subCompanyId: employeeDoc.subCompanyId || null, branchId: employeeDoc.branchId || null, divisionId: employeeDoc.divisionId || null, departmentId: employeeDoc.departmentId || null, designationId: employeeDoc.designationId || null, groupId: userDoc?.groupId || tenant.groupId || null },
    user: sanitizeUserForClient(employeeDoc, { id: employeeDoc._id, name: `${employeeDoc.firstName || ''} ${employeeDoc.lastName || ''}`.trim() || employeeDoc.name || employeeDoc.email, email: normalizeEmail(employeeDoc.email), role, permissions, companyCode: tenant.code || null, tenantId: tenant._id, companyId: userDoc?.companyId || tenant._id, mainCompanyId: employeeDoc.mainCompanyId || tenant._id, subCompanyId: employeeDoc.subCompanyId || null, branchId: employeeDoc.branchId || null, divisionId: employeeDoc.divisionId || null, departmentId: employeeDoc.departmentId || null, designationId: employeeDoc.designationId || null, groupId: userDoc?.groupId || tenant.groupId || null }),
    company: tenantPayload, enabledModules: tenantPayload.enabledModules
  };
}

function buildCandidateAuthContext(candidateDoc, tenant) {
  const role = 'candidate';
  const tenantPayload = buildTenantPayload(tenant);
  return {
    authSubject: {
      id: candidateDoc._id,
      subjectType: 'candidate',
      email: normalizeEmail(candidateDoc.email),
      role,
      tenantId: tenant._id,
      companyCode: tenant.code || null,
      companyId: tenant._id,
      mainCompanyId: tenant._id
    },
    user: sanitizeUserForClient(candidateDoc, {
      id: candidateDoc._id,
      name: candidateDoc.name || candidateDoc.email,
      email: normalizeEmail(candidateDoc.email),
      role,
      permissions: [],
      companyCode: tenant.code || null,
      tenantId: tenant._id,
      companyId: tenant._id,
      mainCompanyId: tenant._id
    }),
    company: tenantPayload,
    enabledModules: tenantPayload.enabledModules
  };
}

function buildAuthResponse(authContext, token) {
  return { success: true, token: token || authContext.token || null, user: authContext.user, company: authContext.company, enabledModules: authContext.enabledModules };
}

async function findUserPermissionsByEmail(email, tenantId) {
  if (!email || !tenantId) return null;
  return getUserModel().findOne({ 
    email: { $regex: new RegExp(`^${escapeRegex(normalizeEmail(email))}$`, 'i') }, 
    $or: [{ tenant: tenantId }, { mainCompanyId: tenantId }] 
  }).select('permissions role companyId groupId').lean();
}

function isEmployeeDeactivated(employee) {
  if (employee?.status === 'Draft') return false;
  return Boolean(employee?.isActive === false || ['INACTIVE', 'Inactive', 'Exited', 'Deactivated'].includes(employee?.status) || ['INACTIVE', 'Inactive', 'Exited', 'Deactivated'].includes(employee?.employmentStatus));
}

async function resolveActiveTenant(tenantId, companyCode = null) {
  if (tenantId && mongoose.Types.ObjectId.isValid(String(tenantId))) {
    const tenant = await Tenant.findById(tenantId).lean();
    if (tenant) return tenant;
  }
  if (companyCode) {
    const tenant = await Tenant.findOne({ code: { $regex: new RegExp(`^${escapeRegex(companyCode)}$`, 'i') } }).lean();
    if (tenant) return tenant;
  }
  return null;
}

async function resolveAdminAuthContext(email, password, companyCode = null) {
  const norm = normalizeEmail(email);
  const User = getUserModel();
  let adminAccount = null;
  let tenant = null;

  if (companyCode) {
    tenant = await resolveActiveTenant(null, companyCode);
    if (tenant && tenant.status === 'active') {
      adminAccount = await User.findOne({ 
        email: norm, 
        $or: [{ tenant: tenant._id }, { mainCompanyId: tenant._id }],
        role: { $in: ADMIN_ROLES } 
      }).lean();
    }
  }

  if (!adminAccount) {
    adminAccount = await User.findOne({ email: norm, role: { $in: ADMIN_ROLES } }).lean();
    if (adminAccount) {
      tenant = await resolveActiveTenant(adminAccount.tenant || adminAccount.mainCompanyId);
    }
  }

  // Final fallback: check all tenant-specific User collections (for legacy/misplaced users)
  if (!adminAccount) {
    const activeTenants = await Tenant.find({ status: 'active' }).lean();
    for (const t of activeTenants) {
      try {
        const tenantDB = await getTenantDB(t._id);
        const TenantUser = tenantDB.model('User');
        const found = await TenantUser.findOne({ email: norm, role: { $in: ADMIN_ROLES } }).lean();
        if (found && await comparePassword(password, found.password)) {
          adminAccount = found;
          tenant = t;
          break;
        }
      } catch (err) {
        // Skip failed tenant connections
      }
    }
  }

  if (!adminAccount || !tenant || tenant.status !== 'active') {
    console.log('[LOGIN DEBUG] Failed at adminAccount or tenant check:', { hasAdmin: !!adminAccount, hasTenant: !!tenant, tenantStatus: tenant?.status });
    return null;
  }
  if (!await comparePassword(password, adminAccount.password)) {
    console.log('[LOGIN DEBUG] Failed at password check');
    return null;
  }
  console.log('[LOGIN DEBUG] Login successful!');
  return buildAdminAuthContext(adminAccount, tenant);
}

async function resolveEmployeeAuthContext(identifier, password, companyCode = null) {
  const finalIdentifierRaw = String(identifier || '').trim();
  const User = getUserModel();
  let foundEmployee = null;
  let foundTenant = null;
  let passwordFailed = false;

  const normalizedEmail = normalizeEmail(finalIdentifierRaw);
  const escapedIdentifier = escapeRegex(finalIdentifierRaw);
  const escapedEmail = escapeRegex(normalizedEmail);

  if (companyCode) {
    foundTenant = await resolveActiveTenant(null, companyCode);
    if (foundTenant && foundTenant.status === 'active') {
      try {
        const tenantDB = await getTenantDB(foundTenant._id);
        const Employee = tenantDB.model('Employee');
        
        // Search by email, employeeId or employeeCode simultaneously
        const query = {
          $or: [
            { email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } },
            { employeeId: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } },
            { employeeCode: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } }
          ]
        };
        
        foundEmployee = await Employee.findOne(query).lean();
        if (foundEmployee && !await verifyEmployeePortalPassword(foundEmployee, foundTenant, password)) {
          passwordFailed = true; foundEmployee = null; foundTenant = null;
        }
      } catch (_e) {}
    }
  }

  if (!foundEmployee && !passwordFailed) {
    const activeTenants = await Tenant.find({ status: 'active' }).select('_id').lean();
    for (const t of activeTenants) {
      try {
        const tenant = await resolveActiveTenant(t._id);
        const tenantDB = await getTenantDB(tenant._id);
        const Employee = tenantDB.model('Employee');
        const query = {
          $or: [
            { email: { $regex: new RegExp(`^${escapedEmail}$`, 'i') } },
            { employeeId: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } },
            { employeeCode: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } }
          ]
        };
        const employee = await Employee.findOne(query).lean();
        if (employee && await verifyEmployeePortalPassword(employee, tenant, password)) {
          foundEmployee = employee; foundTenant = tenant; break;
        } else if (employee) {
          passwordFailed = true;
        }
      } catch (_e) {}
    }
  }

  if (foundEmployee && foundTenant) {
    if (isEmployeeDeactivated(foundEmployee)) return { error: 'account_deactivated' };
    const userDoc = await findUserPermissionsByEmail(foundEmployee.email, foundTenant._id);
    return buildEmployeeAuthContext(foundEmployee, foundTenant, userDoc);
  }

  if (passwordFailed) return { error: 'invalid_password' };
  return { error: 'invalid_email' };
}

async function resolveUnifiedAuthContext(identifier, password, companyCode = null) {
  const normalizedIdentifier = String(identifier || '').trim();
  if (normalizedIdentifier.includes('@')) {
    const psaConfig = getSuperAdminConfig();
    if (normalizeEmail(normalizedIdentifier) === psaConfig.email && await verifySuperAdminPassword(password)) return buildPsaAuthContext();
    
    const User = getUserModel();
    const dbPsa = await User.findOne({ email: normalizeEmail(normalizedIdentifier), role: { $in: ['psa', 'super_admin'] } }).lean();
    if (dbPsa && await comparePassword(password, dbPsa.password)) {
      return buildPsaAuthContextFromDb(dbPsa);
    }
  }
  const adminContext = normalizedIdentifier.includes('@') ? await resolveAdminAuthContext(normalizedIdentifier, password, companyCode) : null;
  if (adminContext) return adminContext;
  return resolveEmployeeAuthContext(normalizedIdentifier, password, companyCode);
}

async function resolveContextFromRefreshClaims(claims) {
  if (claims.subjectType === 'psa') {
    if (claims.sub !== 'psa_admin') {
      const User = getUserModel();
      const dbPsa = await User.findById(claims.sub).lean();
      if (dbPsa && ['psa', 'super_admin'].includes(dbPsa.role)) return buildPsaAuthContextFromDb(dbPsa);
    }
    return buildPsaAuthContext();
  }
  if (claims.subjectType === 'user') {
    const User = getUserModel();
    let userDoc = await User.findById(claims.sub).lean();
    if (!userDoc && claims.email) userDoc = await User.findOne({ email: normalizeEmail(claims.email), role: { $in: ADMIN_ROLES } }).lean();
    if (!userDoc) return null;
    const tenant = await resolveActiveTenant(userDoc.tenant || userDoc.mainCompanyId, claims.companyCode);
    if (!tenant || tenant.status !== 'active') return null;
    return buildAdminAuthContext(userDoc, tenant);
  }
  const tenant = await resolveActiveTenant(claims.tenantId, claims.companyCode);
  if (!tenant || tenant.status !== 'active') return null;
  try {
    const tenantDB = await getTenantDB(tenant._id);
    const Employee = tenantDB.model('Employee');
    let employee = await Employee.findById(claims.sub).lean();
    if (!employee && claims.email) employee = await Employee.findOne({ email: normalizeEmail(claims.email) }).lean();
    if (!employee || isEmployeeDeactivated(employee)) return null;
    const userDoc = await findUserPermissionsByEmail(employee.email, tenant._id);
    return buildEmployeeAuthContext(employee, tenant, userDoc);
  } catch (_e) { return null; }
}

async function finishLogin(req, res, authContext) {
  const token = await createRefreshSession(req, res, authContext.authSubject);
  return res.json(buildAuthResponse(authContext, token));
}

exports.loginHrController = async (req, res) => {
  try {
    const { email, companyCode } = req.body;
    const password = String(req.body.password || '').trim();
    const authContext = await resolveUnifiedAuthContext(email, password, companyCode);
    if (!authContext) return res.status(401).json({ success: false, message: 'invalid_credentials' });
    if (authContext.error) return res.status(401).json({ success: false, message: authContext.error });
    return finishLogin(req, res, authContext);
  } catch (err) { return res.status(500).json({ success: false, message: 'server_error' }); }
};

exports.loginEmployeeController = async (req, res) => {
  try {
    const identifier = String(req.body.identifier || req.body.email || '').trim();
    const password = String(req.body.password || '').trim();
    const authContext = await resolveEmployeeAuthContext(identifier, password, req.body.companyCode);
    if (!authContext || authContext.error) return res.status(401).json({ success: false, message: authContext?.error || 'invalid_credentials' });
    return finishLogin(req, res, authContext);
  } catch (err) { return res.status(500).json({ success: false, message: 'server_error' }); }
};

exports.unifiedLogin = async (req, res) => {
  try {
    const { identifier, companyCode } = req.body;
    const password = String(req.body.password || '').trim();
    const authContext = await resolveUnifiedAuthContext(identifier, password, companyCode);
    if (!authContext || authContext.error) return res.status(401).json({ success: false, message: authContext?.error || 'invalid_credentials' });
    return finishLogin(req, res, authContext);
  } catch (err) {
    console.error('DEBUG UNIFIED LOGIN ERROR:', err);
    return res.status(500).json({ success: false, message: 'server_error' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const payload = req.user || {};
    const userId = payload.id;
    const subjectType = payload.subjectType || 'user';
    const role = String(payload.role || '').toLowerCase();

    if (role === 'candidate') {
      const tenantId = payload.tenantId || req.tenantId;
      const tenant = await resolveActiveTenant(tenantId);
      if (!tenant) return res.status(404).json({ success: false, message: 'tenant_not_found' });
      const tenantDB = await getTenantDB(tenant._id);
      const Candidate = tenantDB.model('Candidate');
      const candidate = await Candidate.findById(userId).select('-password').lean();
      if (!candidate) return res.status(404).json({ success: false, message: 'candidate_not_found' });
      return res.json(buildAuthResponse(buildCandidateAuthContext(candidate, tenant)));
    }

    if (subjectType === 'psa' || role === 'psa') {
      return res.json(buildAuthResponse(buildPsaAuthContext()));
    }

    if (subjectType === 'user') {
      const User = getUserModel();
      let userDoc = await User.findById(userId).lean();
      if (!userDoc && payload.email) {
        userDoc = await User.findOne({ 
          email: { $regex: new RegExp(`^${escapeRegex(normalizeEmail(payload.email))}$`, 'i') } 
        }).lean();
      }
      if (userDoc) {
        const tenant = await resolveActiveTenant(userDoc.tenant || userDoc.mainCompanyId);
        return res.json(buildAuthResponse(buildAdminAuthContext(userDoc, tenant)));
      }
      // If subjectType was 'user' but no user found, fall through to employee check
    }

    const tenantId = payload.tenantId || req.tenantId;
    const tenant = await resolveActiveTenant(tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'tenant_not_found' });

    const tenantDB = await getTenantDB(tenant._id);
    const Employee = tenantDB.model('Employee');
    const employee = await Employee.findById(userId).select('-password').lean();
    if (!employee) return res.status(404).json({ success: false, message: 'user_not_found' });

    const userDoc = await findUserPermissionsByEmail(employee.email, tenant._id);
    return res.json(buildAuthResponse(buildEmployeeAuthContext(employee, tenant, userDoc)));
  } catch (err) {
    console.error('[auth.controller.getMe] Error:', err);
    return res.status(500).json({ success: false, message: 'server_error' });
  }
};

exports.getSsoMe = async (req, res) => {
  try {
    const payload = req.user || {};
    const userId = String(payload.id || payload.sub || payload._id || '').trim();
    const tenantId = String(payload.tenantId || req.tenantId || '').trim();
    
    let companyPayload = null;
    let enabledModules = {};
    if (tenantId) {
      const tenant = await resolveActiveTenant(tenantId);
      if (tenant) {
        companyPayload = buildTenantPayload(tenant);
        enabledModules = companyPayload.enabledModules || {};
      }
    } else if (payload.subjectType === 'psa' || String(payload.role || '').toLowerCase() === 'psa') {
       enabledModules = buildPsaEnabledModules();
    }

    const permissionBundle = await resolveUserPermissionBundle({ 
      userId, 
      tenantId, 
      tenantDB: req.tenantDB,
      email: payload.email 
    });
    
    let finalUserId = userId;
    if (permissionBundle?.userDoc?._id) {
      finalUserId = String(permissionBundle.userDoc._id);
    }

    return res.json({ 
      success: true, 
      user: { 
        ...payload, 
        id: finalUserId, 
        _id: finalUserId,
        permissions: permissionBundle.permissions 
      },
      company: companyPayload,
      enabledModules: enabledModules
    });
  } catch (err) { return res.status(500).json({ success: false, message: 'server_error' }); }
};

exports.refreshTokenController = async (req, res) => {
  const refreshTokenValue = req.cookies?.refreshToken;
  if (!refreshTokenValue) { clearAuthCookies(req, res); return res.status(401).json({ success: false, message: 'no_refresh_token' }); }
  try {
    const payload = verifyRefreshToken(refreshTokenValue);
    const storedToken = await RefreshToken.findOne({ tokenHash: hashToken(refreshTokenValue), revokedAt: null }).lean();
    if (!storedToken) { clearAuthCookies(req, res); return res.status(401).json({ success: false, message: 'invalid_token' }); }
    const authContext = await resolveContextFromRefreshClaims(payload);
    if (!authContext) { clearAuthCookies(req, res); return res.status(401).json({ success: false, message: 'subject_not_found' }); }
    const nextAccessToken = await createRefreshSession(req, res, authContext.authSubject);
    await revokeRefreshToken(refreshTokenValue, 'rotated');
    return res.json({ success: true });
  } catch (err) { clearAuthCookies(req, res); return res.status(401).json({ success: false, message: 'invalid_token' }); }
};

exports.logoutController = async (req, res) => {
  try { if (req.cookies?.refreshToken) await revokeRefreshToken(req.cookies.refreshToken, 'logout'); } catch (_e) {}
  clearAuthCookies(req, res);
  return res.json({ success: true });
};

exports.requestEmployeeOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || req.body?.identifier || '');
    if (!email || !email.includes('@')) return res.status(400).json({ success: false, message: 'email_required' });

    const found = await findActiveEmployeeByEmailForOtp(email);
    if (!found) return res.json({ success: true, message: 'otp_sent_if_registered' });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const exp = Date.now() + 10 * 60 * 1000;
    employeeOtpEntries.set(email, { otp, exp, tenantId: String(found.tenant._id), attempts: 0 });

    try {
      if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        await sendMail({
          to: email,
          subject: 'Your HRMS login code',
          text: `Your verification code is: ${otp}\n\nIt expires in 10 minutes.`,
        });
      }
    } catch (e) {
      console.error('[EMPLOYEE_OTP] send failed:', e);
    }

    const body = { success: true, message: 'otp_sent_if_registered' };
    if (!isProduction()) body.debugOtp = otp;
    return res.json(body);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'server_error' });
  }
};

exports.verifyEmployeeOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email || req.body?.identifier || '');
    const { otp } = req.body;
    if (!email || !otp) return res.status(400).json({ success: false, message: 'invalid_request' });

    const entry = employeeOtpEntries.get(email);
    if (!entry || entry.otp !== String(otp) || entry.exp < Date.now()) {
      return res.status(401).json({ success: false, message: 'invalid_otp' });
    }

    const tenant = await resolveActiveTenant(entry.tenantId);
    if (!tenant) return res.status(404).json({ success: false, message: 'tenant_not_found' });

    const tenantDB = await getTenantDB(tenant._id);
    const Employee = tenantDB.model('Employee');
    const employee = await Employee.findOne({ email }).lean();
    if (!employee || isEmployeeDeactivated(employee)) return res.status(404).json({ success: false, message: 'user_not_found' });

    employeeOtpEntries.delete(email);
    const userDoc = await findUserPermissionsByEmail(employee.email, tenant._id);
    const authContext = buildEmployeeAuthContext(employee, tenant, userDoc);
    return finishLogin(req, res, authContext);
  } catch (error) {
    return res.status(500).json({ success: false, message: 'server_error' });
  }
};

exports.getMyPermissions = async (req, res) => {
  try {
    const userId = req.user?.id;
    const tenantId = req.user?.tenantId || req.tenantId;
    if (!userId || !tenantId) return res.status(401).json({ success: false, message: 'unauthorized' });

    const userDoc = await findUserPermissionsByEmail(req.user.email, tenantId);
    let permissions = sanitizePermissions(userDoc?.permissions || []);
    if (!permissions || permissions.length === 0) {
       const { getDefaultPerms } = require('../utils/defaultRolePermissions');
       permissions = getDefaultPerms(req.user.role || 'employee');
    }
    
    return res.json({
      success: true,
      permissions: permissions,
      role: req.user.role
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'server_error' });
  }
};

exports.verifyPsaPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const isOk = await verifySuperAdminPassword(password);
    if (!isOk) {
      return res.status(401).json({ success: false, message: 'invalid_password' });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'server_error' });
  }
};
