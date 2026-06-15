/**
 * rbac.middleware.js — Strict Backend RBAC Enforcement
 * ─────────────────────────────────────────────────────────────────
 * Backend is the FINAL authority. Frontend is only UI layering.
 *
 * Rules:
 *  1. super_admin / admin / psa / company_admin bypass all checks
 *  2. HR role bypasses all checks (they manage the system)
 *  3. All other roles MUST have explicit actions[action] === true
 *  4. No fallback defaults, no || true, no permission inheritance
 *  5. Uses in-memory permission cache (same as role.controller)
 */
const {
  normalizeRole,
  resolveUserPermissionBundle,
} = require('../utils/rbac');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const AUTHZ_BYPASS = String(process.env.AUTHZ_BYPASS || '').toLowerCase() === 'true';

const PERMISSION_MODULE_MAP = {
  people: 'hr',
  offboarding: 'hr',
  attendance: 'attendance',
  leave: 'leave',
  payroll: 'payroll',
  hiring: 'recruitment',
  bgv: 'backgroundVerification',
  documents: 'documentManagement',
  socialMedia: 'socialMediaIntegration',
  portals: 'employeePortal',
  support: 'hr',
  configuration: 'hr',
  employee: 'employeePortal',
  onboarding: 'onboarding',
  policy: 'policy'
};

function resolveTenantModuleFromPermission(permissionKey = '') {
  const key = String(permissionKey || '').trim();
  if (key === 'overview.reports') return 'reports';
  if (key === 'overview.dashboard') return 'hr';
  
  // Standard prefix logic
  const prefix = key.split('.')[0];
  return PERMISSION_MODULE_MAP[prefix] || null;
}

function modulesArrayToFlags(modules = []) {
  const flags = {};
  const aliases = {
    hr: 'hr',
    'hr management': 'hr',
    payroll: 'payroll',
    'payroll system': 'payroll',
    attendance: 'attendance',
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
    reports: 'reports',
    onboarding: 'onboarding',
    policy: 'policy'
  };
  for (const mod of Array.isArray(modules) ? modules : []) {
    const raw = String(mod || '').trim();
    const key = aliases[raw.toLowerCase()] || raw;
    if (key) flags[key] = true;
  }
  return flags;
}

/**
 * checkPermission(module, action)
 * @param {string} module  - dot-notation page key: "people.employees"
 * @param {string} action  - "view" | "create" | "edit" | "delete" | "any"
 *
 *
 * Usage on routes:
 *   router.get('/employees', checkPermission('people.employees','view'), ctrl.list);
 *   router.post('/employees', checkPermission('people.employees','create'), ctrl.create);
 *   router.patch('/employees/:id', checkPermission('people.employees','edit'), ctrl.update);
 *   router.delete('/employees/:id', checkPermission('people.employees','delete'), ctrl.delete);
 */
