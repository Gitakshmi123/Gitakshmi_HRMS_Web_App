/* eslint-disable react-refresh/only-export-components */
/* ─── ICONS registry (same as Sidebar) ─── */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import logonew from '../assets/logonew.png';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import api, { API_ROOT, resolveTenantLogoUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useModules } from '../hooks/useModules';
import { useRBAC } from '../context/RBACContext';
import { normalizeModuleCode } from '../utils/moduleConfig';
import { getScopedStorageKey } from '../utils/sidebarStorage';
import {
  LayoutDashboard,
  Users,
  Building2,
  Workflow,
  UserCog,
  Fingerprint,
  CalendarDays,
  Plane,
  Gavel,
  LineChart,
  Layers,
  Coins,
  Zap,
  Clock9,
  Banknote,
  Paintbrush,
  Briefcase,
  UserPlus,
  Radar,
  FileJson,
  Lock,
  Settings2,
  Brush,
  ExternalLink,
  Shield,
  Share2,
  ChevronDown,
  History,
  Mail,
  ChevronRight,
  Menu,
  FileText,
  Clock,
  GripVertical,
  Plus,
  LifeBuoy,
  LogOut,
  MapPin
} from 'lucide-react';

const ICON_SIZE = 20;
const SIDEBAR_ORDER_STORAGE_BASE_KEY = 'hrms:sidebar:order:v1';
const SIDEBAR_ADVANCED_CONFIG_BASE_KEY = 'hrms:sidebar:advanced-config:v1';
const MODULE_PERMISSION_PROBES = {
  hr: ['overview.dashboard', 'configuration.access', 'people.employees', 'configuration.company'],
  attendance: ['attendance.dashboard', 'attendance.calendar', 'attendance.face'],
  leave: ['leave.requests', 'leave.policies'],
  payroll: ['payroll.stats', 'payroll.salary', 'payroll.payslips', 'payroll.process'],
  recruitment: ['hiring.jobList', 'hiring.createReq', 'hiring.internal', 'hiring.external', 'hiring.offerTemplates', 'hiring.offersJoining'],
  onboarding: ['onboarding.dashboard', 'onboarding.templates', 'onboarding.instances', 'onboarding.tasks', 'onboarding.documents', 'onboarding.employeePortal'],
  backgroundVerification: ['bgv.caseMaster', 'bgv.emailLogs'],
  socialMediaIntegration: ['socialMedia.dashboard', 'socialMedia.accounts', 'socialMedia.create', 'socialMedia.history'],
  employeePortal: ['portals.careerPage', 'portals.applyPage', 'portals.publicPage'],
  reports: ['reports.staffing', 'reports.movements', 'reports.trends', 'reports.performance'],
  policy: ['policy.view', 'policy.manage'],
  accessControl: ['configuration.access'],
  documentManagement: ['documents.dashboard']
};

export const ICONS = {
  dashboard: <LayoutDashboard size={ICON_SIZE} />,
  employees: <Users size={ICON_SIZE} />,
  departments: <Building2 size={ICON_SIZE} />,
  org: <Workflow size={ICON_SIZE} />,
  users: <UserCog size={ICON_SIZE} />,
  attendance: <Fingerprint size={ICON_SIZE} />,
  calendar: <CalendarDays size={ICON_SIZE} />,
  leaveRequests: <Plane size={ICON_SIZE} />,
  leavePolicies: <Gavel size={ICON_SIZE} />,
  payrollDashboard: <LineChart size={ICON_SIZE} />,
  salaryComponents: <Layers size={ICON_SIZE} />,
  compensation: <Coins size={ICON_SIZE} />,
  process: <Zap size={ICON_SIZE} />,
  runHistory: <Clock9 size={ICON_SIZE} />,
  payslips: <Banknote size={ICON_SIZE} />,
  payslipDesign: <Paintbrush size={ICON_SIZE} />,
  requirements: <Briefcase size={ICON_SIZE} />,
  applicants: <UserPlus size={ICON_SIZE} />,
  tracker: <Radar size={ICON_SIZE} />,
  templates: <FileJson size={ICON_SIZE} />,
  access: <Lock size={ICON_SIZE} />,
  company: <Settings2 size={ICON_SIZE} />,
  customization: <Brush size={ICON_SIZE} />,
  viewCareers: <ExternalLink size={ICON_SIZE} />,
  bgv: <Shield size={ICON_SIZE} />,
  social: <Share2 size={ICON_SIZE} />,
  history: <History size={ICON_SIZE} />,
  email: <Mail size={ICON_SIZE} />,
  subCompanies: <Building2 size={ICON_SIZE} />,
  branches: <MapPin size={ICON_SIZE} />,
  organization: <Building2 size={ICON_SIZE} />,
  exit: <LogOut size={ICON_SIZE} />,
  support: <LifeBuoy size={ICON_SIZE} />,
  'ticket-inbox': <LifeBuoy size={ICON_SIZE} />,
  onboarding: <Users size={ICON_SIZE} />
};

