const authJwt = require('./auth.jwt');

const ROLE_ALIASES = {
  psa: 'SUPER_ADMIN',
  superadmin: 'SUPER_ADMIN',
  super_admin: 'SUPER_ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN',
  admin: 'MAIN_COMPANY_ADMIN',
  hr: 'MAIN_COMPANY_ADMIN',
  hr_admin: 'MAIN_COMPANY_ADMIN',
  hr_manager: 'MAIN_COMPANY_ADMIN',
  company_admin: 'MAIN_COMPANY_ADMIN',
  company_super_admin: 'MAIN_COMPANY_ADMIN',
  main_company_admin: 'MAIN_COMPANY_ADMIN',
  MAIN_COMPANY_ADMIN: 'MAIN_COMPANY_ADMIN',
  sub_company_admin: 'SUB_COMPANY_ADMIN',
  SUB_COMPANY_ADMIN: 'SUB_COMPANY_ADMIN',
  branch_head: 'BRANCH_HEAD',
  BRANCH_HEAD: 'BRANCH_HEAD',
  division_head: 'DIVISION_HEAD',
  DIVISION_HEAD: 'DIVISION_HEAD',
  department_head: 'DEPARTMENT_HEAD',
  DEPARTMENT_HEAD: 'DEPARTMENT_HEAD',
  employee: 'EMPLOYEE',
  manager: 'EMPLOYEE',
  EMPLOYEE: 'EMPLOYEE'
};

function normalizeHierarchyRole(role) {
  const raw = String(role || '').trim();
  return ROLE_ALIASES[raw] || ROLE_ALIASES[raw.toLowerCase().replace(/[\s-]+/g, '_')] || raw.toUpperCase();
}

function getMainCompanyId(req) {
  return req.user?.mainCompanyId || req.user?.tenantId || req.user?.companyId || req.tenantId;
}

function sameId(a, b) {
  if (!a || !b) return false;
  return String(a) === String(b);
}

function successFilterForRole(req) {
  const role = normalizeHierarchyRole(req.user?.role);
  const mainCompanyId = getMainCompanyId(req);
  const userId = req.user?.userId || req.user?.id || req.user?._id;

  if (role === 'SUPER_ADMIN') return { isDeleted: { $ne: true } };
  if (!mainCompanyId) {
    const error = new Error('Invalid Scope: Main Company context missing.');
    error.status = 403;
    throw error;
  }

  const filter = { 
    isDeleted: { $ne: true },
    $or: [
      { mainCompanyId: mainCompanyId },
      { tenant: mainCompanyId }
    ]
  };
  if (role === 'MAIN_COMPANY_ADMIN') return filter;

  if (['SUB_COMPANY_ADMIN', 'BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'].includes(role)) {
    if (!req.user.subCompanyId) {
      const error = new Error('Invalid Scope: Sub Company context missing.');
      error.status = 403;
      throw error;
    }
    filter.subCompanyId = req.user.subCompanyId;
  }

  if (['BRANCH_HEAD', 'DIVISION_HEAD', 'DEPARTMENT_HEAD'].includes(role)) {
    if (!req.user.branchId) {
      const error = new Error('Invalid Scope: Branch context missing.');
      error.status = 403;
      throw error;
    }
    filter.branchId = req.user.branchId;
  }

  if (['DIVISION_HEAD', 'DEPARTMENT_HEAD'].includes(role)) {
    if (!req.user.divisionId) {
      const error = new Error('Invalid Scope: Division context missing.');
      error.status = 403;
      throw error;
    }
    filter.divisionId = req.user.divisionId;
  }

  if (role === 'DEPARTMENT_HEAD') {
    if (!req.user.departmentId) {
      const error = new Error('Invalid Scope: Department context missing.');
      error.status = 403;
      throw error;
    }
    filter.departmentId = req.user.departmentId;
  }

  if (role === 'EMPLOYEE') {
    return { _id: userId, isDeleted: { $ne: true } };
  }

  return filter;
}

exports.verifyToken = authJwt.authenticate;
exports.normalizeHierarchyRole = normalizeHierarchyRole;
exports.getMainCompanyId = getMainCompanyId;

exports.authorizeRoles = (...allowedRoles) => {
  const allowed = allowedRoles.flat().map(normalizeHierarchyRole);
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized', statusCode: 401 });
    const role = normalizeHierarchyRole(req.user.role);
    if (role === 'SUPER_ADMIN') return next();
    if (!allowed.includes(role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Role ${role} does not have access to this resource.`,
        statusCode: 403
      });
    }
    next();
  };
};

exports.roleMiddleware = (allowedRoles) => exports.authorizeRoles(allowedRoles);

exports.filterByScope = (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized', statusCode: 401 });
    req.user.hierarchyRole = normalizeHierarchyRole(req.user.role);
    req.user.mainCompanyId = getMainCompanyId(req);
    req.hierarchyFilter = successFilterForRole(req);
    next();
  } catch (err) {
    return res.status(err.status || 500).json({
      success: false,
      message: err.message || 'Scope validation failed',
      statusCode: err.status || 500
    });
  }
};

exports.checkCompanyScope = exports.filterByScope;

exports.hierarchyValidationMiddleware = (req, res, next) => {
  const role = normalizeHierarchyRole(req.user?.role);
  if (role === 'SUPER_ADMIN') return next();

  const body = req.body || {};
  const scopedValues = {
    mainCompanyId: getMainCompanyId(req),
    subCompanyId: req.user?.subCompanyId,
    branchId: req.user?.branchId,
    divisionId: req.user?.divisionId,
    departmentId: req.user?.departmentId
  };

  for (const [key, value] of Object.entries(scopedValues)) {
    if (body[key] && value && !sameId(body[key], value)) {
      return res.status(403).json({
        success: false,
        message: `Hierarchy Violation: Cannot access or assign ${key} outside of your scope.`,
        statusCode: 403
      });
    }
    if (!body[key] && value) body[key] = value;
  }

  next();
};
