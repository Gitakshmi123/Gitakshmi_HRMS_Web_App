export const MANAGEMENT_SECTION = 'MANAGEMENT';
export const EMPLOYEE_SECTION = 'EMPLOYEE';

export const MODULE_ORDER = [
  'Dashboard',
  'Access',
  'Employee',
  'Attendance',
  'Policy',
  'Payroll',
  'Hiring',
  'Onboarding',
  'Organization',
  'BGV',
  'Documents',
  'Offboarding',
  'Ticket Inbox',
  'Social Media',
  'Portals',
  'Reports',
  'Approvals',
  'Settings',
  'Sub Companies',
  'emp service',
];

export const MODULE_PERMISSION_PROBES = {
  hr: [
    'overview.dashboard',
    'configuration.access',
    'people.employees',
    'people.directory',
    'people.departments',
    'people.org',
    'people.users',
    'configuration.company',
    'configuration.sequences',
    'support.tickets',
    'offboarding.exit',
  ],
  accessControl: ['configuration.access'],
  attendance: [
    'attendance.dashboard',
    'attendance.history',
    'attendance.liveTracking',
    'attendance.calendar',
    'attendance.face',
  ],
  leave: ['leave.requests', 'leave.policies', 'leave.custom', 'policy.view', 'policy.manage'],
  payroll: [
    'payroll.stats',
    'payroll.salary',
    'payroll.compensation',
    'payroll.process',
    'payroll.run',
    'payroll.payslips',
    'payroll.templates',
  ],
  recruitment: [
    'hiring.jobList',
    'hiring.createReq',
    'hiring.positions',
    'hiring.internal',
    'hiring.external',
    'hiring.tracker',
    'hiring.offerTemplates',
    'hiring.offersJoining',
    'portals.careerPage',
    'portals.applyPage',
    'portals.publicPage',
  ],
  onboarding: [
    'onboarding.dashboard',
    'onboarding.templates',
    'onboarding.instances',
    'onboarding.tasks',
    'onboarding.documents',
    'onboarding.employeePortal',
  ],
  backgroundVerification: ['bgv.caseMaster', 'bgv.emailLogs'],
  socialMediaIntegration: [
    'socialMedia.dashboard',
    'socialMedia.accounts',
    'socialMedia.create',
    'socialMedia.history',
  ],
  employeePortal: [
    'employee.dashboard',
    'employee.attendance',
    'employee.payslips',
    'employee.documents',
    'employee.jobs',
    'employee.manpowerRequisition',
    'employee.tickets',
    'employee.exit',
    'portals.careerPage',
    'portals.applyPage',
    'portals.publicPage',
  ],
  reports: ['reports.staffing', 'reports.movements', 'reports.trends', 'reports.performance'],
  policy: ['policy.view', 'policy.manage'],
  documentManagement: [
    'documents.dashboard',
    'documents.issue',
    'documents.templates',
    'documents.settings',
  ],
  support: ['support.tickets', 'support.view'],
};

export const MODULE_NAME_TO_CODE = {
  overview: 'hr',
  dashboard: 'hr',
  people: 'hr',
  employee: 'hr',
  employees: 'hr',
  'hr management': 'hr',
  organization: 'hr',
  'sub companies': 'hr',
  branches: 'hr',
  settings: 'hr',
  offboarding: 'hr',
  support: null,
  tickets: null,
  'ticket inbox': null,
  attendance: 'attendance',
  'attendance management': 'attendance',
  leave: 'leave',
  policy: 'leave',
  payroll: 'payroll',
  'payroll system': 'payroll',
  hiring: 'recruitment',
  recruitment: 'recruitment',
  portals: 'recruitment',
  bgv: 'backgroundVerification',
  'background verification': 'backgroundVerification',
  access: 'accessControl',
  'access control': 'accessControl',
  'social media': 'socialMediaIntegration',
  'social media integration': 'socialMediaIntegration',
  'emp service': 'employeePortal',
  reports: 'reports',
  'personnel reports': 'reports',
  'system reports': 'reports',
  'analytical reports': 'reports',
  documents: 'documentManagement',
  letters: 'documentManagement',
  'doc management': 'documentManagement',
  'document management': 'documentManagement',
  onboarding: 'onboarding',
};

export const MODULE_DISPLAY_ALIASES = {
  overview: 'Dashboard',
  people: 'Employee',
  employees: 'Employee',
  leave: 'Policy',
  'access control': 'Access',
  support: 'Ticket Inbox',
  tickets: 'Ticket Inbox',
  'ticket inbox': 'Ticket Inbox',
  'personnel reports': 'Reports',
  'system reports': 'Reports',
  'analytical reports': 'Reports',
  letters: 'Documents',
  documents: 'Documents',
  'doc management': 'Documents',
  'document management': 'Documents',
};