function matchesAnyPath(pathname, matchPaths = []) {
  if (!pathname || !Array.isArray(matchPaths) || matchPaths.length === 0) {
    return false;
  }

  return matchPaths.some((prefix) => pathname.startsWith(prefix));
}

export default function HRSidebar({
  collapsed: propCollapsed
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isInitialized, enabledModules, refreshEnabledModules } = useAuth();
  const sidebarOrderKey = useMemo(() => 
    getScopedStorageKey(SIDEBAR_ORDER_STORAGE_BASE_KEY, { user, panel: 'hr' }), 
  [user]);
  const sectionOrderKey = useMemo(() => 
    getScopedStorageKey('hrms:sidebar:section-order:v1', { user, panel: 'hr' }), 
  [user]);

  const [sidebarOrder, setSidebarOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(sidebarOrderKey);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      console.error('Sidebar order parse error:', e);
    }
    return [
      'Dashboard', 'Access', 'Employee', 'Attendance', 'Payroll', 'Hiring',
      'Onboarding', 'BGV', 'Offboarding', 'Ticket Inbox', 'Social Media', 'Portals',
      'Reports', 'Settings', 'Sub Companies', 'emp service'
    ];
  });

  const [sectionOrder, setSectionOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(sectionOrderKey);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
    return ['MANAGEMENT', 'EMPLOYEE'];
  });

  const [sidebarStyles, setSidebarStyles] = useState({ bg: '', text: '', active: '' });
  const [hiddenModules, setHiddenModules] = useState([]);

  const hiddenModulesKey = useMemo(() => 
    getScopedStorageKey('hrms:sidebar:hidden:v1', { user, panel: 'hr' }), 
  [user]);

  useEffect(() => {
    const loadSidebarStyles = () => {
      try {
        const panel = location.pathname.startsWith('/employee') ? 'employee' : 'hr';
        const scopedKey = getScopedStorageKey(SIDEBAR_ADVANCED_CONFIG_BASE_KEY, { user, panel });
        const cfg = JSON.parse(localStorage.getItem(scopedKey) || '{}');
        if (cfg?.appearance) {
          setSidebarStyles({
            bg: cfg.appearance.sidebarBgColor || '',
            text: cfg.appearance.sidebarTextColor || '',
            active: cfg.appearance.sidebarActiveColor || ''
          });
        } else {
          setSidebarStyles({ bg: '', text: '', active: '' });
        }
      } catch (e) { }
    };

    loadSidebarStyles();
    window.addEventListener('hrms:appearance:changed', loadSidebarStyles);
    return () => window.removeEventListener('hrms:appearance:changed', loadSidebarStyles);
  }, [user, location.pathname]);

  useEffect(() => {
    const handleOrderChange = () => {
      try {
        const saved = localStorage.getItem(sidebarOrderKey);
        const parsed = saved ? JSON.parse(saved) : null;
        if (Array.isArray(parsed)) setSidebarOrder(parsed);

        const savedSec = localStorage.getItem(sectionOrderKey);
        const parsedSec = savedSec ? JSON.parse(savedSec) : null;
        if (Array.isArray(parsedSec) && parsedSec.length > 0) setSectionOrder(parsedSec);

        const savedHidden = localStorage.getItem(hiddenModulesKey);
        const parsedHidden = savedHidden ? JSON.parse(savedHidden) : null;
        if (Array.isArray(parsedHidden)) setHiddenModules(parsedHidden);
      } catch (e) {
        console.error('Sidebar sync error:', e);
      }
    };
    handleOrderChange(); // Initial load
    window.addEventListener('hrms:sidebar:order:changed', handleOrderChange);
    return () => window.removeEventListener('hrms:sidebar:order:changed', handleOrderChange);
  }, [sidebarOrderKey, sectionOrderKey, hiddenModulesKey]);

  const pathPrefix = location.pathname.startsWith('/tenant') ? '/tenant' : 
                    location.pathname.startsWith('/hr') ? '/hr' : '/employee';
  const { modules: dynamicModules } = useModules();
  const { hasPermission } = useRBAC();
  const roleName = String(user?.roleName || (user?.role && typeof user.role === 'object' ? user.role.name : user?.role) || '').toLowerCase();
  const isPsaRole = ['psa', 'super_admin'].includes(roleName);
  const isPrivilegedSidebarRole = ['hr', 'admin', 'company_super_admin', 'company_admin', 'human_resource', 'super_admin', 'psa', 'hr manager', 'hr_manager', 'hr_admin'].includes(roleName);
  const collapsed = propCollapsed || false;
  const [tenant, setTenant] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});
  const tenantLogoSrc = useMemo(() => resolveTenantLogoUrl(tenant) || logonew, [tenant]);


  const moduleNameToCode = useMemo(() => ({
    overview: 'hr',
    dashboard: 'hr',
    people: 'hr',
    employee: 'hr',
    'hr management': 'hr',
    attendance: 'attendance',
    'attendance management': 'attendance',
    leave: 'leave',
    policy: 'leave',
    payroll: 'payroll',
    'payroll system': 'payroll',
    hiring: 'recruitment',
    recruitment: 'recruitment',
    bgv: 'backgroundVerification',
    settings: 'hr',
    access: 'accessControl',
    'access control': 'accessControl',
    'social media': 'socialMediaIntegration',
    'social media integration': 'socialMediaIntegration',
    portals: 'employeePortal',
    offboarding: 'hr',
    support: 'hr',
    'ticket inbox': 'hr',
    onboarding: 'onboarding',
    reports: 'reports',
    'doc management': 'documentManagement',
    'document management': 'documentManagement',
    documents: 'documentManagement',
    'sub companies': 'hr',
    'emp service': 'employeePortal'
  }), []);

  const storedModuleCodes = useMemo(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('modules') || '[]');
      console.log('Modules in sidebar:', stored);
      if (!Array.isArray(stored)) return new Set();
      return new Set(stored.map((m) => normalizeModuleCode(m)).filter(Boolean));
    } catch {
      return new Set();
    }
  }, []);

  const hasCompanyModule = useCallback((moduleCode) => {
    if (!moduleCode) return true;
    if (isPsaRole) return true;
    // Prefer latest enabledModules from API to avoid stale localStorage "modules" hiding items.
    if (enabledModules && typeof enabledModules === 'object') return enabledModules?.[moduleCode] === true;
    if (storedModuleCodes.size > 0) return storedModuleCodes.has(moduleCode);
    return false;
  }, [isPsaRole, storedModuleCodes, enabledModules]);

  const hasModuleAccess = useCallback((moduleCode) => {
    if (!moduleCode) return true;
    if (isPsaRole) return true;
    if (!hasCompanyModule(moduleCode)) return false;

    const probeKeys = MODULE_PERMISSION_PROBES[moduleCode] || [];
    return probeKeys.some((permissionKey) => hasPermission(permissionKey, 'any'));
  }, [hasCompanyModule, hasPermission, isPrivilegedSidebarRole, isPsaRole]);

  const resolveModuleCodeForNav = useCallback((mod) => {
    const fromKey = normalizeModuleCode(mod?.moduleKey);
    if (fromKey) return fromKey;
    const byName = moduleNameToCode[String(mod?.name || '').trim().toLowerCase()];
    if (byName) return byName;
    return null;
  }, [moduleNameToCode]);

  useEffect(() => {
    if (!isInitialized || !user || user.role === 'candidate') return;
    api.get('/tenants/me').then(res => setTenant(res.data)).catch(() => { });
  }, [user, isInitialized]);

  useEffect(() => {
    if (!isInitialized || !user || typeof refreshEnabledModules !== 'function') return;
    refreshEnabledModules().catch(() => { });
  }, [user, isInitialized, refreshEnabledModules]);


  const navSections = useMemo(() => {
    let hasSupportModule = false;
    let hasReportsModule = false;
    let hasEmpServiceModule = false;
    const sections = [];

    const canAttendance =
      isPrivilegedSidebarRole ||
      hasPermission(`${pathPrefix}/attendance`, 'any') ||
      hasPermission('/hr/attendance', 'any') ||
      hasPermission('/tenant/attendance', 'any') ||
      hasPermission('attendance.dashboard', 'any');

    (dynamicModules || []).forEach((mod, index) => {
      const lowCaseName = (mod.name || "").toLowerCase();

      const modCode = resolveModuleCodeForNav(mod);
      const isCore = false;
      if (modCode && !isCore && !hasModuleAccess(modCode)) {
        // Attendance should still be visible if the user has permission,
        // even when module toggles are misconfigured.
        if (!(modCode === 'attendance' && canAttendance)) return;
      }

      const filteredPages = (mod.pages || []).map(page => {
        const children = (page.children || page.subItems || []).filter(child =>
          !child.permissionKey || hasPermission(child.permissionKey, 'any')
        );
        return { ...page, children };
      }).filter(page => {
        // Keep Reports in its original position
        if (page.name === 'Reports' || page.label === 'Reports') {
          // No-op, just keep it
        }

        const hasChildren = page.children.length > 0;

        if (!page.route && !page.isExternal && !hasChildren) return false;

        // USER REQUEST: Strictly enforce RBAC for all users.
        // Even privileged roles must have the explicit permission to see the page.
        if (page.permissionKey && !hasPermission(page.permissionKey, 'any')) {
          return false;
        }

        if (hasChildren && !page.permissionKey) {
          return hasChildren;
        }

        return true;
      });

      if (filteredPages.length === 0 && !mod.isPlaceholder) return;

      const rawModName = (mod.name || "").trim().toLowerCase();
      let moduleDisplayName = mod.name;

      // Unify variants for both sidebar display and grouping logic
      if (rawModName === 'overview') return; // Handled manually
      if (rawModName === 'people' || rawModName === 'employee' || rawModName === 'employees') {
        moduleDisplayName = 'Employee';
      } else if (rawModName === 'leave') {
        moduleDisplayName = 'Policy';
      } else if (rawModName === 'access control') {
        moduleDisplayName = 'Access';
      } else if (rawModName === 'support' || rawModName === 'ticket inbox' || rawModName === 'tickets') {
        moduleDisplayName = 'Ticket Inbox';
        if (rawModName !== 'emp service') hasSupportModule = true;
      }

      // USER REQUEST: Extra safety for HR Dashboard appearing without access.
      // Strictly rely on permissions, ignoring the user's role.
      if (moduleDisplayName.toLowerCase().includes('hr dashboard')) {
        if (!hasPermission('overview.dashboard', 'any')) return;
      }

      if (moduleDisplayName === 'Reports') {
        hasReportsModule = true;
      }

      if ((mod.name || "").toLowerCase().trim() === 'emp service') {
        hasEmpServiceModule = true;
      }

      const modulePages = filteredPages;

      sections.push({
        id: `${mod._id ? (typeof mod._id === 'object' ? (mod._id.$oid || JSON.stringify(mod._id)) : String(mod._id)) : (mod.moduleName || 'module')}-${index}`,
        title: (mod.name || "").toLowerCase().trim() === 'emp service' ? 'EMPLOYEE' : 'MANAGEMENT',
        moduleName: moduleDisplayName,
        icon: mod.icon,
        items: modulePages.map(p => {
          const children = p.children || [];
          const rawRoute = p.route || (children.length > 0 ? children[0].route || children[0].to : '') || '';
          let finalRoute = rawRoute;

          // Map employee-centric routes to the current panel prefix (HR/Tenant/Employee)
          // This ensures that when an HR is viewing their own records, they stay within the HR layout.
          const ESS_MAP = {
            'dashboard': 'my-dashboard',
            'attendance': 'my-attendance',
            'payslips': 'my-payslips',
            'payslip': 'my-payslips',
            'documents': 'my-documents',
            'my-documents': 'my-documents',
            'my documents': 'my-documents',
            'internal-jobs': 'internal-jobs',
            'internal jobs': 'internal-jobs',
            'exit': 'resignation',
            'resignation': 'resignation',
            'offboarding': 'resignation',
            'support': 'support-center',
            'tickets': 'support-center',
            'support-center': 'support-center',
            'support center': 'support-center'
          };

          // If the route looks like an employee route (starts with /employee/ or is in our map)
          // we force it to use the current pathPrefix.
          // Normalize slug: remove common prefixes, spaces, and handle URL encoding
          let slug = rawRoute
            .replace('/employee/', '')
            .replace('/hr/', '')
            .replace('/tenant/', '')
            .replace(/^\//, '')
            .replace(/%20/g, ' ')
            .trim()
            .toLowerCase();

          if (mod.name === 'emp service' || rawRoute.startsWith('/employee/')) {
            const target = ESS_MAP[slug] || slug;
            // Ensure no spaces in the final URL
            finalRoute = `${pathPrefix}/${target.replace(/\s+/g, '-')}`;
          } else if (slug === 'attendance' || slug === 'attendance ') {
            // Force management attendance dashboard for the management module
            finalRoute = `${pathPrefix}/attendance`;
          } else if (rawRoute) {
            // General management route cleanup
            finalRoute = `${pathPrefix}/${slug.replace(/\s+/g, '-')}`;
          }

          return {
            label: ['Resignation', 'Exit Management', 'Exit'].includes(p.name || p.label) ? 'Resignation' :
              ['Support Center', 'Support'].includes(p.name || p.label) ? 'Support Center' :
                (p.name || p.label),
            to: finalRoute,
            icon: ICONS[p.icon] || <LayoutDashboard size={ICON_SIZE} />,
            isExternal: p.isExternal,
            permissionKey: p.permissionKey, // Ensure permissionKey is passed
            children: children
          };
        })
      });
    });

    // If "Support" was NOT found in dynamic modules, manually inject "Ticket Inbox" (Admin Inbox)
    if (!hasSupportModule) {
      const canSupport = isPrivilegedSidebarRole || hasPermission('/hr/tickets', 'any') || hasPermission('support.tickets', 'any') || hasPermission('support.view', 'any');
      if (canSupport && hasCompanyModule('hr')) {
        sections.push({
          id: 'manual-support',
          title: 'MANAGEMENT',
          moduleName: 'Ticket Inbox',
          icon: 'support',
          items: [{
            label: 'Ticket Inbox',
            to: `${pathPrefix}/tickets`,
            icon: ICONS.support,
            permissionKey: 'support.tickets',
            children: []
          }]
        });
      }
    }

    // Ensure legacy primary modules remain visible in sidebar (old style expected by users).
    const ensureSingleModule = (moduleName, to, icon, moduleCode, permissionKey, matchPaths = []) => {
      const exists = sections.some(s => s.moduleName === moduleName);
      if (exists) return;
      const allowedByPerm = !permissionKey || hasPermission(permissionKey, 'any');
      // Primary filter is RBAC. We don't bypass for privileged roles anymore for visibility.
      const allowedByModule = !moduleCode || hasModuleAccess(moduleCode);
      if (!allowedByPerm || !allowedByModule) return;

      sections.push({
        id: `manual-${moduleName.toLowerCase().replace(/\s+/g, '-')}`,
        title: 'MANAGEMENT',
        moduleName,
        icon,
        items: [{ label: moduleName, to, icon: ICONS[icon] || <LayoutDashboard size={ICON_SIZE} />, children: [], matchPaths }]
      });
    };

    // Dashboard should ALWAYS be the first item in HR panel when permitted.
    ensureSingleModule('Dashboard', `${pathPrefix}/dashboard`, 'dashboard', 'hr', 'overview.dashboard');
    ensureSingleModule('Access', `${pathPrefix}/access`, 'access', 'accessControl', 'configuration.access');
    ensureSingleModule('Employee', `${pathPrefix}/employees`, 'employees', 'hr', 'people.employees');
    ensureSingleModule('Attendance', `${pathPrefix}/attendance`, 'attendance', 'attendance', 'attendance.dashboard');
    
    // Force Policy visibility
    const policyExists = sections.some(s => s.moduleName === 'Policy');
    if (!policyExists) {
      sections.push({
        id: 'manual-policy',
        title: 'MANAGEMENT',
        moduleName: 'Policy',
        icon: 'leaveRequests',
        items: [{ 
          label: 'Policy', 
          to: `${pathPrefix}/leave-approvals`, 
          icon: ICONS.leaveRequests, 
          children: [], 
          matchPaths: [`${pathPrefix}/leave-approvals`, `${pathPrefix}/leave-policies`, `${pathPrefix}/organization-policies`] 
        }]
      });
    }

    ensureSingleModule('Payroll', `${pathPrefix}/payroll/dashboard`, 'payrollDashboard', 'payroll', 'payroll.stats');
    ensureSingleModule(
      'Hiring',
      `${pathPrefix}/requirements`,
      'requirements',
      'recruitment',
      'hiring.jobList',
      [
        `${pathPrefix}/requirements`,
        `${pathPrefix}/create-requirement`,
        `${pathPrefix}/applicants`,
        `${pathPrefix}/internal-applicants`,
        `${pathPrefix}/candidate-status`,
        `${pathPrefix}/positions`,
        `${pathPrefix}/offer-templates`,
        `${pathPrefix}/offers-joining`,
        `${pathPrefix}/job/`
      ]
    );
    ensureSingleModule('Onboarding', `${pathPrefix}/onboarding/dashboard`, 'onboarding', 'onboarding', 'onboarding.dashboard');
    ensureSingleModule('BGV', `${pathPrefix}/bgv`, 'bgv', 'backgroundVerification', 'bgv.caseMaster');
    ensureSingleModule(
      'Documents',
      `${pathPrefix}/letters`,
      'templates',
      'documentManagement',
      'documents.dashboard',
      [
        `${pathPrefix}/letters`,
        `${pathPrefix}/letter-templates`,
        `${pathPrefix}/letter-settings`,
        `${pathPrefix}/payslip-templates`
      ]
    );
    ensureSingleModule('Settings', `${pathPrefix}/settings/company`, 'company', 'hr', 'configuration.company');
    ensureSingleModule('Social Media', `${pathPrefix}/settings/social-media`, 'social', 'socialMediaIntegration', 'socialMedia.dashboard');
    ensureSingleModule('Portals', `${pathPrefix}/career-builder`, 'viewCareers', 'employeePortal', 'portals.careerPage');
    ensureSingleModule('Ticket Inbox', `${pathPrefix}/tickets`, 'support', 'hr', 'support.tickets');
    ensureSingleModule('Reports', `${pathPrefix}/reports`, 'history', 'reports', 'reports.staffing');
    ensureSingleModule('Offboarding', `${pathPrefix}/exit-management`, 'exit', 'hr', 'offboarding.exit');
    ensureSingleModule('Organization', `${pathPrefix}/organization`, 'organization', 'hr', 'people.org');

    // Ensure EMP Service pages exist in HR sidebar (7 ESS pages)
    if (!hasEmpServiceModule && hasCompanyModule('employeePortal')) {
      const essItems = [
        { label: 'Dashboard', to: `${pathPrefix}/my-dashboard`, icon: ICONS.dashboard, permissionKey: 'employee.dashboard', children: [] },
        { label: 'My Attendance', to: `${pathPrefix}/my-attendance`, icon: ICONS.attendance, permissionKey: 'employee.attendance', children: [] },
        { label: 'My Payslips', to: `${pathPrefix}/my-payslips`, icon: ICONS.payslips, permissionKey: 'employee.payslips', children: [] },
        { label: 'My Documents', to: `${pathPrefix}/my-documents`, icon: ICONS.templates, permissionKey: 'employee.documents', children: [] },
        { label: 'Internal Jobs', to: `${pathPrefix}/internal-jobs`, icon: ICONS.requirements, permissionKey: 'employee.jobs', children: [] },
        { label: 'Support Center', to: `${pathPrefix}/support-center`, icon: ICONS.support, permissionKey: 'employee.tickets', children: [] },
        { label: 'Resignation', to: `${pathPrefix}/resignation`, icon: ICONS.exit, permissionKey: 'employee.exit', children: [] },
      ].filter((item) => hasPermission(item.permissionKey, 'any'));

      if (essItems.length > 0) {
        sections.push({
          id: 'manual-emp-service',
          title: 'EMPLOYEE',
          moduleName: 'emp service',
          icon: 'dashboard',
          items: essItems
        });
      }
    }

    // Explicitly add Reports if not found dynamically (Dashboard is already ensured via ensureSingleModule above).
    const canRep = hasPermission('/hr/reports', 'any') || hasPermission('overview.reports', 'any');
    const hasDashSection = sections.some((s) => s.moduleName === 'Dashboard');

    // Safety: if something upstream removed Dashboard, add it once.
    if (!hasDashSection) {
      ensureSingleModule('Dashboard', `${pathPrefix}/dashboard`, 'dashboard', 'hr', 'overview.dashboard');
    }

    if (canRep && hasCompanyModule('reports') && !hasReportsModule && !sections.some((s) => s.moduleName === 'Reports')) {
      sections.push({
        id: 'manual-reports-section',
        title: 'MANAGEMENT',
        moduleName: 'Reports',
        icon: 'history',
        items: [{ label: 'Reports', to: `${pathPrefix}/reports`, icon: <LayoutDashboard size={ICON_SIZE} />, permissionKey: 'overview.reports', children: [] }]
      });
    }

    // Sort sections matching the Access Grid order (with Dashboard first)
    // User-requested strict order for MANAGEMENT modules
    // Use the dynamic sidebarOrder state with a fallback array to prevent crashes
    const order = (sidebarOrder && Array.isArray(sidebarOrder)) ? sidebarOrder : [];

    sections.sort((a, b) => {
      const idxA = typeof order.indexOf === 'function' ? order.indexOf(a.moduleName) : -1;
      const idxB = typeof order.indexOf === 'function' ? order.indexOf(b.moduleName) : -1;

      const hasA = (idxA > -1);
      const hasB = (idxB > -1);

      if (hasA && hasB) return idxA - idxB;
      if (hasA) return -1;
      if (hasB) return 1;

      return 0;
    });

    const groups = sections.reduce((acc, s) => {
      acc[s.title] = acc[s.title] || [];
      acc[s.title].push(s);
      return acc;
    }, {});

    // RE-ORDER MANAGEMENT: Ensure "Dashboard" (formerly Overview) is FIRST
    if (groups['MANAGEMENT']) {
      const dashboardIdx = groups['MANAGEMENT'].findIndex(m => m.moduleName === 'Dashboard');
      if (dashboardIdx > -1) {
        const [dash] = groups['MANAGEMENT'].splice(dashboardIdx, 1);
        groups['MANAGEMENT'].unshift(dash);
      }
    }

    // Use the sectionOrder state to determine group sequence
    const orderedGroups = {};
    const keys = Object.keys(groups).sort((a, b) => {
      const idxA = sectionOrder.indexOf(a);
      const idxB = sectionOrder.indexOf(b);
      // Fallback: MANAGEMENT = 0, others = high number
      const valA = idxA > -1 ? idxA : (a === 'MANAGEMENT' ? 0 : 99);
      const valB = idxB > -1 ? idxB : (b === 'MANAGEMENT' ? 0 : 99);
      return valA - valB;
    });
    keys.forEach(k => orderedGroups[k] = groups[k]);

    return Object.fromEntries(
      Object.entries(orderedGroups).map(([title, mods]) => [
        title,
        mods.filter(m => m.moduleName === 'Policy' || !hiddenModules.includes(m.moduleName))
      ])
    );
  }, [dynamicModules, hasPermission, pathPrefix, isPrivilegedSidebarRole, hasCompanyModule, hasModuleAccess, resolveModuleCodeForNav, sidebarOrder, sectionOrder, hiddenModules]);


  const orderedNavSections = navSections;
  const autoExpandedGroups = useMemo(() => {
    if (!navSections || typeof navSections !== 'object') return {};

    const initialExpanded = {};
    Object.values(navSections).forEach((mods) => {
      (mods || []).forEach((mod) => {
        if (mod?.items?.length > 1 && mod?.title !== 'EMPLOYEE') {
          initialExpanded[mod.id] = true;
        }
      });
    });

    return initialExpanded;
  }, [navSections]);
  const resolvedExpandedGroups =
    Object.keys(expandedGroups).length > 0 ? expandedGroups : autoExpandedGroups;

  const sidebarThemeClass = !sidebarStyles.bg ? 'border-slate-200 bg-white text-slate-900' : 'border-slate-200';





  return (
    <aside
      className={`flex h-full flex-col border-r transition-all duration-300 ${collapsed ? 'w-[80px]' : 'w-[200px]'}`}
      style={{
        backgroundColor: 'var(--hr-sidebar-bg)',
        color: 'var(--hr-sidebar-text)',
        borderColor: 'rgba(0,0,0,0.05)'
      }}
    >
      <div
        className={`flex shrink-0 items-center border-b border-slate-100 pt-4 px-4 pb-[13px] ${collapsed ? 'justify-center' : 'gap-3'}`}
      >
        <div
          onClick={() => navigate(`${pathPrefix}/dashboard`)}
          className={`flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:bg-slate-50 ${collapsed ? 'h-10 w-10' : ''}`}
        >
          <img
            src={tenantLogoSrc}
            alt="Logo"
            className="h-full w-full object-contain"
            onError={(event) => {
              if (!event.currentTarget.dataset.fallbackLogo) {
                event.currentTarget.dataset.fallbackLogo = 'true';
                event.currentTarget.src = logonew;
              }
            }}
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold" style={{ color: 'var(--hr-sidebar-text)' }}>{tenant?.companyName || tenant?.name || 'HRMS'}</h2>

          </div>
        )}
      </div>

      <div
        className="hr-sidebar-scroll flex-1 overflow-y-auto px-2 py-4"
      >
        {Object.entries(orderedNavSections).map(([title, mods]) => (
          <div key={title} className="mb-0.5 last:mb-0">
            <div className="space-y-0">
              {mods.map(mod => (
                <div
                  key={mod.id}
                >
                  {mod.items.length > 1 && mod.title !== 'EMPLOYEE' ? (
                    <div className="mb-1">
                      <button
                        onClick={() => setExpandedGroups(p => ({ ...p, [mod.id]: !resolvedExpandedGroups[mod.id] }))}
                        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-1 transition-all ${collapsed ? 'justify-center' : ''}`}
                        style={{
                          backgroundColor: resolvedExpandedGroups[mod.id] ? (sidebarStyles.bg ? 'rgba(0,0,0,0.05)' : '#f8fafc') : 'transparent',
                          color: sidebarStyles.text || undefined
                        }}
                      >
                        <div className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${resolvedExpandedGroups[mod.id] ? (sidebarStyles.bg ? 'border-white/20 bg-white/10 text-white' : 'border-sky-100 bg-white shadow-sm text-sky-600') : (sidebarStyles.bg ? 'border-white/10 bg-black/5' : 'border-slate-100 bg-slate-50')
                          }`}>
                          {ICONS[mod.icon] || <LayoutDashboard size={14} />}
                        </div>
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate text-[13px] font-semibold" style={{ color: sidebarStyles.text || '#334155' }}>{mod.moduleName}</span>
                            <ChevronDown size={12} className="opacity-40 transition-transform duration-200" style={{ transform: resolvedExpandedGroups[mod.id] ? 'rotate(180deg)' : 'none', color: sidebarStyles.text || '#94a3b8' }} />
                          </>
                        )}
                      </button>

                      {!collapsed && resolvedExpandedGroups[mod.id] && (
                        <div className="ml-5 mt-0 space-y-0 border-l border-slate-100 pl-3">
                          {mod.items.map((item, idx) => {
                            const hasChildren = item.children && item.children.length > 0;
                            const isChildExpanded = Boolean(resolvedExpandedGroups[`${mod.id}-${idx}`]);
                            const publicUrl = tenant?.code ? `/jobs/${tenant.code}` : null;

                            return (
                              <div key={idx} className="space-y-0.5">
                                {hasChildren ? (
                                  <>
                                    <button
                                      onClick={() => setExpandedGroups(p => ({ ...p, [`${mod.id}-${idx}`]: !isChildExpanded }))}
                                      className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 transition text-[12px]"
                                      style={{
                                        color: (matchesAnyPath(location.pathname, [item.to]) || isChildExpanded) ? (sidebarStyles.text || '#0369a1') : (sidebarStyles.text || '#94a3b8'),
                                        fontWeight: (matchesAnyPath(location.pathname, [item.to]) || isChildExpanded) ? 'bold' : 'normal'
                                      }}
                                    >
                                      <div className={`w-1 h-1 rounded-full ${isChildExpanded ? (sidebarStyles.active || 'bg-sky-500') : 'bg-slate-300'}`} />
                                      <span className="flex-1 text-left">{item.label}</span>
                                      <ChevronDown size={10} className={`text-slate-400 transition-transform ${isChildExpanded ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isChildExpanded && (
                                      <div className="ml-4 mt-1 space-y-0.5 border-l border-slate-50 pl-2">
                                        {item.children.map((child, cIdx) => (
                                          <NavLink
                                            key={cIdx}
                                            to={child.route || child.to}
                                            className="flex items-center gap-2 rounded-lg px-3 py-1 transition text-[11px]"
                                            style={{
                                              backgroundColor: matchesAnyPath(location.pathname, [child.route || child.to]) ? 'var(--hr-sidebar-active)' : 'transparent',
                                              color: 'var(--hr-sidebar-text)',
                                              fontWeight: matchesAnyPath(location.pathname, [child.route || child.to]) ? 'bold' : 'normal'
                                            }}
                                          >
                                            {child.name || child.label}
                                          </NavLink>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                ) : item.isExternal ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (publicUrl) window.open(publicUrl, '_blank', 'noopener,noreferrer');
                                    }}
                                    disabled={!publicUrl}
                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left transition text-[12px]"
                                    style={{
                                      color: 'var(--hr-sidebar-text)',
                                    }}
                                  >
                                    <div className="w-1 h-1 rounded-full opacity-40" style={{ backgroundColor: 'var(--hr-sidebar-text)' }} />
                                    {item.label}
                                  </button>
                                ) : (
                                  <NavLink
                                    to={item.to}
                                    className="flex items-center gap-2 rounded-lg px-3 py-1 transition text-[12px]"
                                    style={{
                                      backgroundColor: matchesAnyPath(location.pathname, [item.to]) ? 'var(--hr-sidebar-active)' : 'transparent',
                                      color: 'var(--hr-sidebar-text)',
                                      fontWeight: matchesAnyPath(location.pathname, [item.to]) ? 'bold' : 'normal'
                                    }}
                                  >
                                    <div className="w-1 h-1 rounded-full opacity-40" style={{ backgroundColor: 'var(--hr-sidebar-text)' }} />
                                    {item.label}
                                  </NavLink>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    mod.items.map((item, idx) => (
                      <NavLink
                        key={idx}
                        to={item.to}
                        style={{
                          backgroundColor: matchesAnyPath(location.pathname, item.matchPaths) ? 'var(--hr-sidebar-active)' : 'transparent',
                          color: 'var(--hr-sidebar-text)',
                          borderColor: matchesAnyPath(location.pathname, item.matchPaths) ? 'var(--hr-sidebar-active)' : 'transparent'
                        }}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-1 transition-all ${collapsed ? 'justify-center' : ''}`}
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition`}>
                          {item.icon}
                        </div>
                        {!collapsed && <span className="truncate text-sm font-semibold">{item.label}</span>}
                      </NavLink>
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className={`shrink-0 border-t border-slate-200 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}
      >
        {/* Collapsed Toggle icon removed as per user request */}
      </div>


    </aside>
  );
}

const styles = `
  .hr-sidebar-scroll::-webkit-scrollbar {
    display: none;
  }
  .hr-sidebar-scroll {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

const styleSheet = document.createElement("style");
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);
