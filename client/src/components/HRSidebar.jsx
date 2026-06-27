/* eslint-disable react-refresh/only-export-components */
/* ─── ICONS registry (same as Sidebar) ─── */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import logonew from '../assets/logonew.png';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import api, { resolveTenantLogoUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useModules } from '../hooks/useModules';
import { useRBAC } from '../context/RBACContext';
import { normalizeModuleCode } from '../utils/moduleConfig';
import { getScopedStorageKey } from '../utils/sidebarStorage';
import {
  EMPLOYEE_SECTION,
  EMPLOYEE_SELF_SERVICE_PAGES,
  MANAGEMENT_MODULES,
  MANAGEMENT_SECTION,
  MODULE_ORDER,
  MODULE_PERMISSION_PROBES,
  buildPath,
  getManagementModuleOrder,
  normalizeModuleDisplayName,
  resolveDynamicRoute,
  resolveModuleCode,
} from '../utils/hrmsNavigationHierarchy';
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
    return MODULE_ORDER;
  });

  const [sectionOrder, setSectionOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(sectionOrderKey);
      const parsed = saved ? JSON.parse(saved) : null;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
    return [MANAGEMENT_SECTION, EMPLOYEE_SECTION];
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

      const modCode = resolveModuleCode(mod);
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
      let moduleDisplayName = normalizeModuleDisplayName(mod.name);

      // Unify variants for both sidebar display and grouping logic
      if (rawModName === 'overview') return; // Handled manually
      if (rawModName === 'payroll' || rawModName === 'payroll system') return; // Custom handled manually
      if (rawModName === 'leave master') return; // Explicitly hidden/deleted per user request
      if (rawModName === 'support' || rawModName === 'ticket inbox' || rawModName === 'tickets') {
        if (rawModName !== 'emp service') hasSupportModule = true;
      }

      // USER REQUEST: Extra safety for HR Dashboard appearing without access.
      // Strictly rely on permissions, ignoring the user's role.
      if (moduleDisplayName.toLowerCase().includes('hr dashboard') || rawModName === 'overview') {
        if (!isPrivilegedSidebarRole && !hasPermission('overview.dashboard', 'any')) return;
      }

      // USER REQUEST: Hide Onboarding from standard employees
      if (rawModName.includes('onboarding') || moduleDisplayName.toLowerCase().includes('onboarding')) {
        if (!isPrivilegedSidebarRole && !hasPermission('onboarding.dashboard', 'any')) return;
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
        title: (mod.name || "").toLowerCase().trim() === 'emp service' ? EMPLOYEE_SECTION : MANAGEMENT_SECTION,
        moduleName: moduleDisplayName,
        icon: mod.icon,
        items: modulePages.map(p => {
          const children = p.children || [];
          const rawRoute = p.route || (children.length > 0 ? children[0].route || children[0].to : '') || '';
          let finalRoute = rawRoute;

          finalRoute = resolveDynamicRoute({ moduleName: mod.name, rawRoute, pathPrefix });

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
    const ensureSingleModule = ({ moduleName, route, icon, moduleCode, permissionKeys = [], matchRoutes = [] }) => {
      const exists = sections.some(s => s.moduleName === moduleName);
      if (exists) return;
      const keys = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys].filter(Boolean);
      const allowedByPerm = keys.length === 0 || keys.some((key) => hasPermission(key, 'any'));
      // Primary filter is RBAC. We don't bypass for privileged roles anymore for visibility.
      const allowedByModule = !moduleCode || hasModuleAccess(moduleCode);
      if (!allowedByPerm || !allowedByModule) return;
      const to = buildPath(pathPrefix, route);
      const matchPaths = matchRoutes.map((matchRoute) => buildPath(pathPrefix, matchRoute));

      if (moduleName === 'Payroll') {
        const subItems = [
          { label: 'Payroll Dashboard', to: buildPath(pathPrefix, 'payroll/dashboard'), permissionKey: 'payroll.stats' },
          { label: 'Payroll Process', to: buildPath(pathPrefix, 'payroll/process'), permissionKey: 'payroll.process' },
          { label: 'Employee Payroll', to: buildPath(pathPrefix, 'payroll/employee-payroll'), permissionKey: 'payroll.stats' },
          { label: 'Payslip', to: buildPath(pathPrefix, 'payroll/payslip-view'), permissionKey: 'payroll.payslips' },
          { label: 'Arrear / Onetime Payment', to: buildPath(pathPrefix, 'payroll/arrears'), permissionKey: 'payroll.process' },
          { label: 'Reimbursement', to: buildPath(pathPrefix, 'payroll/reimbursements'), permissionKey: 'payroll.process' },
          { label: 'Loan & Advance', to: buildPath(pathPrefix, 'payroll/loans'), permissionKey: 'payroll.process' },
          { label: 'Deduction Entry', to: buildPath(pathPrefix, 'payroll/deduction-entry'), permissionKey: 'payroll.salary' },
          { label: 'TDS Declaration', to: buildPath(pathPrefix, 'payroll/tds-declaration'), permissionKey: 'payroll.process' },
          { label: 'Other Earnings', to: buildPath(pathPrefix, 'payroll/other-earnings'), permissionKey: 'payroll.process' },
          { label: 'Payroll Reports', to: buildPath(pathPrefix, 'payroll/reports'), permissionKey: 'payroll.stats' },
          { label: 'Form 16', to: buildPath(pathPrefix, 'payroll/form16'), permissionKey: 'payroll.stats' },
          { label: 'Salary Revision', to: buildPath(pathPrefix, 'payroll/salary-revision'), permissionKey: 'payroll.compensation' }
        ];

        const filteredSubItems = subItems.filter(item => hasPermission(item.permissionKey, 'any')).map(item => ({
          label: item.label,
          to: item.to,
          icon: ICONS.dashboard,
          children: []
        }));

        sections.push({
          id: `manual-payroll`,
          title: MANAGEMENT_SECTION,
          moduleName: 'Payroll',
          icon: 'payrollDashboard',
          items: filteredSubItems,
          matchPaths: subItems.map(item => item.to)
        });
        return;
      }

      sections.push({
        id: `manual-${moduleName.toLowerCase().replace(/\s+/g, '-')}`,
        title: MANAGEMENT_SECTION,
        moduleName,
        icon,
        items: [{ label: moduleName, to, icon: ICONS[icon] || <LayoutDashboard size={ICON_SIZE} />, children: [], matchPaths }]
      });
    };

    // Dashboard should ALWAYS be the first item in HR panel when permitted.
    MANAGEMENT_MODULES.forEach((moduleConfig) => ensureSingleModule(moduleConfig));

    // Ensure EMP Service pages exist in HR sidebar (7 ESS pages)
    if (!hasEmpServiceModule && hasCompanyModule('employeePortal')) {
      const essItems = EMPLOYEE_SELF_SERVICE_PAGES
        .map((page) => ({
          label: page.title,
          to: buildPath(pathPrefix, page.managementRoute),
          icon: ICONS[page.icon] || ICONS.dashboard,
          permissionKey: page.permissionKey,
          children: [],
        }))
        .filter((item) => hasPermission(item.permissionKey, 'any'));

      if (essItems.length > 0) {
        sections.push({
          id: 'manual-emp-service',
          title: EMPLOYEE_SECTION,
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
      const dashboardModule = MANAGEMENT_MODULES.find((moduleConfig) => moduleConfig.moduleName === 'Dashboard');
      if (dashboardModule) ensureSingleModule(dashboardModule);
    }

    if (canRep && hasCompanyModule('reports') && !hasReportsModule && !sections.some((s) => s.moduleName === 'Reports')) {
      sections.push({
        id: 'manual-reports-section',
        title: MANAGEMENT_SECTION,
        moduleName: 'Reports',
        icon: 'history',
        items: [{ label: 'Reports', to: buildPath(pathPrefix, 'reports'), icon: <LayoutDashboard size={ICON_SIZE} />, permissionKey: 'overview.reports', children: [] }]
      });
    }

    // Sort sections matching the Access Grid order (with Dashboard first)
    // User-requested strict order for MANAGEMENT modules
    // Use the dynamic sidebarOrder state with a fallback array to prevent crashes
    const order = getManagementModuleOrder(sidebarOrder);

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
    if (groups[MANAGEMENT_SECTION]) {
      const dashboardIdx = groups[MANAGEMENT_SECTION].findIndex(m => m.moduleName === 'Dashboard');
      if (dashboardIdx > -1) {
        const [dash] = groups[MANAGEMENT_SECTION].splice(dashboardIdx, 1);
        groups[MANAGEMENT_SECTION].unshift(dash);
      }
    }

    // Use the sectionOrder state to determine group sequence
    const orderedGroups = {};
    const keys = Object.keys(groups).sort((a, b) => {
      const idxA = sectionOrder.indexOf(a);
      const idxB = sectionOrder.indexOf(b);
      // Fallback: management first, others after.
      const valA = idxA > -1 ? idxA : (a === MANAGEMENT_SECTION ? 0 : 99);
      const valB = idxB > -1 ? idxB : (b === MANAGEMENT_SECTION ? 0 : 99);
      return valA - valB;
    });
    keys.forEach(k => orderedGroups[k] = groups[k]);

    return Object.fromEntries(
      Object.entries(orderedGroups).map(([title, mods]) => [
        title,
        mods.filter(m => !hiddenModules.includes(m.moduleName))
      ])
    );
  }, [dynamicModules, hasPermission, pathPrefix, isPrivilegedSidebarRole, hasCompanyModule, hasModuleAccess, sidebarOrder, sectionOrder, hiddenModules]);


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