export const ESS_ROUTE_MAP = {
  dashboard: 'my-dashboard',
  attendance: 'my-attendance',
  'my-attendance': 'my-attendance',
  payslips: 'my-payslips',
  payslip: 'my-payslips',
  'my-payslips': 'my-payslips',
  documents: 'my-documents',
  'my-documents': 'my-documents',
  'my documents': 'my-documents',
  'internal-jobs': 'internal-jobs',
  'internal jobs': 'internal-jobs',
  exit: 'resignation',
  resignation: 'resignation',
  offboarding: 'resignation',
  support: 'support-center',
  tickets: 'support-center',
  'support-center': 'support-center',
  'support center': 'support-center',
  'manpower-requisition': 'manpower-requisition',
  'manpower requisition': 'manpower-requisition',
};

export const EMPLOYEE_TO_MANAGEMENT_PERMISSION_FALLBACK = {
  'employee.dashboard': ['overview.dashboard', '/tenant/dashboard', '/hr/dashboard'],
  'employee.attendance': ['attendance.dashboard', '/tenant/attendance', '/hr/attendance'],
  'employee.payslips': ['payroll.payslips', '/tenant/payroll/payslips', '/hr/payroll/payslips'],
  'employee.documents': ['documents.dashboard', '/tenant/letters', '/hr/letters'],
  'employee.jobs': ['hiring.internal', 'hiring.jobList', '/tenant/internal-applicants', '/tenant/requirements'],
  'employee.manpowerRequisition': ['hiring.createReq', 'hiring.jobList'],
  'employee.tickets': ['support.tickets', '/tenant/tickets', '/hr/tickets'],
  'employee.exit': [
    'offboarding.exit',
    'offboarding.view',
    'offboarding.manage',
    'exit.view',
    'exit.manage',
    '/tenant/exit-management',
    '/hr/exit-management',
  ],
  'onboarding.dashboard': ['onboarding.employeePortal', '/tenant/onboarding/dashboard', '/hr/onboarding/dashboard'],
};

export const EMPLOYEE_SELF_SERVICE_PAGES = [
  { id: 'dashboard', title: 'Dashboard', icon: 'dashboard', route: 'dashboard', managementRoute: 'my-dashboard', permissionKey: 'employee.dashboard' },
  { id: 'attendance', title: 'My Attendance', icon: 'attendance', route: 'attendance', managementRoute: 'my-attendance', permissionKey: 'employee.attendance' },
  { id: 'payslips', title: 'Payslip', icon: 'payslips', route: 'payslips', managementRoute: 'my-payslips', permissionKey: 'employee.payslips' },
  { id: 'my-documents', title: 'My Documents', icon: 'templates', route: 'my-documents', managementRoute: 'my-documents', permissionKey: 'employee.documents' },
  { id: 'internal-jobs', title: 'Internal Jobs', icon: 'requirements', route: 'internal-jobs', managementRoute: 'internal-jobs', permissionKey: 'employee.jobs' },
  { id: 'manpower-requisition', title: 'Manpower Requisition', icon: 'employees', route: 'manpower-requisition', managementRoute: 'manpower-requisition', permissionKey: 'employee.manpowerRequisition' },
  { id: 'support-center', title: 'Support Center', icon: 'support', route: 'support-center', managementRoute: 'support-center', permissionKey: 'employee.tickets' },
  { id: 'resignation', title: 'Resignation', icon: 'exit', route: 'resignation', managementRoute: 'resignation', permissionKey: 'employee.exit' },
];

