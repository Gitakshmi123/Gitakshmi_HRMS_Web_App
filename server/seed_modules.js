
const axios = require('axios');

const NAV_GROUPS = [
  // --- EMPLOYEE MODULES (New) ---
  {
    title: 'emp service',
    module: 'ess',
    icon: 'dashboard',
    items: [
      { to: '/employee/dashboard', label: 'Dashboard', permissionKey: 'employee.dashboard', icon: 'dashboard' },
      { to: '/employee/attendance', label: 'My Attendance', permissionKey: 'employee.attendance', icon: 'attendance' },
      { to: '/employee/payslips', label: 'My Payslips', permissionKey: 'employee.payslips', icon: 'payslips' },
      { to: '/employee/my-documents', label: 'My Documents', permissionKey: 'employee.documents', icon: 'templates' },
      { to: '/employee/internal-jobs', label: 'Internal Jobs', permissionKey: 'employee.jobs', icon: 'requirements' },
      { to: '/employee/tickets', label: 'Support Center', permissionKey: 'employee.tickets', icon: 'social' },
      { to: '/employee/exit', label: 'Resignation', permissionKey: 'employee.exit', icon: 'history' }
    ]
  },
  // --- HR MODULES (Existing) ---
  {
    title: 'Access Control',
    icon: 'access',
    items: [
      { to: '/hr/access', label: 'Access Control', permissionKey: 'configuration.access', icon: 'access' }
    ]
  },

  {
    title: 'Overview',
    icon: 'dashboard',
    items: [
      { to: '/hr/dashboard', label: 'Dashboard', permissionKey: 'overview.dashboard', icon: 'dashboard' }
    ]
  },
  {
    title: 'Reports',
    icon: 'payrollDashboard',
    items: [
      { to: '/hr/reports', label: 'Staffing Overview', permissionKey: 'reports.staffing', icon: 'payrollDashboard' },
      { to: '/hr/reports/replacements', label: 'Replacement Movements', permissionKey: 'reports.movements', icon: 'runHistory' },
      { to: '/hr/reports/trends', label: 'Hiring Trends', permissionKey: 'reports.trends', icon: 'compensation' },
      { to: '/hr/reports/performance', label: 'Performance', permissionKey: 'reports.performance', icon: 'employees' }
    ]
  },
  {
    title: 'People',
    module: 'hr',
    icon: 'employees',
    items: [
      { to: '/hr/employees', label: 'Employees', permissionKey: 'people.employees', icon: 'employees' },
      { to: '/hr/departments', label: 'Departments', permissionKey: 'people.departments', icon: 'departments' },
      { to: '/hr/org', label: 'Org Structure', permissionKey: 'people.org', icon: 'org' },
      { to: '/hr/users', label: 'Users', permissionKey: 'people.users', icon: 'users' }
    ]
  },
  {
    title: 'Offboarding',
    icon: 'history',
    items: [
      { to: '/hr/exit-management', label: 'Offboarding', permissionKey: 'offboarding.exit', icon: 'history' }
    ]
  },
  {
    title: 'Attendance',
    module: 'attendance',
    icon: 'attendance',
    items: [
      { to: '/hr/attendance', label: 'Dashboard', permissionKey: 'attendance.dashboard', icon: 'attendance' },
      { to: '/hr/attendance-calendar', label: 'Calendar', permissionKey: 'attendance.calendar', icon: 'calendar' },
      { to: '/hr/face-update-requests', label: 'Face Updates', permissionKey: 'attendance.face', icon: 'users' }
    ]
  },
  {
    title: 'Leave',
    module: 'leave',
    icon: 'leaveRequests',
    items: [
      { to: '/hr/leave-approvals', label: 'Requests', permissionKey: 'leave.requests', icon: 'leaveRequests' },
      { to: '/hr/leave-policies', label: 'Policies', permissionKey: 'leave.policies', icon: 'leavePolicies' }
    ]
  },
  {
    title: 'Payroll',
    module: 'payroll',
    icon: 'salaryComponents',
    items: [
      { to: '/hr/payroll/dashboard', label: 'Stats', permissionKey: 'payroll.stats', icon: 'payrollDashboard' },
      { to: '/hr/payroll/salary-components', label: 'Salary', permissionKey: 'payroll.salary', icon: 'salaryComponents' },
      { to: '/hr/payroll/compensation', label: 'Compensation', permissionKey: 'payroll.compensation', icon: 'compensation' },
      { to: '/hr/payroll/process', label: 'Process', permissionKey: 'payroll.process', icon: 'process' },
      { to: '/hr/payroll/run', label: 'History', permissionKey: 'payroll.run', icon: 'runHistory' },
      { to: '/hr/payroll/payslips', label: 'Payslips', permissionKey: 'payroll.payslips', icon: 'payslips' },
      { to: '/hr/payslip-templates', label: 'Payslip Templates', permissionKey: 'payroll.payslips', icon: 'templates' }
    ]
  },
  {
    title: 'Hiring',
    module: 'recruitment',
    icon: 'requirements',
    items: [
      { to: '/hr/requirements', label: 'Job List', permissionKey: 'hiring.jobList', icon: 'requirements' },
      { to: '/hr/create-requirement', label: 'Create Requirement', permissionKey: 'hiring.createReq', icon: 'customization' },
      { to: '/hr/positions', label: 'Position Master', icon: 'settings', permissionKey: 'hiring.positions' },
      { to: '/hr/applicants', label: 'External Applicants', permissionKey: 'hiring.external', icon: 'applicants' },
      { to: '/hr/internal-applicants', label: 'Internal Applicants', permissionKey: 'hiring.internal', icon: 'employees' },
      { to: '/hr/candidate-status', label: 'Tracker', permissionKey: 'hiring.tracker', icon: 'tracker' },
      { to: '/hr/offer-templates', label: 'Templates', permissionKey: 'hiring.offerTemplates', icon: 'templates' }
    ]
  },
  {
    title: 'BGV',
    module: 'backgroundVerification',
    icon: 'bgv',
    items: [
      { to: '/hr/bgv', label: 'Case Master', permissionKey: 'bgv.caseMaster', icon: 'bgv' },
      { to: '/hr/bgv/emails', label: 'Email Management', permissionKey: 'bgv.emailLogs', icon: 'email' }
    ]
  },

  {
    title: 'Settings',
    icon: 'settings',
    items: [
      { to: '/hr/settings/company', label: 'Global Settings', permissionKey: 'configuration.company', icon: 'settings' },
      { to: '/hr/settings/sequences', label: 'Document Sequences', permissionKey: 'configuration.sequences', icon: 'settings' }
    ]
  },
  {
    title: 'Social Media',
    module: 'socialMediaIntegration',
    icon: 'social',
    items: [
      { to: '/hr/settings/social-media', label: 'Dashboard', permissionKey: 'socialMedia.dashboard', icon: 'dashboard' },
      { to: '/hr/settings/social-media/accounts', label: 'Accounts', permissionKey: 'socialMedia.accounts', icon: 'users' },
      { to: '/hr/settings/social-media/create', label: 'Create Post', permissionKey: 'socialMedia.create', icon: 'share' },
      { to: '/hr/settings/social-media/history', label: 'History', permissionKey: 'socialMedia.history', icon: 'history' }
    ]
  },
  {
    title: 'Support',
    icon: 'support',
    items: [
      { to: '/hr/tickets', label: 'Ticket Inbox', permissionKey: 'support.tickets', icon: 'support' }
    ]
  },
  {
    title: 'Documents',
    module: 'documents',
    icon: 'templates',
    items: [
      { to: '/hr/letter-templates', label: 'Templates', permissionKey: 'documents.templates', icon: 'templates' },
      { to: '/hr/generate-letter', label: 'Issue Letter', permissionKey: 'documents.issue', icon: 'customization' }
    ]
  },
  {
    title: 'Portals',
    module: 'recruitment',
    icon: 'customization',
    items: [
      { to: '/hr/career-builder', label: 'Career Page', permissionKey: 'portals.careerPage', icon: 'customization' },
      { to: '/hr/apply-builder', label: 'Apply Page', permissionKey: 'portals.applyPage', icon: 'customization' },
      { label: 'Public Page', to: 'public-page', icon: 'viewCareers', isExternal: true, permissionKey: 'portals.publicPage' }
    ]
  }
];

async function seed() {
  try {
    const res = await axios.post('http://localhost:5003/api/system/seed-modules', { navGroups: NAV_GROUPS });
    console.log('Seed success:', res.data);
  } catch (err) {
    console.error('Seed error:', err.response?.data || err.message);
  }
}

seed();