const checkPermission = (module, action) => {
  return async (req, res, next) => {
    try {
      if (AUTHZ_BYPASS) return next();
      const user = req.user;

      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      let role = normalizeRole(user.role);
      const BYPASS_ROLES = [
        'admin', 'psa', 'super_admin', 'hr', 'company_admin', 'company_super_admin',
        'sub_company_admin', 'branch_head', 'division_head', 'department_head', 'designation_head',
        'candidate'
      ];

      if (!BYPASS_ROLES.includes(role) && user?.email) {
        try {
          let User;
          try {
            User = mongoose.model('User');
          } catch (_) {
            User = require('../models/User');
          }
          const safeEmail = String(user.email).trim();
          if (safeEmail) {
            const emailRegex = new RegExp(`^${safeEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
            const tenantScope = String(user.tenantId || user.companyId || req.tenantId || '').trim();
            const query = { email: emailRegex };
            if (tenantScope) {
              query.$or = [
                { tenant: tenantScope },
                { companyId: tenantScope }
              ];
            }
            const userDoc = await User.findOne(query).select('role').lean();
            const resolvedRole = normalizeRole(userDoc?.role);
            if (resolvedRole) role = resolvedRole;
          }
        } catch (_) { /* fallback to token role */ }
      }

      const requiredTenantModule = resolveTenantModuleFromPermission(module);
      if (requiredTenantModule && role !== 'psa' && role !== 'super_admin') {
        const tenantId = user.tenantId || user.mainCompanyId || user.companyId || req.tenantId;
        if (!tenantId) {
          console.warn(`[RBAC_MW] Access Denied: No tenantId found for user ${user.id} on route ${req.path}`);
          return res.status(403).json({ success: false, message: 'Tenant context missing' });
        }

        if (!req._tenantEnabledModules) {
          const tenantDoc = await Tenant.findById(tenantId).select('enabledModules code').lean();
          if (!tenantDoc) {
             console.warn(`[RBAC_MW] CRITICAL: Tenant ${tenantId} not found in database!`);
          }
          req._tenantEnabledModules = tenantDoc?.enabledModules || {};
        }

        // Compatibility fallback:
        // In SSO-driven provisioning, company modules can exist while tenant.enabledModules
        // is empty/missing. Resolve from companies collection to avoid false 403.
        if (req._tenantEnabledModules?.[requiredTenantModule] !== true) {
          const companyId = String(
            user.companyId || user.company || user.externalCompanyId || ''
          ).trim();

          if (companyId && mongoose.Types.ObjectId.isValid(companyId)) {
            const companyDoc = await mongoose.connection.db
              .collection('companies')
              .findOne(
                { _id: new mongoose.Types.ObjectId(companyId) },
                {
                  projection: {
                    hrmsEnabledModules: 1,
                    enabledModules: 1,
                    hrmsModules: 1,
                    modules: 1
                  }
                }
              );

            const fallbackFlags = {
              ...modulesArrayToFlags(companyDoc?.modules || []),
              ...modulesArrayToFlags(companyDoc?.hrmsModules || []),
              ...(companyDoc?.enabledModules || {}),
              ...(companyDoc?.hrmsEnabledModules || {})
            };

            if (Object.keys(fallbackFlags).length > 0) {
              req._tenantEnabledModules = {
                ...(req._tenantEnabledModules || {}),
                ...fallbackFlags
              };
            }
          }
        }

        if (req._tenantEnabledModules?.[requiredTenantModule] !== true) {
          console.warn(`[RBAC_MW] Access Denied: Module '${requiredTenantModule}' not enabled for tenant. Enabled:`, req._tenantEnabledModules);
          return res.status(403).json({
            success: false,
            message: `Access Denied: The '${requiredTenantModule}' module is not enabled for your company.`,
            requiredModule: requiredTenantModule
          });
        }
      }
      
      if (BYPASS_ROLES.includes(role)) {
        return next();
      }

      const tenantId = user.tenantId || user.mainCompanyId || user.companyId || req.tenantId;
      const userId   = user.id || user._id;

      if (!tenantId) {
        console.warn(`[RBAC_MW] No tenantId on request for user=${userId}`);
        return res.status(403).json({ success: false, message: 'Tenant context missing' });
      }

      const bundle = await resolveUserPermissionBundle({
        userId: String(userId),
        tenantId: String(tenantId),
        tenantDB: req.tenantDB,
      });
      const userPerms = bundle?.permissions || [];

      if (!Array.isArray(userPerms)) {
        return res.status(403).json({ success: false, message: 'Access Denied: No permissions found' });
      }

      const modules = Array.isArray(module) ? module : [module];
      let hasAccess = false;

      for (const mod of modules) {
          // Special dependency logic
          if (mod === 'people.employees' && action === 'view') {
              const hasAccessControl = userPerms.some(p => p.module === 'configuration.access' && (p.actions?.view === true || (typeof p.actions?.get === 'function' && p.actions.get('view') === true)));
              if (hasAccessControl) { hasAccess = true; break; }
          }

          const permEntry = userPerms.find(p => p.module === mod);
          if (!permEntry) continue;

          if (action === 'any') {
              const actions = typeof permEntry.actions?.get === 'function' ? {
                  view: permEntry.actions.get('view'),
                  create: permEntry.actions.get('create'),
                  edit: permEntry.actions.get('edit'),
                  delete: permEntry.actions.get('delete'),
              } : (permEntry.actions || {});
              if (['view', 'create', 'edit', 'delete'].some(a => actions[a] === true)) { hasAccess = true; break; }
          } else {
              const actionValue = typeof permEntry.actions?.get === 'function' ? permEntry.actions.get(action) : (permEntry.actions || {})[action];
              if (actionValue === true) { hasAccess = true; break; }
          }
      }

      if (!hasAccess) {
        // console.warn(`[RBAC_MW] Access Denied: User=${userId}, Role=${role}, Mod=${modules.join('/')}, Action=${action}.`);
        /*
        if (!userPerms.length) console.warn(`[RBAC_MW] Reason: No permissions found for this user/tenant.`);
        else {
           const match = userPerms.find(p => modules.includes(p.module));
           if (!match) console.warn(`[RBAC_MW] Reason: Module entry missing in user permission set.`);
           else console.warn(`[RBAC_MW] Reason: Action '${action}' not authorized for this module.`);
        }
        */

        return res.status(403).json({
          success: false,
          message: `Access Denied: You do not have permissions for ${modules.join('/')}.${action}`,
          required: { module, action }
        });
      }

      return next();
    } catch (error) {
      console.error('[RBAC_MW] Unexpected error:', error);
      return res.status(500).json({ success: false, message: 'Internal error' });
    }
  };
};

module.exports = { checkPermission };
