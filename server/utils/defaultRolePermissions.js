/**
 * defaultRolePermissions.js
 * ──────────────────────────────────────────────────────────────────
 * Default permission templates for each system role.
 * Applied when:
 *   - New employee User is auto-created (no explicit permissions set)
 *   - Employee has no permissions and admin wants to apply defaults
 *   - GET /roles/defaults API is called by frontend
 *
 * Format matches AccessControl page keys exactly (dot-notation).
 */

const ALL_PAGES = [
  // emp service
  'employee.dashboard', 'employee.attendance', 'employee.payslips', 
  'employee.documents', 'employee.jobs', 'employee.tickets', 'employee.exit',

  // HR Modules
  'overview.dashboard', 
  'reports.staffing', 'reports.movements', 'reports.trends', 'reports.performance',
  'people.employees', 'people.departments', 'people.org', 'people.users',
  'offboarding.exit',
  'attendance.dashboard', 'attendance.calendar', 'attendance.face',
  'leave.requests', 'leave.policies',
  'payroll.stats', 'payroll.salary', 'payroll.compensation',
  'payroll.process', 'payroll.run', 'payroll.payslips',
  'hiring.jobList', 'hiring.createReq', 'hiring.external', 'hiring.internal',
  'hiring.tracker', 'hiring.positions', 'hiring.offerTemplates',
  'bgv.caseMaster', 'bgv.emailLogs',
  'documents.dashboard', 'documents.templates', 'documents.settings', 'documents.issue',
  'configuration.access', 'configuration.company', 'configuration.sequences',
  'approval.view', 'approval.approve', 'approval.workflow.manage',
  // Social Media — granular per-tab keys (replaces obsolete 'socialMedia.management')
  'socialMedia.dashboard', 'socialMedia.accounts', 'socialMedia.create', 'socialMedia.history',
  'portals.careerPage', 'portals.applyPage', 'portals.publicPage',
  'support.tickets',
  'onboarding.dashboard', 'onboarding.templates', 'onboarding.instances',
  'onboarding.tasks', 'onboarding.documents', 'onboarding.employeePortal',
];

const ACTION_KEYS = ['view', 'create', 'edit', 'delete'];

/** Build an actions object with all given actions = true, rest false */
function actions(enabled = []) {
  return Object.fromEntries(ACTION_KEYS.map(a => [a, enabled.includes(a)]));
}

/** Build a full permissions array from a page→actions map */
function buildPerms(pageActionMap) {
  return ALL_PAGES.map(page => ({
    module:  page,
    actions: pageActionMap[page] || actions([]),  // default: no access
  }));
}

/* ─── Role definitions ───────────────────────────────────────── */

/**
 * super_admin: full access to everything
 */
const SUPER_ADMIN_PERMS = buildPerms(
  Object.fromEntries(ALL_PAGES.map(p => [p, actions(['view', 'create', 'edit', 'delete'])]))
);

/**
 * hr: can view and manage most things
 */
const HR_PERMS = buildPerms({
  'overview.dashboard':    actions(['view']),
  'reports.staffing':      actions(['view']),
  'reports.movements':     actions(['view']),
  'reports.trends':        actions(['view']),
  'reports.performance':   actions(['view']),
  'people.employees':      actions(['view', 'create', 'edit']),
  'people.departments':    actions(['view', 'create', 'edit']),
  'people.org':            actions(['view']),
  'people.users':          actions(['view', 'create', 'edit']),
  'offboarding.exit':      actions(['view', 'create', 'edit']),
  'attendance.dashboard':  actions(['view', 'create', 'edit']),
  'attendance.calendar':   actions(['view', 'create', 'edit']),
  'attendance.face':       actions(['view', 'edit']),
  'leave.requests':        actions(['view', 'create', 'edit']),
  'leave.policies':        actions(['view', 'create', 'edit']),
  'payroll.stats':         actions(['view']),
  'payroll.salary':        actions(['view', 'create', 'edit']),
  'payroll.compensation':  actions(['view', 'create', 'edit']),
  'payroll.process':       actions(['view', 'create']),
  'payroll.run':           actions(['view', 'create']),
  'payroll.payslips':      actions(['view']),
  'hiring.jobList':        actions(['view', 'create', 'edit']),
  'hiring.createReq':      actions(['view', 'create', 'edit']),
  'hiring.external':       actions(['view', 'create', 'edit']),
  'hiring.internal':       actions(['view']),
  'hiring.tracker':        actions(['view', 'edit']),
  'hiring.positions':      actions(['view', 'create', 'edit']),
  'hiring.offerTemplates': actions(['view', 'create', 'edit']),
  'bgv.caseMaster':        actions(['view', 'create']),
  'bgv.emailLogs':         actions(['view']),
  'documents.dashboard':   actions(['view', 'create', 'edit']),
  'documents.templates':   actions(['view', 'create', 'edit']),
  'documents.settings':    actions(['view', 'edit']),
  'documents.issue':       actions(['view', 'create']),
  'support.tickets':       actions(['view', 'create', 'edit']),
  'socialMedia.dashboard':   actions(['view', 'create', 'edit']),
  'socialMedia.accounts':    actions(['view', 'create', 'edit']),
  'socialMedia.create':      actions(['view', 'create', 'edit']),
  'socialMedia.history':     actions(['view', 'create', 'edit']),
  'configuration.access':    actions(['view', 'create', 'edit', 'delete']),
  'configuration.company':   actions(['view', 'edit']),
  'configuration.sequences': actions(['view', 'edit']),
  'approval.view':           actions(['view']),
  'approval.approve':        actions(['view', 'edit']),
  'approval.workflow.manage': actions(['view', 'create', 'edit', 'delete']),
  'portals.careerPage':    actions(['view', 'create', 'edit']),
  'portals.applyPage':     actions(['view', 'create', 'edit']),
  'portals.publicPage':    actions(['view']),
  'employee.dashboard':    actions(['view']),
  'employee.attendance':   actions(['view']),
  'employee.payslips':     actions(['view']),
  'employee.documents':    actions(['view']),
  'employee.jobs':         actions(['view']),
  'employee.tickets':      actions(['view', 'create']),
  'employee.exit':         actions(['view', 'create']),
  'onboarding.dashboard':  actions(['view']),
  'onboarding.templates':  actions(['view', 'create', 'edit']),
  'onboarding.instances':  actions(['view', 'create', 'edit']),
  'onboarding.tasks':      actions(['view', 'create', 'edit']),
  'onboarding.documents':  actions(['view', 'create', 'edit']),
  'onboarding.employeePortal': actions(['view', 'edit']),
});

