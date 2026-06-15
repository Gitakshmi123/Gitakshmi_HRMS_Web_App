const { sanitizePermissions } = require('./defaultRolePermissions');

function toPlainObject(value) {
  if (!value) return null;
  if (typeof value.toObject === 'function') return value.toObject();
  return { ...value };
}

function asId(value) {
  if (!value) return null;
  return String(value);
}

function sanitizeEnabledModules(enabledModules = {}) {
  return {
    hr: Boolean(enabledModules.hr),
    payroll: Boolean(enabledModules.payroll),
    attendance: Boolean(enabledModules.attendance),
    leave: Boolean(enabledModules.leave),
    recruitment: Boolean(enabledModules.recruitment),
    backgroundVerification: Boolean(enabledModules.backgroundVerification),
    documentManagement: Boolean(enabledModules.documentManagement),
    socialMediaIntegration: Boolean(enabledModules.socialMediaIntegration),
    employeePortal: Boolean(enabledModules.employeePortal),
    reports: Boolean(enabledModules.reports),
    onboarding: Boolean(enabledModules.onboarding),
    policy: Boolean(enabledModules.policy),
  };
}

function sanitizeTenantForClient(tenant, extras = {}) {
  const source = toPlainObject(tenant) || {};

  return {
    id: asId(source._id || source.id),
    companyName: source.companyName || source.name || null,
    name: source.name || source.companyName || null,
    code: source.code || null,
    ownerName: source.ownerName || null,
    adminName: source.adminName || null,
    adminEmail: source.adminEmail || source.companyEmail || null,
    companyEmail: source.companyEmail || source.adminEmail || null,
    logo: source.logo || null,
    emailDomain: source.emailDomain || null,
    plan: source.plan || null,
    status: source.status || null,
    modules: Array.isArray(extras.modules) ? extras.modules : [],
    moduleKeys: Array.isArray(extras.moduleKeys) ? extras.moduleKeys : [],
    enabledModules: sanitizeEnabledModules(
      extras.enabledModules || source.enabledModules || {}
    ),
  };
}

function sanitizeUserForClient(user, overrides = {}) {
  const source = toPlainObject(user) || {};
  const resolvedRole = String(
    overrides.role || source.role?.name || source.role || 'employee'
  ).toLowerCase();
  const permissions = sanitizePermissions(
    overrides.permissions || source.permissions || []
  );

  return {
    id: asId(overrides.id || source._id || source.id),
    name: (() => {
      const n = (overrides.name || source.name || `${source.firstName || ''} ${source.lastName || ''}`.trim());
      const isGeneric = !n || ['user', 'admin', 'employee', 'super admin', 'superadmin', 'undefined', 'null'].includes(n.toLowerCase());
      if (!isGeneric) return n;
      return source.email || n || 'Employee';
    })(),
    email: overrides.email || source.email || null,
    role: resolvedRole,
    roleName: resolvedRole,
    permissions,
    companyCode: overrides.companyCode || source.companyCode || null,
    tenantId: asId(overrides.tenantId || source.tenantId || source.tenant),
    companyId: asId(overrides.companyId || source.companyId),
    groupId: asId(overrides.groupId || source.groupId),
    employeeId: overrides.employeeId || source.employeeId || null,
    profilePic: overrides.profilePic || source.profilePic || null,
  };
}

module.exports = {
  asId,
  sanitizeEnabledModules,
  sanitizeTenantForClient,
  sanitizeUserForClient,
  toPlainObject,
};
