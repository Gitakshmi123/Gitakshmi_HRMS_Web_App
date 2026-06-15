const EMPLOYEE_PORTAL_ROUTE_ORDER = [
  // 1. HR / Management Modules (High Priority for landing if granted)
  { path: '/employee/hr-dashboard', permissionKey: 'overview.dashboard' },
  { path: '/employee/leave-approvals', permissionKey: 'leave.requests' },
  { path: '/employee/leave-policies', permissionKey: 'leave.policies' },
  { path: '/employee/management-attendance', permissionKey: 'attendance.dashboard' },
  { path: '/employee/employees', permissionKey: 'people.employees' },
  { path: '/employee/requirements', permissionKey: 'hiring.jobList' },
  { path: '/employee/payroll/dashboard', permissionKey: 'payroll.stats' },
  { path: '/employee/bgv', permissionKey: 'bgv.caseMaster' },
  { path: '/employee/reports', permissionKey: 'reports.staffing' },
  { path: '/employee/onboarding/dashboard', permissionKey: 'onboarding.dashboard' },
  { path: '/employee/approvals', permissionKey: 'approval.view' },
  { path: '/employee/access', permissionKey: 'configuration.access' },

  // 2. Default Employee Dashboard
  { path: '/employee/dashboard', permissionKey: 'employee.dashboard' },

  // 3. Sub-pages and secondary tools
  { path: '/employee/attendance', permissionKey: 'employee.attendance' },
  { path: '/employee/payslips', permissionKey: 'employee.payslips' },
  { path: '/employee/my-documents', permissionKey: 'employee.documents' },
  { path: '/employee/internal-jobs', permissionKey: 'employee.jobs' },
  { path: '/employee/support-center', permissionKey: 'employee.tickets' },
  { path: '/employee/resignation', permissionKey: 'employee.exit' },
  { path: '/employee/onboarding', permissionKey: 'onboarding.employeePortal' },
  { path: '/employee/tickets', permissionKey: 'support.tickets' },
  { path: '/employee/offers-joining', permissionKey: 'hiring.offersJoining' },
  { path: '/employee/departments', permissionKey: 'people.departments' },
  { path: '/employee/org', permissionKey: 'people.org' },
  { path: '/employee/users', permissionKey: 'people.users' },
  { path: '/employee/attendance-calendar', permissionKey: 'attendance.calendar' },
  { path: '/employee/face-update-requests', permissionKey: 'attendance.face' },
  { path: '/employee/payroll/salary-components', permissionKey: 'payroll.salary' },
  { path: '/employee/payroll/compensation', permissionKey: 'payroll.compensation' },
  { path: '/employee/payroll/process', permissionKey: 'payroll.process' },
  { path: '/employee/payroll/run', permissionKey: 'payroll.run' },
  { path: '/employee/payroll/payslips', permissionKey: 'payroll.payslips' },
  { path: '/employee/create-requirement', permissionKey: 'hiring.createReq' },
  { path: '/employee/applicants', permissionKey: 'hiring.external' },
  { path: '/employee/internal-applicants', permissionKey: 'hiring.internal' },
  { path: '/employee/candidate-status', permissionKey: 'hiring.tracker' },
  { path: '/employee/bgv/emails', permissionKey: 'bgv.emailLogs' },
  { path: '/employee/sub-companies', permissionKey: 'company.subCompanies' },
  { path: '/employee/exit-management', permissionKey: 'offboarding.exit' },
  { path: '/employee/settings/company', permissionKey: 'configuration.company' },
  { path: '/employee/settings/sequences', permissionKey: 'configuration.sequences' },
  { path: '/employee/settings/social-media', permissionKey: 'socialMedia.dashboard' },
];

const PRIVILEGED_MANAGEMENT_ROLES = new Set([
  'hr',
  'admin',
  'company_admin',
  'company_super_admin',
  'human_resource',
  'super_admin',
  'psa',
  'hr_manager',
  'hr_admin',
  'admin_manager',
  'sub_company_admin',
  'branch_head',
  'division_head',
  'department_head',
  'designation_head',
]);

const EMPLOYEE_LIKE_ROLES = new Set(['employee', 'manager', 'user', 'staff']);

export function normalizeAccessRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

export function isPrivilegedManagementRole(role) {
  return PRIVILEGED_MANAGEMENT_ROLES.has(normalizeAccessRole(role));
}

export function isEmployeeLikeRole(role) {
  return EMPLOYEE_LIKE_ROLES.has(normalizeAccessRole(role));
}

export function resolveFirstAllowedEmployeePath(hasPermission) {
  if (typeof hasPermission !== 'function') return null;

  const firstAllowed = EMPLOYEE_PORTAL_ROUTE_ORDER.find(({ permissionKey }) => (
    hasPermission(permissionKey, 'view') || hasPermission(permissionKey, 'any')
  ));

  return firstAllowed?.path || null;
}

export { EMPLOYEE_PORTAL_ROUTE_ORDER };