/**
 * employee: minimal — own data only + core ESS pages
 */
const EMPLOYEE_PERMS = buildPerms({
  'employee.dashboard':   actions(['view', 'create', 'edit', 'delete']),
  'employee.attendance':  actions(['view', 'create', 'edit', 'delete']),
  'employee.payslips':    actions(['view', 'create', 'edit', 'delete']),
  'employee.documents':   actions(['view', 'create', 'edit', 'delete']),
  'employee.jobs':        actions(['view', 'create', 'edit', 'delete']),
  'employee.tickets':     actions(['view', 'create', 'edit', 'delete']),
  'employee.exit':        actions(['view', 'create', 'edit', 'delete']),
  'employee.manpowerRequisition': actions(['view', 'create', 'edit', 'delete']),
  'overview.dashboard':   actions(['view']), // basic view only
  'onboarding.dashboard': actions(['view']),
  'onboarding.tasks': actions(['view', 'edit']),
  'onboarding.documents': actions(['view', 'create']),
  'onboarding.employeePortal': actions(['view', 'edit']),
});

/**
 * manager: employee + team management
 */
const MANAGER_PERMS = buildPerms({
  'employee.dashboard':   actions(['view', 'create', 'edit', 'delete']),
  'employee.attendance':  actions(['view', 'create', 'edit', 'delete']),
  'employee.payslips':    actions(['view', 'create', 'edit', 'delete']),
  'employee.documents':   actions(['view', 'create', 'edit', 'delete']),
  'employee.jobs':        actions(['view', 'create', 'edit', 'delete']),
  'employee.tickets':     actions(['view', 'create', 'edit', 'delete']),
  'attendance.dashboard': actions(['view', 'edit']),
  'attendance.calendar':  actions(['view']),
  'leave.requests':       actions(['view', 'create', 'edit']),
  'people.employees':     actions(['view']),
  'people.departments':   actions(['view']),
  'onboarding.dashboard': actions(['view']),
  'onboarding.instances': actions(['view', 'edit']),
  'onboarding.tasks':     actions(['view', 'edit']),
  'onboarding.documents': actions(['view']),
});

const IT_PERMS = buildPerms({
  'overview.dashboard': actions(['view']),
  'onboarding.dashboard': actions(['view']),
  'onboarding.tasks': actions(['view', 'edit']),
  'onboarding.documents': actions(['view']),
  'employee.dashboard': actions(['view']),
});

/* ─── Exports ────────────────────────────────────────────────── */
const DEFAULT_ROLE_PERMS = {
  super_admin:       SUPER_ADMIN_PERMS,
  admin:             SUPER_ADMIN_PERMS,
  company_admin:     SUPER_ADMIN_PERMS,
  hr:                HR_PERMS,
  manager:           MANAGER_PERMS,
  it:                IT_PERMS,
  employee:          EMPLOYEE_PERMS,
};

function getDefaultPerms(role = 'employee') {
  const key = (role || '').toLowerCase();
  return DEFAULT_ROLE_PERMS[key] || EMPLOYEE_PERMS;
}

function sanitizePermissions(input = []) {
  if (!Array.isArray(input)) return [];

  const normalized = new Map();

  input.forEach((entry) => {
    const moduleKey = typeof entry?.module === 'string' ? entry.module.trim() : '';
    // Allow any non-empty module key to support dynamic modules.
    if (!moduleKey) return;

    const sourceActions = entry?.actions || {};
    const normalizedActions = Object.fromEntries(
      ACTION_KEYS.map((key) => [
        key,
        (typeof sourceActions?.get === 'function' ? sourceActions.get(key) : sourceActions[key]) === true,
      ]),
    );

    normalized.set(moduleKey, {
      module: moduleKey,
      actions: normalizedActions,
    });
  });

  return [...normalized.values()];
}

module.exports = {
  ACTION_KEYS,
  ALL_PAGES,
  DEFAULT_ROLE_PERMS,
  getDefaultPerms,
  sanitizePermissions,
};
