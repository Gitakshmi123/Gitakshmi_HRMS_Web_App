import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Banknote,
  Files,
  UserMinus,
  LayoutDashboard,
  Clock,
  CreditCard,
  LifeBuoy,
  FileText,
  Briefcase,
  ChevronDown,
  Menu,
  Users,
  Building2,
  Lock,
  LogOut,
  BarChart,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Gavel,
  History,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRBAC } from '../context/RBACContext';
import api, { API_ROOT, resolveTenantLogoUrl } from '../utils/api';
import logoNew from '../assets/logonew.png';
import { useModules } from '../hooks/useModules';
import { getRoleRoute } from '../utils/navigation';
import { getScopedStorageKey } from '../utils/sidebarStorage';
import { isPrivilegedManagementRole } from '../utils/employeeAccess';
import {
  EMPLOYEE_SELF_SERVICE_PAGES,
  EMPLOYEE_TO_MANAGEMENT_PERMISSION_FALLBACK,
  MANAGEMENT_MODULES,
  MODULE_ORDER,
  buildPath,
} from '../utils/hrmsNavigationHierarchy';


const getStaticPages = (pathPrefix, isManagement = false) => {
  const isEss = pathPrefix === '/employee';

  const iconMap = {
    dashboard: <LayoutDashboard size={16} />,
    attendance: <Clock size={16} />,
    payslips: <Banknote size={16} />,
    templates: <Files size={16} />,
    requirements: <Briefcase size={16} />,
    employees: <Users size={16} />,
    support: <LifeBuoy size={16} />,
    exit: <UserMinus size={16} />,
  };

  return EMPLOYEE_SELF_SERVICE_PAGES.map((page) => {
    const route = isEss && !isManagement ? page.route : page.managementRoute;
    return {
      id: page.id,
      title: page.title,
      icon: iconMap[page.icon] || iconMap.dashboard,
      path: buildPath(pathPrefix, route),
      permissionKey: page.permissionKey,
    };
  });
};