export const MANAGEMENT_MODULES = [
  { moduleName: 'Dashboard', route: 'dashboard', icon: 'dashboard', moduleCode: 'hr', permissionKeys: ['overview.dashboard'] },
  { moduleName: 'Access', route: 'access', icon: 'access', moduleCode: 'accessControl', permissionKeys: ['configuration.access'] },
  { moduleName: 'Employee', route: 'employees', icon: 'employees', moduleCode: 'hr', permissionKeys: ['people.employees', 'people.directory', 'people.departments', 'people.org', 'people.users'] },
  { moduleName: 'Attendance', route: 'attendance', employeeRoute: 'management-attendance', icon: 'attendance', moduleCode: 'attendance', permissionKeys: ['attendance.dashboard', 'attendance.history', 'attendance.liveTracking', 'attendance.calendar', 'attendance.face'] },
  { moduleName: 'Policy', route: 'leave-approvals', icon: 'leaveRequests', moduleCode: 'leave', permissionKeys: ['leave.requests', 'leave.policies', 'policy.view', 'policy.manage'] },
  { moduleName: 'Payroll', route: 'payroll/dashboard', icon: 'payrollDashboard', moduleCode: 'payroll', permissionKeys: ['payroll.stats', 'payroll.salary', 'payroll.compensation', 'payroll.process', 'payroll.run', 'payroll.payslips'] },
  { moduleName: 'Hiring', route: 'requirements', icon: 'requirements', moduleCode: 'recruitment', permissionKeys: ['hiring.jobList', 'hiring.createReq', 'hiring.positions', 'hiring.external', 'hiring.internal', 'hiring.tracker', 'hiring.offerTemplates', 'hiring.offersJoining'] },
  { moduleName: 'Onboarding', route: 'onboarding/dashboard', icon: 'onboarding', moduleCode: 'onboarding', permissionKeys: ['onboarding.dashboard', 'onboarding.templates', 'onboarding.instances', 'onboarding.tasks'] },
  { moduleName: 'Organization', route: 'organization', icon: 'organization', moduleCode: 'hr', permissionKeys: ['company.subCompanies', 'people.subCompanies', 'organization.view', 'people.org'] },
  { moduleName: 'BGV', route: 'bgv', icon: 'bgv', moduleCode: 'backgroundVerification', permissionKeys: ['bgv.caseMaster', 'bgv.emailLogs'] },
  { moduleName: 'Documents', route: 'letters', icon: 'templates', moduleCode: 'documentManagement', permissionKeys: ['documents.dashboard', 'documents.issue', 'documents.templates', 'documents.settings'], matchRoutes: ['letters', 'letter-templates', 'letter-settings', 'payslip-templates'] },
  { moduleName: 'Settings', route: 'settings/company', icon: 'company', moduleCode: 'hr', permissionKeys: ['configuration.company', 'configuration.sequences'] },
  { moduleName: 'Social Media', route: 'settings/social-media', icon: 'social', moduleCode: 'socialMediaIntegration', permissionKeys: ['socialMedia.dashboard', 'socialMedia.accounts', 'socialMedia.create', 'socialMedia.history'] },
  { moduleName: 'Portals', route: 'career-builder', icon: 'viewCareers', moduleCode: 'recruitment', permissionKeys: ['portals.careerPage', 'portals.applyPage', 'portals.publicPage'] },
  { moduleName: 'Ticket Inbox', route: 'tickets', icon: 'support', moduleCode: null, permissionKeys: ['support.tickets', 'support.view'] },
  { moduleName: 'Reports', route: 'reports', icon: 'history', moduleCode: 'reports', permissionKeys: ['reports.staffing', 'reports.movements', 'reports.trends', 'reports.performance'] },
  { moduleName: 'Offboarding', route: 'exit-management', icon: 'exit', moduleCode: 'hr', permissionKeys: ['offboarding.exit', 'offboarding.manage', 'offboarding.view', 'exit.view', 'exit.manage'] },
  { moduleName: 'Approvals', route: 'approvals', icon: 'approvals', moduleCode: 'hr', permissionKeys: ['approval.view', 'approval.approve', 'approval.workflow.manage'] },
];

