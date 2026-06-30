const ACTIONS = ['view', 'create', 'edit', 'delete'];

const PAGE_KEYS = [
  'overview.dashboard',
  'reports.staffing', 'reports.movements', 'reports.trends', 'reports.performance',
  'people.employees', 'people.departments', 'people.org', 'people.users',
  'offboarding.exit',
  'attendance.dashboard', 'attendance.calendar', 'attendance.face',
  'leave.requests', 'leave.policies',
  'payroll.stats', 'payroll.salary', 'payroll.compensation', 'payroll.process', 'payroll.run', 'payroll.payslips',
  'hiring.jobList', 'hiring.createReq', 'hiring.external', 'hiring.internal', 'hiring.tracker', 'hiring.positions', 'hiring.offerTemplates',
  'bgv.caseMaster', 'bgv.emailLogs',
  'documents.dashboard', 'documents.templates', 'documents.settings', 'documents.issue',
  'configuration.access', 'configuration.company', 'configuration.sequences',
  'socialMedia.dashboard', 'socialMedia.accounts', 'socialMedia.create', 'socialMedia.history',
  'portals.careerPage', 'portals.applyPage', 'portals.publicPage',
  'support.tickets',
  'employee.dashboard', 'employee.attendance', 'employee.payslips', 'employee.documents', 'employee.jobs', 'employee.tickets', 'employee.exit',
  'onboarding.dashboard', 'onboarding.templates', 'onboarding.instances', 'onboarding.tasks', 'onboarding.documents', 'onboarding.employeePortal',
  'hr',
];

const fullActions = Object.freeze({ view: true, create: true, edit: true, delete: true });
const readOnlyActions = Object.freeze({ view: true, create: false, edit: false, delete: false });

const toMap = (allowedKeys, actionSet = readOnlyActions) => {
  const map = {};
  PAGE_KEYS.forEach((k) => {
    map[k] = allowedKeys.includes(k) ? { ...actionSet } : { view: false, create: false, edit: false, delete: false };
  });
  return map;
};

const MANAGER_KEYS = [
  'employee.dashboard', 'employee.attendance', 'employee.payslips', 'employee.documents', 'employee.jobs', 'employee.tickets',
  'attendance.dashboard', 'attendance.calendar',
  'leave.requests',
  'people.employees', 'people.departments',
];

const EMPLOYEE_KEYS = [
  'employee.dashboard', 'employee.attendance', 'employee.payslips', 'employee.documents', 'employee.jobs', 'employee.tickets', 'employee.exit', 'employee.manpowerRequisition',
];

const HR_KEYS = [
  'overview.dashboard',
  'reports.staffing', 'reports.movements', 'reports.trends', 'reports.performance',
  'people.employees', 'people.departments', 'people.org', 'people.users',
  'offboarding.exit',
  'attendance.dashboard', 'attendance.calendar', 'attendance.face',
  'leave.requests', 'leave.policies',
  'payroll.stats', 'payroll.salary', 'payroll.compensation', 'payroll.process', 'payroll.run', 'payroll.payslips',
  'hiring.jobList', 'hiring.createReq', 'hiring.external', 'hiring.internal', 'hiring.tracker', 'hiring.positions', 'hiring.offerTemplates',
  'bgv.caseMaster', 'bgv.emailLogs',
  'documents.dashboard', 'documents.templates', 'documents.settings', 'documents.issue',
  'configuration.access', 'configuration.company', 'configuration.sequences',
  'socialMedia.dashboard', 'socialMedia.accounts', 'socialMedia.create', 'socialMedia.history',
  'portals.careerPage', 'portals.applyPage', 'portals.publicPage',
  'support.tickets',
  'employee.dashboard', 'employee.attendance', 'employee.payslips', 'employee.documents', 'employee.jobs', 'employee.tickets', 'employee.exit',
  'hr',
];

export function getLegacyPermissionMap(roleRaw) {
  const role = String(roleRaw || '').toLowerCase().trim();
  const isSuper = ['psa', 'super_admin', 'admin', 'company_super_admin', 'company_admin', 'company administrator', 'company-admin'].includes(role);
  if (isSuper) {
    return PAGE_KEYS.reduce((acc, key) => {
      acc[key] = { ...fullActions };
      return acc;
    }, {});
  }
  if (['hr', 'human_resource', 'hr manager', 'hr_manager', 'hr-manager', 'hr_admin'].includes(role)) {
    return toMap(HR_KEYS, fullActions);
  }
  if (role === 'manager') {
    return toMap(MANAGER_KEYS, fullActions);
  }
  return toMap(EMPLOYEE_KEYS, fullActions);
}

export function normalizeActionKey(action = 'view') {
  const key = String(action || 'view').toLowerCase();
  if (key === 'update') return 'edit';
  return ACTIONS.includes(key) || key === 'any' ? key : 'view';
}