export default function EmployeeSidebar({
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  onClose,
  isCollapsed,
  toggleCollapse,
  userProfile,
  fullName: propFullName,
  employeeId,
  isOnboarding = false,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, enabledModules } = useAuth();
  const { permRole, hasPermission, permMap, loading: rbacLoading } = useRBAC();
  const { modules: dynamicModules, loading: modulesLoading } = useModules();
  
  const [activeTab, setActiveTabInternal] = useState(propActiveTab || 'dashboard');
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [tenant, setTenant] = useState(null);
  let hasSupportModule = false;
  let hasDashboardModule = false;
  let hasReportsModule = false;


  const fullName = propFullName || 'Employee';

  const sidebarOrderKey = useMemo(() => 
    getScopedStorageKey('hrms:sidebar:order:v1', { user, panel: 'employee' }), 
  [user]);
  
  const [sidebarOrder, setSidebarOrder] = useState(() => {
    try {
      const saved = localStorage.getItem(sidebarOrderKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return null;
  });

  const hiddenModulesKey = useMemo(() => 
    getScopedStorageKey('hrms:sidebar:hidden:v1', { user, panel: 'employee' }), 
  [user]);
  
  const [hiddenModules, setHiddenModules] = useState(() => {
    try {
      const saved = localStorage.getItem(hiddenModulesKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    const handleOrderChange = () => {
      try {
        const saved = localStorage.getItem(sidebarOrderKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setSidebarOrder(parsed);
        }
        
        const savedHidden = localStorage.getItem(hiddenModulesKey);
        if (savedHidden) {
          const parsed = JSON.parse(savedHidden);
          if (Array.isArray(parsed)) setHiddenModules(parsed);
        }
      } catch (e) {}
    };
    window.addEventListener('hrms:sidebar:order:changed', handleOrderChange);
    return () => window.removeEventListener('hrms:sidebar:order:changed', handleOrderChange);
  }, [sidebarOrderKey, hiddenModulesKey]);

  const currentPathPrefix = location.pathname.startsWith('/tenant') ? '/tenant' : 
                    location.pathname.startsWith('/hr') ? '/hr' : '/employee';
  
  const pathPrefix = currentPathPrefix;

  const handleTabClick = (id, path) => {
    // Special handling for Public Careers Page
    if (path?.endsWith('/public-page') || id?.includes('publicPage')) {
      (async () => {
        try {
          const res = await api.get('/tenants/me');
          const tenantCode = String(res?.data?.code || '').trim();
          const tenantId = String(
            res?.data?._id || res?.data?.id || res?.data?.tenantId || ''
          ).trim();
          if (tenantCode) {
            const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
            window.open(`/jobs/${encodeURIComponent(tenantCode)}${query}`, '_blank', 'noopener,noreferrer');
            return;
          }
        } catch (_e) {
          // ignore and use fallback below
        }

        const fallbackCode = String(user?.companyCode || '').trim();
        if (fallbackCode) {
          window.open(`/jobs/${encodeURIComponent(fallbackCode)}`, '_blank', 'noopener,noreferrer');
        }
      })();
      return;
    }

    let targetPath = path;
    if (!targetPath) {
        targetPath = getRoleRoute(id, user?.role);
    }
    
    navigate(targetPath);
    setActiveTabInternal(id);
    if (propSetActiveTab) propSetActiveTab(id);
    if (onClose) onClose();
  };

  const currentRole = permRole || user?.roleName || user?.role || '';
  const allowManagementFallbackForEss = isPrivilegedManagementRole(currentRole);
  // Removed isAll for strict granular RBAC

  const ICONS_LOCAL = {
    dashboard: <LayoutDashboard size={20} />,
    attendance: <Clock size={20} />,
    payslips: <FileText size={20} />,
    templates: <FileText size={20} />,
    requirements: <Briefcase size={20} />,
    social: <LifeBuoy size={20} />,
    history: <LogOut size={20} />,
    employees: <Users size={20} />,
    salaryComponents: <CreditCard size={20} />,
    leaveRequests: <Building2 size={20} />,
    settings: <LifeBuoy size={20} />,
    customization: <LayoutDashboard size={20} />,
    org: <Users size={20} />,
    bgv: <Briefcase size={20} />,
    email: <FileText size={20} />,
    process: <Clock size={20} />,
    compensation: <CreditCard size={20} />,
    payslipDesign: <FileText size={20} />,
    applicants: <Users size={20} />,
    tracker: <Briefcase size={20} />,
    viewCareers: <LifeBuoy size={20} />,
    'ticket-inbox': <LifeBuoy size={20} />,
    support: <LifeBuoy size={20} />,
    Reports: <BarChart size={20} />,
    access: <Lock size={20} />,
    onboarding: <Users size={20} />,
    organization: <Building2 size={20} />,
    offboarding: <LogOut size={20} />,
    leavePolicies: <Gavel size={20} />,
    approvals: <History size={20} />,
  };

  const managementPrefix = (currentPathPrefix.startsWith('/employee')) ? '/employee' : currentPathPrefix;

  const { employeeSections, managementSections, orgSection, dashSection } = useMemo(() => {
    const STATIC_PAGES = getStaticPages(pathPrefix, allowManagementFallbackForEss);

    const getPermEntryStrict = (key) => {
      if (!key || !permMap) return null;
      if (permMap[key]) return permMap[key];
      const lowered = String(key).toLowerCase();
      const matched = Object.keys(permMap).find((k) => String(k).toLowerCase() === lowered);
      return matched ? permMap[matched] : null;
    };
    const hasStrictPermission = (key, action = 'view') => {
      const entry = getPermEntryStrict(key);
      if (!entry || typeof entry !== 'object') return false;
      const act = String(action || 'view').toLowerCase();
      if (act === 'any') return Object.values(entry).some((v) => v === true);
      return entry[act] === true;
    };
    const hasAnyPermission = (keys = []) => keys.some((k) => hasPermission(k, 'any'));
    const hasEmployeeAccessWithFallback = (employeePermissionKey) => {
      // 1. If user has explicit permission entry for this key, return its value strictly.
      // This ensures that if access is explicitly set to FALSE, we don't fall back.
      if (hasExplicitPermissionEntry(employeePermissionKey)) {
        return hasStrictPermission(employeePermissionKey, 'any');
      }

      // 2. Otherwise, check for general hasPermission (which might handle aliases)
      if (hasPermission(employeePermissionKey, 'any')) {
        return true;
      }

      // 3. Fallback to management permissions ONLY if allowManagementFallbackForEss is enabled
      // and user doesn't have a strict 'deny' on the employee key.
      if (!allowManagementFallbackForEss) {
        return false;
      }

      return hasAnyPermission(EMPLOYEE_TO_MANAGEMENT_PERMISSION_FALLBACK[employeePermissionKey] || []);
    };
    const hasExplicitPermissionEntry = (key) => {
      if (!key || !permMap) return false;
      const lowered = String(key).toLowerCase();
      if (permMap[key]) return true;
      return Object.keys(permMap).some((k) => String(k).toLowerCase() === lowered);
    };
    // Initial static items: some might be visible by hardcoded key, others will be activated by dynamic match
    const staticItems = STATIC_PAGES.map(p => ({
        id: p.id,
        title: p.title,
        icon: p.icon,
        path: p.path,
        permissionKey: p.permissionKey,
        visible: (() => {
          // In ESS panel, allow access from explicit employee key OR mapped management keys.
          // This keeps employee sidebar dynamic even when only management permissions are granted.
          if (currentPathPrefix.startsWith('/employee')) {
            return hasEmployeeAccessWithFallback(p.permissionKey || p.path);
          }
          // Outside ESS panel, keep explicit employee keys strict.
          if (hasExplicitPermissionEntry(p.permissionKey)) {
            return hasStrictPermission(p.permissionKey, 'any');
          }
          // Backward compatibility: only when employee.* key is missing.
          return (
            hasPermission(p.permissionKey || p.path, 'view') ||
            hasAnyPermission(EMPLOYEE_TO_MANAGEMENT_PERMISSION_FALLBACK[p.permissionKey] || [])
          );
        })()
    }));

    const employeeItems = [];
    const management = [];

    // Ensure legacy management modules are visible based on explicit page permission.
    const ensureManagementModule = ({ moduleName, route, employeeRoute, icon, permissionKeys = [], moduleCode = null }) => {
      const category = moduleName;
      const path = buildPath(managementPrefix, currentPathPrefix.startsWith('/employee') ? (employeeRoute || route) : route);
      const resolvedIcon = ICONS_LOCAL[icon] || ICONS_LOCAL.dashboard;
      const exists = management.some((m) => String(m.category || '').toLowerCase() === String(category).toLowerCase());
      if (exists) return;
      
      // Strict Module Enablement Check
      if (moduleCode && enabledModules) {
        const keys = Array.isArray(moduleCode) ? moduleCode : [moduleCode];
        const isEnabled = keys.some(k => enabledModules[k] === true || enabledModules[k] === 'true');
        if (!isEnabled) return;
      }

      const keyList = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];
      // Check for explicit permission key first (this is the most reliable way)
      const hasKeyPermission = keyList.some((key) => hasPermission(key, 'any'));
      // Check for route permission as fallback
      const hasRoutePermission = hasPermission(path, 'any');
      
      let allowed = hasKeyPermission || hasRoutePermission;
      
      if (!allowed) return;

      management.push({
        id: `manual-${category.toLowerCase().replace(/\s+/g, '-')}`,
        category,
        items: [{ id: `manual-${category.toLowerCase().replace(/\s+/g, '-')}-item`, title: category, icon: resolvedIcon, path }]
      });
    };

    // Ensure management modules are populated even if dynamic modules are still loading or empty
    MANAGEMENT_MODULES.forEach((moduleConfig) => ensureManagementModule(moduleConfig));

    if (dynamicModules && dynamicModules.length > 0) {
      dynamicModules.forEach(mod => {
      let moduleDisplayName = mod.name;
      // Removed redundant Document module block to support granular RBAC for administrators
      if (moduleDisplayName === 'Overview') return;

      if (moduleDisplayName === 'People') moduleDisplayName = 'Employee';
      if (moduleDisplayName === 'Leave') moduleDisplayName = 'Policy';
      if (moduleDisplayName === 'Access Control') moduleDisplayName = 'Access';
      if (moduleDisplayName === 'emp service') moduleDisplayName = 'Employee';
      if (moduleDisplayName === 'Support' || moduleDisplayName === 'Ticket Inbox') {
        moduleDisplayName = 'Ticket Inbox';
        if (mod.name !== 'emp service') {
          hasSupportModule = true;
        }
      }
      if (moduleDisplayName === 'Personnel Reports' || moduleDisplayName === 'System Reports' || moduleDisplayName === 'Analytical Reports') {
        moduleDisplayName = 'Reports';
      }

      const isEmployeeModule = (mod.name.toLowerCase().includes('employee') || mod.name === 'emp service') && 
                               !['people', 'hr management'].includes((mod.moduleKey || '').toLowerCase());

      const pagesRaw = (mod.pages || []).map(page => {
        const children = (page.children || []).filter(child =>
          (child.route && hasPermission(child.route, 'any')) ||
          (child.permissionKey && hasPermission(child.permissionKey, 'any'))
        );
        return { ...page, children };
      });

      let pages = pagesRaw;
      if (moduleDisplayName === 'Attendance' || moduleDisplayName === 'Social Media') {
        pages = pagesRaw.map(p => {
          const lowerLabel = (p.name || p.label || '').toLowerCase();
          if (lowerLabel === 'dashboard' || lowerLabel === moduleDisplayName.toLowerCase()) {
            return { ...p, name: `${moduleDisplayName} Dashboard`, label: `${moduleDisplayName} Dashboard` };
          }
          return p;
        });
      }

      const filteredPages = pages.filter(page => {
        const pageName = (page.name || '').toLowerCase();
        const isSystemProtected = ['Report', 'Reports', 'Overview', 'Dashboard'].some(n => pageName.includes(n.toLowerCase())) || 
                                   pageName.includes('social media dashboard') || 
                                   pageName.includes('attendance dashboard');
        // Allow system pages even if they have "document" in name if they are part of a management module
        const normalizedRoute = (page.route || '').replace(/\/employee\//, '').replace(/^\/hr\//, '').replace(/^\/tenant\//, '').replace(/^\//, '');
        const coveredSlugs = ['dashboard', 'attendance', 'payslips', 'my-documents', 'internal-jobs', 'support-center', 'resignation', 'tickets', 'support', 'exit'];
        
        const isEmployeeRoute = (page.route || '').startsWith('/employee') || isEmployeeModule;

        const matchedStatic = isEmployeeRoute && staticItems.find(dp => 
          dp.title.toLowerCase() === (page.name || page.label || '').toLowerCase() ||
          dp.id.toLowerCase() === normalizedRoute.toLowerCase() ||
          coveredSlugs.includes(normalizedRoute) && dp.id === (normalizedRoute === 'support' || normalizedRoute === 'tickets' ? 'support-center' : normalizedRoute === 'exit' ? 'resignation' : normalizedRoute)
        );

        const strictEmployeeKey = matchedStatic?.permissionKey || page.permissionKey || page.route;
        let hasAccess = false;

        if (isEmployeeRoute && currentPathPrefix.startsWith('/employee')) {
          hasAccess = hasEmployeeAccessWithFallback(strictEmployeeKey);
        } else {
          // Strict priority: Explicit permission key check first
          if (page.permissionKey && hasExplicitPermissionEntry(page.permissionKey)) {
            hasAccess = hasStrictPermission(page.permissionKey, 'any');
          } else if (hasExplicitPermissionEntry(strictEmployeeKey)) {
            hasAccess = hasStrictPermission(strictEmployeeKey, 'any');
          } else {
            // Fallback to route-based check or children visibility
            hasAccess = hasPermission(page.route, 'any') || 
                        (page.permissionKey && hasPermission(page.permissionKey, 'any')) || 
                        hasPermission(strictEmployeeKey, 'any') || 
                        (page.children && page.children.length > 0);
          }
        }

        if (matchedStatic && isEmployeeRoute) {
          if (hasAccess) matchedStatic.visible = true;
          return false;
        }

        return hasAccess;
      });

      if (filteredPages.length === 0) return;

      const items = filteredPages.map(p => {
        let route = p.route;
        if (currentPathPrefix.startsWith('/employee')) {
          if (route === '/attendance' || route === 'attendance') route = '/management-attendance';
          if (route === '/payroll' || route === 'payroll') route = '/payroll/dashboard';
          if (route === '/hiring' || route === 'hiring') route = '/requirements';
          if (route === '/bgv' || route === 'bgv') route = '/bgv';
          if (route === '/settings' || route === 'settings') route = '/settings/company';
          if (route === '/offboarding' || route === 'offboarding') route = '/exit-management';
          if (route === '/social-media' || route === 'social-media') route = '/settings/social-media';
          if (route === '/portals' || route === 'portals') route = '/career-builder';
          if (route === '/reports' || route === 'reports') route = '/reports';
          if (route === '/tickets' || route === 'tickets' || route === '/support' || route === 'support') {
            const hasAdminTickets = hasPermission('support.tickets', 'any');
            const hasEmpTickets = hasPermission('employee.tickets', 'any');
            
            if (isEmployeeModule) route = '/support-center';
            else if (hasAdminTickets) route = '/tickets';
            else if (hasEmpTickets) route = '/support-center';
            else route = '/support-center';
          }
          if (route === '/onboarding' || route === 'onboarding') route = '/onboarding/dashboard';
          if (route === '/hiring' || route === 'hiring' || route === '/recruitment') {
            const hasOffers = hasPermission('hiring.offersJoining', 'any');
            const hasJobs = hasPermission('hiring.jobList', 'any');
            
            if (hasJobs) route = '/requirements';
            else if (hasOffers) route = '/offers-joining';
            else route = '/requirements';
          }
          if (route === '/offers-joining' || route === 'offers-joining') route = '/offers-joining';
          if (route === '/organization' || route === 'organization') route = '/organization';
          if (route === '/position-master' || route === 'position-master') route = '/position-master';
          if (route === '/employees' || route === 'employees') route = '/employees';
          
          // Robust mapping for HR modules if route is missing or generic
          if (!route || route === '/' || route === '') {
            if (p.permissionKey === 'leave.policies') route = 'leave-policies';
            else if (p.permissionKey === 'leave.requests') route = 'leave-approvals';
            else if (p.permissionKey === 'leave.custom') route = 'leave-policies/custom';
            else if (p.permissionKey === 'configuration.access') route = 'access';
            else if (p.permissionKey === 'people.employees') route = 'employees';
            else if (p.permissionKey === 'people.departments') route = 'departments';
            else if (p.permissionKey === 'people.org') route = 'org';
            else if (p.permissionKey === 'people.users') route = 'users';
            else if (p.permissionKey === 'payroll.stats') route = 'payroll/dashboard';
            else if (p.permissionKey === 'hiring.jobList') route = 'requirements';
            else if (p.permissionKey === 'bgv.caseMaster') route = 'bgv';
            else if (p.permissionKey === 'reports.staffing') route = 'reports';
            else if (p.permissionKey === 'configuration.company') route = 'settings/company';
          }
        }

        return {
          id: typeof p._id === 'object' ? (p._id.$oid || JSON.stringify(p._id)) : String(p._id || Math.random()),
          title: p.name,
          icon: ICONS_LOCAL[p.icon] || <LayoutDashboard size={16} />,
          path: route ? getRoleRoute(route, user?.role, managementPrefix) : (p.children && p.children[0] ? getRoleRoute(p.children[0].route, user?.role, managementPrefix) : null),
          permissionKey: p.permissionKey,
          children: (p.children || []).map(c => ({ ...c, path: getRoleRoute(c.route, user?.role, managementPrefix) }))
        };
      });

      if (isEmployeeModule) {
        employeeItems.push(...items);
      }
      
      let moduleItems = items;
        const flattenList = ['Payroll', 'Hiring', 'BGV', 'Settings', 'Social Media', 'Portals', 'Resignation', 'Policy', 'Employee', 'Attendance', 'Access', 'Support', 'Ticket Inbox', 'Reports', 'Letters', 'Document Management', 'Onboarding', 'Sub Companies', 'Offboarding', 'Approvals'];
        
        // User requirement: If the admin gives access to multiple pages in a module, they should ALL show.
        // We only flatten if there is exactly one item, otherwise we leave it expanded to show sub-navigation.
        if (flattenList.includes(moduleDisplayName) && items.length === 1) {
          moduleItems = [{ ...items[0], title: moduleDisplayName, children: [] }];
        }

        if (moduleItems && moduleItems.length > 0) {
          management.push({
            id: typeof mod._id === 'object' ? (mod._id.$oid || JSON.stringify(mod._id)) : String(mod._id || Math.random()),
            category: moduleDisplayName,
            items: moduleItems
          });
        }
      });
    }

    const hasManDashboard = hasPermission('overview.dashboard', 'any') || hasPermission('/hr/dashboard', 'any');
    const hasManAccess = hasPermission('configuration.access', 'any') || hasPermission('/hr/access', 'any');
    const hasManReports = hasPermission('reports.staffing', 'any') || 
                          hasPermission('reports.movements', 'any') || 
                          hasPermission('reports.trends', 'any') || 
                          hasPermission('reports.performance', 'any') ||
                          hasPermission('/hr/reports', 'any');

    if (hasManDashboard || hasManReports || hasManAccess) {
        const existingDashIdx = management.findIndex(m => 
          ['dashboard', 'overview'].includes((m.category || '').toLowerCase())
        );
        // Robust cleanup: Remove ANY existing reports modules from dynamic list to avoid duplicates
        const existingReportsMatches = management.filter(m => 
          ['reports', 'personnel reports', 'system reports', 'analytical reports'].includes((m.category || '').toLowerCase())
        );
        existingReportsMatches.forEach(match => {
          const idx = management.indexOf(match);
          if (idx > -1) management.splice(idx, 1);
        });
        
        if (hasManDashboard) {
            const isEss = currentPathPrefix.startsWith('/employee');
            // If in ESS, we call it "HR Dashboard" to distinguish from ESS "Dashboard"
            const dashPath = isEss ? `${managementPrefix}/hr-dashboard` : `${managementPrefix}/dashboard`;
            const dashTitle = isEss ? 'HR Dashboard' : 'Dashboard';
            
            const dashObj = { 
                id: 'management-dash', 
                category: dashTitle, 
                items: [{ 
                    id: 'fixed-dash', 
                    title: dashTitle, 
                    icon: ICONS_LOCAL.dashboard, 
                    path: dashPath 
                }] 
            };
            if (existingDashIdx > -1) management[existingDashIdx] = dashObj;
            else management.unshift(dashObj);
        }

        if (hasManReports) {
            const reportsPrefix = `${managementPrefix}/reports`;
            let firstReportPath = reportsPrefix;
            
            // Intelligent routing: pick first allowed tab
            if (!hasPermission('reports.staffing', 'any')) {
                if (hasPermission('reports.movements', 'any')) firstReportPath = `${reportsPrefix}/replacements`;
                else if (hasPermission('reports.trends', 'any')) firstReportPath = `${reportsPrefix}/trends`;
                else if (hasPermission('reports.performance', 'any')) firstReportPath = `${reportsPrefix}/performance`;
            }

            const repObj = { 
                id: 'management-reports', 
                category: 'Reports', 
                items: [{ 
                    id: 'fixed-reports', 
                    title: 'Reports', 
                    icon: <FileText size={16} />, 
                    path: firstReportPath 
                }] 
            };
            // Always push the sanitized manual reports object
            management.push(repObj);
            hasReportsModule = true;
        }

        if (hasManAccess) {
          const accObj = {
            id: 'management-access',
            category: 'Access',
            items: [{ id: 'fixed-access', title: 'Access', icon: <Lock size={16} />, path: `${managementPrefix}/access` }]
          };
          const existingAccIdx = management.findIndex(m => ['access', 'access control'].includes((m.category || '').toLowerCase()));
          if (existingAccIdx > -1) management[existingAccIdx] = accObj;
          else management.push(accObj);
        }
    }

    // --- MANUAL TICKET INBOX INJECTION (Fallback) ---
    if (!hasSupportModule) {
      const canSupport = hasPermission('/hr/tickets', 'any') || hasPermission('support.tickets', 'any') || hasPermission('support.view', 'any');
      if (canSupport) {
        management.push({
          id: 'manual-support',
          category: 'Ticket Inbox',
          items: [{
            id: 'fixed-support',
            title: 'Ticket Inbox',
            icon: ICONS_LOCAL['ticket-inbox'],
            path: buildPath(managementPrefix, 'tickets')
          }]
        });
      }
    }


    // Re-order management: strict user-requested sequence
    // Use dynamic sidebarOrder if available, otherwise fallback to hardcoded list
    const order = (sidebarOrder && Array.isArray(sidebarOrder) && sidebarOrder.length > 0)
      ? sidebarOrder
      : MODULE_ORDER;
    
    management.sort((a, b) => {
      // Normalize names for matching with order array
      const catA = a.category === 'HR Dashboard' ? 'Dashboard' : a.category;
      const catB = b.category === 'HR Dashboard' ? 'Dashboard' : b.category;
      
      const idxA = order.indexOf(catA);
      const idxB = order.indexOf(catB);
      
      // If both are in the order list, follow it
      if (idxA > -1 && idxB > -1) return idxA - idxB;
      // If only one is in the list, that one comes first
      if (idxA > -1) return -1;
      if (idxB > -1) return 1;
      // Otherwise keep current order
      return 0;
    });

    const visibleManagement = management.filter(m => {
      const cat = m.category === 'HR Dashboard' ? 'Dashboard' : m.category;
      return !hiddenModules.includes(cat);
    });

    // Final merge: all activated static items (filtered by permission) + non-duplicate dynamic employee items
    const visibleStaticItems = staticItems.filter((p) => p.visible);
    // User requested that any given access is shown. 
    // We filter dynamic employeeItems to avoid showing duplicates of what's already in the 7 static buttons.
    const uniqueDynamicEmployeeItems = employeeItems.filter(di => 
      !visibleStaticItems.some(si => si.path === di.path || si.title === di.title || si.id === di.id)
    );

    const finalEmployeeItems = [...visibleStaticItems, ...uniqueDynamicEmployeeItems];

    if (isOnboarding) {
      return {
        employeeSections: [{
          id: 'onboarding-ess',
          category: 'Onboarding',
          items: [{
            id: 'onboarding',
            title: 'Activation Status',
            icon: <FileText size={16} />,
            path: `${pathPrefix}/onboarding`,
            visible: true
          }]
        }],
        managementSections: []
      };
    }

    return { 
        employeeSections: [{ id: 'default-ess', category: 'Employee', items: finalEmployeeItems }], 
        managementSections: visibleManagement
    };
  }, [allowManagementFallbackForEss, dynamicModules, hasPermission, pathPrefix, user?.role, permMap, isOnboarding, sidebarOrder, hiddenModules]);


  useEffect(() => {
    const loadSidebarStyles = () => {
      try {
        const panel = location.pathname.startsWith('/employee') ? 'employee' : 'hr';
        const scopedKey = getScopedStorageKey('hrms:sidebar:advanced-config:v1', { user, panel });
        const cfg = JSON.parse(localStorage.getItem(scopedKey) || '{}');
        if (cfg?.appearance) {
          const ap = cfg.appearance;
          const root = document.documentElement;
          if (ap.sidebarBgColor) root.style.setProperty('--hr-sidebar-bg', ap.sidebarBgColor);
          if (ap.sidebarTextColor) root.style.setProperty('--hr-sidebar-text', ap.sidebarTextColor);
          if (ap.sidebarActiveColor) root.style.setProperty('--hr-sidebar-active-text', ap.sidebarActiveColor);
          if (ap.sidebarActiveBgColor) root.style.setProperty('--hr-sidebar-active-bg', ap.sidebarActiveBgColor);
          if (ap.sidebarHoverBgColor) root.style.setProperty('--hr-sidebar-hover-bg', ap.sidebarHoverBgColor);
          if (ap.sidebarHoverTextColor) root.style.setProperty('--hr-sidebar-hover-text', ap.sidebarHoverTextColor);
        }
      } catch (e) { }
    };

    loadSidebarStyles();
    window.addEventListener('hrms:appearance:changed', loadSidebarStyles);
    return () => window.removeEventListener('hrms:appearance:changed', loadSidebarStyles);
  }, [user, location.pathname]);

  useEffect(() => {
    api.get('/tenants/me').then((res) => setTenant(res.data)).catch(() => {});
  }, []);

  const isGroupActive = (items = []) => items.some((item) => location.pathname.startsWith(item.path));
  const autoExpandedMenu = managementSections.find((item) => item.items?.some((child) => location.pathname.includes(child.path)))?.id || null;
  const currentExpandedMenu = expandedMenu;

  return (
    <aside 
      className="relative flex h-full w-full flex-col border-r border-slate-200"
      style={{ backgroundColor: 'var(--hr-sidebar-bg)', color: 'var(--hr-sidebar-text)' }}
    >
      {/* Sidebar Toggle Button - Floating on the edge */}
      <button
        type="button"
        onClick={toggleCollapse}
        className="absolute -right-3 top-24 z-[60] flex h-6 w-6 items-center justify-center bg-transparent text-slate-500 transition-all hover:scale-125 hover:text-slate-900 active:scale-95"
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {isCollapsed ? <ChevronRight size={14} strokeWidth={2.5} /> : <ChevronLeft size={14} strokeWidth={2.5} />}
      </button>
      <div className={`${isCollapsed ? 'px-2 pt-2 pb-0' : 'px-4 pt-2 pb-0'}`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm h-11 w-11">
            <img
              src={resolveTenantLogoUrl(tenant) || logoNew}
              alt="Tenant logo"
              className="h-full w-full object-contain"
            />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {tenant?.companyName || tenant?.name || 'HRMS'}
              </p>
            </div>
          )}
        </div>
      </div>
      
      {/* Gray Divider Line */}
      <div className={`${isCollapsed ? 'mx-2' : 'mx-4'} mt-2 mb-2 h-px bg-slate-200`} />

      <div className={`employee-sidebar-scroll flex-1 overflow-y-auto ${isCollapsed ? 'px-1.5 pt-1 pb-1.5' : 'px-2 pt-1 pb-2'}`}>
        {managementSections.map((mod) => {
          const isActive = activeTab === mod.id || currentExpandedMenu === mod.id || isGroupActive(mod.items);

          if (isCollapsed) {
            return (
              <button
                key={mod.id}
                onClick={() => handleTabClick(mod.id, mod.items[0]?.path)}
                className={`flex min-h-[64px] w-full flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-center transition ${
                  isActive ? 'sidebar-item-active' : 'sidebar-item-inactive text-slate-600'
                }`}
                title={mod.category}
              >
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${isActive ? 'bg-white sidebar-icon-active' : 'bg-slate-50 text-slate-600'}`}>
                  {mod.items[0]?.icon}
                </div>
                <span className="line-clamp-2 text-[10px] font-semibold leading-[1.05rem]">{mod.category}</span>
              </button>
            );
          }

          return (
            <div key={mod.id} className="relative mb-0.5 overflow-hidden rounded-xl border border-transparent transition">
              <button
                type="button"
                onClick={() => {
                  if (mod.items && mod.items.length > 1) setExpandedMenu(currentExpandedMenu === mod.id ? null : mod.id);
                  else handleTabClick(mod.id, mod.items[0]?.path);
                }}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left transition-all duration-200`}
                style={{
                  backgroundColor: isActive ? 'var(--hr-sidebar-active-bg)' : 'transparent',
                  color: isActive ? 'var(--hr-sidebar-active-text)' : 'var(--hr-sidebar-text)',
                  border: isActive ? '1px solid rgba(0,0,0,0.05)' : '1px solid transparent',
                  boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                }}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div 
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all duration-200`}
                    style={{
                      backgroundColor: isActive ? 'var(--hr-card-bg)' : 'rgba(0,0,0,0.03)',
                      color: isActive ? 'var(--hr-sidebar-active-text)' : 'var(--hr-sidebar-text)',
                      borderColor: isActive ? 'rgba(0,0,0,0.05)' : 'transparent'
                    }}
                  >
                    {mod.items[0]?.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p 
                      className={`truncate text-[13px] font-semibold transition-colors duration-200`}
                      style={{ color: isActive ? 'var(--hr-sidebar-active-text)' : 'var(--hr-sidebar-text)' }}
                    >
                      {mod.category}
                    </p>
                  </div>
                </div>
                {mod.items && mod.items.length > 1 && (
                  <ChevronDown 
                    size={14} 
                    className={`transition-transform duration-200`} 
                    style={{ 
                      transform: currentExpandedMenu === mod.id ? 'rotate(180deg)' : 'none',
                      color: isActive ? 'var(--hr-sidebar-active-text)' : 'var(--hr-sidebar-text)',
                      opacity: 0.5
                    }} 
                  />
                )}
              </button>


              {mod.items && mod.items.length > 1 && currentExpandedMenu === mod.id && (
                <div className="mt-1 border-t border-slate-100 bg-white/80 px-2 py-2">
                  <div className="space-y-1">
                    {mod.items.map((child, idx) => (
                      <button
                        key={`${mod.id}-${idx}`}
                        type="button"
                        onClick={() => handleTabClick(`${mod.id}-${child.id}`, child.path)}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition ${
                          location.pathname === child.path ? 'sidebar-item-active font-medium shadow-sm' : 'sidebar-item-inactive text-slate-600'
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                        <span className="truncate">{child.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {employeeSections.map((section) => (
          <div key={section.id} className={`mt-2 border-t border-slate-100 pt-2 ${isCollapsed ? 'mb-2' : 'mb-3'}`}>
            {/* Hide EMPLOYEE tag in ESS sidebar; show labels only in management contexts */}
            {!isCollapsed && !currentPathPrefix.startsWith('/employee') && (
              <div className="px-3 pb-1 pt-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{section.category}</span>
              </div>
            )}
            <div className={isCollapsed ? 'space-y-0' : 'space-y-0'}>
              {section.items.map((item) => {
                const isActive = activeTab === item.id || (item.path && location.pathname.includes(item.path));

                if (isCollapsed) {
                  return (
                    <NavLink
                      key={item.id || item.path}
                      to={item.path}
                      onClick={() => handleTabClick(item.id, item.path)}
                      className={() =>
                        `flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-center transition ${
                          isActive ? 'sidebar-item-active' : 'sidebar-item-inactive opacity-70 hover:opacity-100'
                        }`
                      }
                      title={item.title}
                    >
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-white sidebar-icon-active shadow-sm' : 'bg-white/10'}`}>
                        {item.icon}
                      </div>
                      <span className="line-clamp-2 text-[10px] font-semibold leading-[1.05rem]">{item.title}</span>
                    </NavLink>
                  );
                }

                return (
                  <NavLink
                    key={item.id || item.path}
                    to={item.path}
                    onClick={() => handleTabClick(item.id, item.path)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-1 text-sm transition ${
                      isActive ? 'bg-white shadow-sm border border-sky-100/30 sidebar-item-active' : 'sidebar-item-inactive opacity-80'
                    }`}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
                      isActive ? 'sidebar-icon-active' : 'border-slate-200 bg-slate-100 text-slate-600'
                    }`}>
                      {item.icon}
                    </div>
                    <span className={`truncate font-semibold tracking-[0.01em] ${isActive ? 'sidebar-item-active bg-transparent' : ''}`}>{item.title}</span>
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .employee-sidebar-scroll {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        .employee-sidebar-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </aside>
  );
}
