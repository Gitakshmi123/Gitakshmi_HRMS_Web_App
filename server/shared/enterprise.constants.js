const TENANT_MODULES = [
  { key: 'employees', name: 'Employees' },
  { key: 'attendance', name: 'Attendance' },
  { key: 'payroll', name: 'Payroll' },
  { key: 'recruitment', name: 'Recruitment' },
  { key: 'onboarding', name: 'Onboarding' },
  { key: 'leaves', name: 'Leaves' },
  { key: 'documents', name: 'Documents' },
  { key: 'assets', name: 'Assets' },
  { key: 'workflows', name: 'Workflows' },
  { key: 'social_media', name: 'Social Media' },
  { key: 'dms', name: 'DMS' }
];

const DEFAULT_TENANT_ROLES = [
  {
    name: 'Tenant Admin',
    code: 'tenant_admin',
    permissions: TENANT_MODULES.map((module) => ({
      module: module.key,
      actions: ['create', 'read', 'update', 'delete', 'approve', 'export']
    }))
  },
  {
    name: 'HR Manager',
    code: 'hr_manager',
    permissions: TENANT_MODULES
      .filter((module) => module.key !== 'payroll')
      .map((module) => ({
        module: module.key,
        actions: ['create', 'read', 'update', 'approve', 'export']
      }))
  },
  {
    name: 'Employee',
    code: 'employee',
    permissions: [
      { module: 'employees', actions: ['read'] },
      { module: 'attendance', actions: ['read'] },
      { module: 'leaves', actions: ['create', 'read'] },
      { module: 'documents', actions: ['create', 'read'] }
    ]
  }
];

module.exports = {
  TENANT_MODULES,
  DEFAULT_TENANT_ROLES
};
