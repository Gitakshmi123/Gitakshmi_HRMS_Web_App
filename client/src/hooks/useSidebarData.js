import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { getNavGroups } from '../components/HRSidebar';

const PERMISSION_KEY_BY_ROUTE = {
  '/hr': 'overview.dashboard',
  '/hr/reports': 'overview.reports',
  '/hr/employees': 'people.employees',
  '/hr/departments': 'people.departments',
  '/hr/users': 'people.users',
  '/hr/exit-management': 'offboarding.exit',
  '/hr/attendance': 'attendance.dashboard',
  '/hr/attendance-calendar': 'attendance.calendar',
  '/hr/face-update-requests': 'attendance.face',
  '/hr/leave-approvals': 'leave.requests',
  '/hr/leave-policies': 'leave.policies',
  '/hr/payroll/dashboard': 'payroll.stats',
  '/hr/payroll/salary-components': 'payroll.salary',
  '/hr/payroll/compensation': 'payroll.compensation',
  '/hr/payroll/process': 'payroll.process',
  '/hr/payroll/run': 'payroll.run',
  '/hr/payroll/payslips': 'payroll.payslips',
  '/hr/requirements': 'hiring.jobList',
  '/hr/create-requirement': 'hiring.createReq',
  '/hr/positions': 'hiring.positions',
  '/hr/applicants': 'hiring.external',
  '/hr/internal-applicants': 'hiring.internal',
  '/hr/candidate-status': 'hiring.tracker',
  '/hr/bgv': 'bgv.caseMaster',
  '/hr/bgv/emails': 'bgv.emailLogs',
  '/hr/letters': 'documents.dashboard',
  '/hr/letters/issue': 'documents.issue',
  '/hr/letter-templates': 'documents.templates',
  '/hr/letter-settings': 'documents.settings',
  '/hr/payslip-templates': 'payroll.templates',
  '/hr/access': 'configuration.access',
  '/hr/settings/company': 'configuration.company',
  '/hr/settings/social-media': 'socialMedia.management',
  '/hr/career-builder': 'portals.careerPage',
  '/hr/apply-builder': 'portals.applyPage',
};

function makeId(moduleTitle, label, route = '') {
  return [moduleTitle, label, route]
    .filter(Boolean)
    .join('::')
    .toLowerCase()
    .replace(/[^a-z0-9:/-]+/g, '-');
}

function normalizeNavItem(item, moduleTitle, parentLabel = '') {
  const pageId = item.to || item.permissionKey || makeId(moduleTitle, parentLabel ? `${parentLabel}:${item.label}` : item.label);

  return {
    _id: pageId,
    name: item.label,
    label: item.label,
    route: item.to || null,
    icon: item.icon || null,
    permissionKey: item.permissionKey || (item.to ? PERMISSION_KEY_BY_ROUTE[item.to] || null : null),
    isExternal: item.isExternal === true,
    children: Array.isArray(item.subItems)
      ? item.subItems.map((subItem) => normalizeNavItem(subItem, moduleTitle, item.label))
      : [],
  };
}

export default function useSidebarData() {
  const { user, enabledModules } = useAuth();

  return useMemo(() => {
    const navGroups = getNavGroups(user);
    const filteredGroups = navGroups.filter((group) => {
      if (user?.role === 'psa') return true;
      if (group.module) return enabledModules && enabledModules[group.module] === true;
      return true;
    });

    return filteredGroups.map((group) => ({
      _id: makeId(group.title, group.title),
      name: group.title,
      label: group.title,
      icon: group.icon || null,
      pages: (group.items || []).map((item) => normalizeNavItem(item, group.title)),
    }));
  }, [enabledModules, user]);
}