export function normalizeSlug(value) {
  return String(value || '')
    .replace(/^\/employee\//, '')
    .replace(/^\/hr\//, '')
    .replace(/^\/tenant\//, '')
    .replace(/^\//, '')
    .replace(/%20/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeModuleDisplayName(name) {
  const raw = String(name || '').trim();
  const lower = raw.toLowerCase();
  return MODULE_DISPLAY_ALIASES[lower] || raw;
}

export function resolveModuleCode(moduleLike) {
  const key = String(moduleLike?.moduleKey || '').trim();
  if (key) return key;
  return MODULE_NAME_TO_CODE[String(moduleLike?.name || '').trim().toLowerCase()] || null;
}

export function buildPath(pathPrefix, route) {
  const cleanPrefix = String(pathPrefix || '/hr').replace(/\/$/, '');
  const cleanRoute = String(route || '').replace(/^\//, '');
  return `${cleanPrefix}/${cleanRoute}`.replace(/\/+/g, '/');
}

export function resolveDynamicRoute({ moduleName, rawRoute, pathPrefix }) {
  const slug = normalizeSlug(rawRoute);
  const moduleSlug = String(moduleName || '').trim().toLowerCase();

  if (moduleSlug === 'emp service' || String(rawRoute || '').startsWith('/employee/')) {
    return buildPath(pathPrefix, ESS_ROUTE_MAP[slug] || slug.replace(/\s+/g, '-'));
  }

  if (slug === 'attendance') {
    return buildPath(pathPrefix, 'attendance');
  }

  return rawRoute ? buildPath(pathPrefix, slug.replace(/\s+/g, '-')) : '';
}

export function getManagementModuleOrder(savedOrder) {
  return Array.isArray(savedOrder) && savedOrder.length > 0 ? savedOrder : MODULE_ORDER;
}

export function getSectionTabs(pathPrefix, icons = {}) {
  const icon = (name) => icons[name];
  return [
    {
      match: ['/organization', '/org', '/departments', '/grades', '/organization-policies', '/leave-approvals', '/leave-requests', '/organization/automations', '/shift-management'],
      tabs: [
        { label: 'Organization', to: buildPath(pathPrefix, 'organization'), icon: icon('organization'), permission: 'people.org' },
        { label: 'Org Structure', to: buildPath(pathPrefix, 'org'), icon: icon('employees'), permission: 'people.org' },
        { label: 'Departments', to: buildPath(pathPrefix, 'departments'), icon: icon('departments'), permission: 'people.departments' },
        { label: 'Grades', to: buildPath(pathPrefix, 'grades'), icon: icon('requirements'), permission: 'people.org' },
        { label: 'Leave Configuration', to: buildPath(pathPrefix, 'organization-policies'), icon: icon('settings'), permission: 'leave.policies' },
        { label: 'Requests', to: buildPath(pathPrefix, 'leave-approvals'), icon: icon('leave'), permission: 'leave.requests' },
        { label: 'Shift', to: buildPath(pathPrefix, 'shift-management'), icon: icon('clock'), permission: 'attendance.dashboard' },
        { label: 'Automations', to: buildPath(pathPrefix, 'organization/automations'), icon: icon('settings'), permission: 'people.org' },
      ],
    },
    {
      match: ['/employees', '/users'],
      tabs: [
        { label: 'Employees', to: buildPath(pathPrefix, 'employees'), icon: icon('employees'), permission: 'people.employees' },
        { label: 'Users', to: buildPath(pathPrefix, 'users'), icon: icon('users'), permission: 'people.users' },
      ],
    },
    {
      match: ['/attendance', '/attendance-calendar', '/face-update-requests'],
      tabs: [
        { label: 'Dashboard', to: buildPath(pathPrefix, 'attendance'), icon: icon('dashboard'), permission: 'attendance.dashboard' },
        { label: 'History', to: buildPath(pathPrefix, 'attendance-history'), icon: icon('history'), permission: 'attendance.history' },
        { label: 'Live Tracking', to: buildPath(pathPrefix, 'attendance/live-tracking'), icon: icon('pin'), permission: 'attendance.liveTracking' },
        { label: 'Calendar', to: buildPath(pathPrefix, 'attendance-calendar'), icon: icon('calendar'), permission: 'attendance.calendar' },
        { label: 'Face Updates', to: buildPath(pathPrefix, 'face-update-requests'), icon: icon('fingerprint'), permission: 'attendance.face' },
      ],
    },
    {
      match: ['/payroll', '/salary-structure', '/payslip-templates'],
      tabs: [
        { label: 'Stats', to: buildPath(pathPrefix, 'payroll/dashboard'), icon: icon('dashboard'), permission: 'payroll.stats' },
        { label: 'Salary', to: buildPath(pathPrefix, 'payroll/salary-components'), icon: icon('payroll'), permission: 'payroll.salary' },
        { label: 'Compensation', to: buildPath(pathPrefix, 'payroll/compensation'), icon: icon('payroll'), permission: 'payroll.compensation' },
        { label: 'Process', to: buildPath(pathPrefix, 'payroll/process'), icon: icon('settings'), permission: 'payroll.process' },
        { label: 'Run History', to: buildPath(pathPrefix, 'payroll/run'), icon: icon('calendar'), permission: 'payroll.run' },
        { label: 'Payslips', to: buildPath(pathPrefix, 'payroll/payslips'), icon: icon('file'), permission: 'payroll.payslips' },
        { label: 'Templates', to: buildPath(pathPrefix, 'payslip-templates'), icon: icon('paint'), permission: 'payroll.templates' },
      ],
    },
    {
      match: ['/requirements', '/create-requirement', '/applicants', '/internal-applicants', '/candidate-status', '/positions', '/position-master', '/offer-templates', '/offers-joining', '/job/'],
      tabs: [
        { label: 'Job List', to: buildPath(pathPrefix, 'requirements'), icon: icon('requirements'), permission: 'hiring.jobList' },
        { label: 'Create Req', to: buildPath(pathPrefix, 'create-requirement'), icon: icon('requirements'), permission: 'hiring.createReq' },
        { label: 'External', to: buildPath(pathPrefix, 'applicants'), icon: icon('employees'), permission: 'hiring.external' },
        { label: 'Internal', to: buildPath(pathPrefix, 'internal-applicants'), icon: icon('employees'), permission: 'hiring.internal' },
        { label: 'Tracker', to: buildPath(pathPrefix, 'candidate-status'), icon: icon('dashboard'), permission: 'hiring.tracker' },
        { label: 'Templates', to: buildPath(pathPrefix, 'offer-templates'), icon: icon('file'), permission: 'hiring.offerTemplates' },
        { label: 'Offers & Joining', to: buildPath(pathPrefix, 'offers-joining'), icon: icon('file'), permission: 'hiring.offersJoining' },
      ],
    },
    {
      match: ['/letters', '/letter-templates', '/letter-settings'],
      tabs: [
        { label: 'Letters', to: buildPath(pathPrefix, 'letters'), icon: icon('file'), permission: 'documents.dashboard' },
        { label: 'Issue', to: buildPath(pathPrefix, 'letters/issue'), icon: icon('file'), permission: 'documents.issue' },
        { label: 'Templates', to: buildPath(pathPrefix, 'letter-templates'), icon: icon('paint'), permission: 'documents.templates' },
        { label: 'Settings', to: buildPath(pathPrefix, 'letter-settings'), icon: icon('settings'), permission: 'documents.settings' },
      ],
    },
    {
      match: ['/bgv'],
      tabs: [
        { label: 'Case Master', to: buildPath(pathPrefix, 'bgv'), icon: icon('shield'), permission: 'bgv.caseMaster' },
        { label: 'Email Logs', to: buildPath(pathPrefix, 'bgv/emails'), icon: icon('mail'), permission: 'bgv.emailLogs' },
      ],
    },
    { match: ['/onboarding'], tabs: [] },
    { match: ['/access'], tabs: [] },
    {
      match: ['/settings/social-media'],
      tabs: [
        { label: 'Dashboard', to: buildPath(pathPrefix, 'settings/social-media'), icon: icon('dashboard'), permission: 'socialMedia.dashboard' },
        { label: 'Accounts', to: buildPath(pathPrefix, 'settings/social-media/accounts'), icon: icon('employees'), permission: 'socialMedia.accounts' },
        { label: 'Create Post', to: buildPath(pathPrefix, 'settings/social-media/create'), icon: icon('share'), permission: 'socialMedia.create' },
        { label: 'History', to: buildPath(pathPrefix, 'settings/social-media/history'), icon: icon('history'), permission: 'socialMedia.history' },
      ],
    },
    {
      match: ['/settings/company', '/settings/sequences', '/settings/email-templates'],
      tabs: [
        { label: 'Global Settings', to: buildPath(pathPrefix, 'settings/company'), icon: icon('settings'), permission: 'configuration.company' },
        { label: 'Document Sequences', to: buildPath(pathPrefix, 'settings/sequences'), icon: icon('file'), permission: 'configuration.sequences' },
        { label: 'Email Templates', to: buildPath(pathPrefix, 'settings/email-templates'), icon: icon('mail'), permission: 'configuration.company' },
      ],
    },
    {
      match: ['/career-builder', '/apply-builder'],
      tabs: [
        { label: 'Career Page', to: buildPath(pathPrefix, 'career-builder'), icon: icon('paint'), permission: 'portals.careerPage' },
        { label: 'Apply Page', to: buildPath(pathPrefix, 'apply-builder'), icon: icon('paint'), permission: 'portals.applyPage' },
      ],
    },
    {
      match: ['/reports'],
      tabs: [
        { label: 'Staffing Overview', to: buildPath(pathPrefix, 'reports'), icon: icon('employees'), permission: 'reports.staffing' },
        { label: 'Replacement Movements', to: buildPath(pathPrefix, 'reports/replacements'), icon: icon('userPlus'), permission: 'reports.movements' },
        { label: 'Hiring Trends', to: buildPath(pathPrefix, 'reports/trends'), icon: icon('chart'), permission: 'reports.trends' },
        { label: 'Performance', to: buildPath(pathPrefix, 'reports/performance'), icon: icon('clock'), permission: 'reports.performance' },
      ],
    },
  ];
}
