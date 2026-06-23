import React, { useState, useEffect, useContext, useMemo } from 'react';
import { App } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import api, { resolveTenantLogoUrl } from '../utils/api';
import logoNew from '../assets/logonew.png';
import EmployeeSidebar from '../components/EmployeeSidebar';
import NotificationDropdown from '../components/NotificationDropdown';
import AnnouncementDropdown from '../components/AnnouncementDropdown';
import { useAuth } from '../context/AuthContext';
import { UIContext } from '../context/UIContext';
import { LogOut, Menu, ArrowLeft, Settings, X, Building2, User, LayoutDashboard, Clock, FileText, Briefcase, LifeBuoy, Paintbrush, Plane, Users, Settings2, Shield, CalendarDays, Fingerprint, Banknote, UserCog, History, Share2, PenSquare, UserPlus, BarChart, ExternalLink, AlertTriangle, MapPin } from 'lucide-react';
import ErrorBoundary from '../components/ErrorBoundary';
import SectionTabs from '../components/HR/SectionTabs';
import { useRBAC } from '../context/RBACContext';
import { extractEmployeeProfilePayload, getEmployeeProfileImage } from '../utils/employeeProfile';
import DashboardThemeSettings from '../components/DashboardThemeSettings';
import { getScopedStorageKey } from '../utils/sidebarStorage';

const isLikelyObjectId = (value) => typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
const getDisplayInitials = (value = '') =>
  String(value || '')
    .split(' ')
    .map((part) => part.trim()[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'E';

export default function EssLayout() {
  const { logout, user } = useAuth();
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [manualActiveTab, setManualActiveTab] = useState(() => localStorage.getItem('essActiveTab') || null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [profile, setProfile] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [brokenProfileImageUrl, setBrokenProfileImageUrl] = useState('');
  const uiContext = useContext(UIContext);
  const { theme } = uiContext || { theme: 'light' };
  const { hasPermission } = useRBAC();
  const [appearance, setAppearance] = useState({
    pageBgColor: '#ffffff',
    pageCardColor: '#ffffff',
    pageTextColor: '#0f172a',
  });

  const scopedSidebarAdvancedKey = useMemo(
    () => getScopedStorageKey('hrms:sidebar:advanced-config:v1', { user, panel: 'employee' }),
    [user]
  );

  useEffect(() => {
    localStorage.setItem('essSidebarCollapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  useEffect(() => {
    const readTabsPlacement = () => {
      try {
        const cfg = JSON.parse(
          localStorage.getItem(scopedSidebarAdvancedKey) ||
          localStorage.getItem('hrms:sidebar:advanced-config:v1') ||
          '{}'
        );
        const ap = cfg?.appearance || {};
        setAppearance({
          pageBgColor: String(ap?.pageBgColor || '#ffffff'),
          pageCardColor: String(ap?.pageCardColor || '#ffffff'),
          pageTextColor: String(ap?.pageTextColor || '#0f172a'),
          metricBgColor: String(ap?.metricBgColor || ''),
          metricTextColor: String(ap?.metricTextColor || ''),
          sidebarBgColor: String(ap?.sidebarBgColor || ''),
          sidebarTextColor: String(ap?.sidebarTextColor || ''),
          sidebarActiveColor: String(ap?.sidebarActiveColor || ''),
          sidebarActiveBgColor: String(ap?.sidebarActiveBgColor || ''),
          sidebarHoverBgColor: String(ap?.sidebarHoverBgColor || ''),
          sidebarHoverTextColor: String(ap?.sidebarHoverTextColor || ''),
          buttonTextColor: String(ap?.buttonTextColor || '#ffffff'),
        });
      } catch {
        setAppearance({
          pageBgColor: '#ffffff',
          pageCardColor: '#ffffff',
          pageTextColor: '#0f172a',
        });
      }
    };
    readTabsPlacement();
    window.addEventListener('focus', readTabsPlacement);
    window.addEventListener('hrms:appearance:changed', readTabsPlacement);
    return () => {
      window.removeEventListener('focus', readTabsPlacement);
      window.removeEventListener('hrms:appearance:changed', readTabsPlacement);
    };
  }, [scopedSidebarAdvancedKey]);


  const routeActiveTab = useMemo(() => {
    const path = location.pathname;
    const tabMapping = {
      '/payroll/dashboard': 'payroll',
      '/requirements': 'hiring',
      '/management-attendance': 'attendance',
      '/bgv': 'bgv',
      '/access': 'access',
      '/settings': 'settings',
      '/payslips': 'payslips',
      '/attendance': 'attendance',
      '/leaves': 'leaves',
      '/regularization': 'regularization',
      '/profile': 'profile',
      '/team-leaves': 'team-leaves',
      '/team-attendance': 'team-attendance',
      '/team-regularization': 'team-regularization',
      '/internal-jobs': 'internal-jobs',
      '/my-applications': 'my-applications',
      '/my-documents': 'my-documents',
      '/tickets': 'tickets',
      '/support-center': 'support-center',
      '/onboarding': 'onboarding',
      '/face-attendance': 'face-attendance',
      '/exit': 'exit',
      '/resignation': 'resignation',
      '/org': 'people',
      '/employees': 'people',
      '/departments': 'people',
      '/reports': 'reports',
      '/dashboard': 'dashboard',
    };

    const found = Object.keys(tabMapping).find((key) => path.includes(key));
    if (found) return tabMapping[found];
    if (path === '/employee' || path === '/employee/') return 'dashboard';
    return null;
  }, [location.pathname]);

  const activeTab = routeActiveTab || manualActiveTab || 'dashboard';

  useEffect(() => {
    localStorage.setItem('essActiveTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;

    api.get('/employee/profile', { _silent: true })
      .then((res) => {
        if (mounted) {
          setProfile(extractEmployeeProfilePayload(res.data));
        }
      })
      .catch((err) => {
        console.warn("[EssLayout] Profile check failed:", err.response?.status);
      });

    const loadTenant = async () => {
      try {
        const res = await api.get('/tenants/me', { _silent: true });
        if (!mounted) return;
        setTenant(res.data);

        const tenantName = res.data?.companyName || res.data?.name;
        if (!tenantName && user?.tenantId) {
          const fallback = await api.get(`/public/tenant/${user.tenantId}`, { _silent: true });
          if (mounted && fallback.data) setTenant(fallback.data);
        }
      } catch {
        if (!mounted) return;
        if (user?.tenantId) {
          api.get(`/public/tenant/${user.tenantId}`)
            .then((fallback) => { if (mounted) setTenant(fallback.data); })
            .catch(() => { });
        }
      }
    };

    loadTenant();

    return () => { mounted = false; };
  }, [user]);

  const getOverdueTasksFromProjects = (projects = []) => {
    const now = new Date();
    const overdue = [];

    for (const p of projects || []) {
      for (const t of p?.tasks || []) {
        const due = t?.dueDate ? new Date(t.dueDate) : null;
        const status = String(t?.status || '').toLowerCase();
        const isDone = ['done', 'completed', 'complete', 'closed'].includes(status);
        if (!due || Number.isNaN(due.getTime()) || isDone) continue;
        if (due < now) {
          overdue.push({
            projectName: p?.name || 'Project',
            title: t?.title || 'Task',
            dueDate: due,
            status: t?.status || '',
          });
        }
      }
    }

    overdue.sort((a, b) => a.dueDate - b.dueDate);
    return overdue;
  };

  const handleLogout = async () => {
    try {
      const t = Date.now();
      const res = await api.get(`/tasks?t=${t}`);
      const projects = Array.isArray(res?.data?.projects) ? res.data.projects : [];
      const overdue = getOverdueTasksFromProjects(projects);

      if (overdue.length > 0) {
        const tmsUrl = APP_CONFIG.TMS_URL;
        const top = overdue.slice(0, 6);
        const formatDueAge = (date) => {
          const diffMs = Date.now() - date.getTime();
          const dayDiff = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
          return `${dayDiff} day${dayDiff > 1 ? 's' : ''} overdue`;
        };
        const projectCounts = top.reduce((acc, x) => {
          acc[x.projectName] = (acc[x.projectName] || 0) + 1;
          return acc;
        }, {});

        const instance = modal.confirm({
          className: 'ess-overdue-modal',
          width: 680,
          centered: true,
          icon: null,
          title: (
            <div className="flex items-center justify-between gap-3">
              <span>Overdue tasks found</span>
              <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                {overdue.length} overdue
              </span>
            </div>
          ),
          closable: true,
          closeIcon: <X size={16} />,
          content: (
            <div className="space-y-4 pb-1">
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/60 p-3.5">
                <div className="mt-0.5 rounded-lg bg-amber-100 p-1.5 text-amber-600">
                  <AlertTriangle size={15} />
                </div>
                <p className="text-sm text-slate-700">
                  You have <span className="font-semibold text-slate-900">{overdue.length}</span> overdue task(s). Please review them before logout.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                <p className="mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Projects</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(projectCounts).map(([name, count]) => (
                    <span key={name} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
                      {name} <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-500">{count}</span>
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">Top overdue tasks</p>
                  <span className="text-sm font-semibold text-slate-500">{top.length} shown</span>
                </div>
                <div className="mb-2 hidden grid-cols-[1.7fr_1.1fr_0.9fr_1fr] gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:grid">
                  <span>Task</span>
                  <span>Project</span>
                  <span className="text-right">Due date</span>
                  <span className="text-right">Status</span>
                </div>
                <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
                  {top.map((x, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                      <div className="space-y-2 sm:hidden">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{x.title}</p>
                          <p className="text-xs text-slate-500">{x.projectName}</p>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-rose-600">{x.dueDate.toLocaleDateString()}</span>
                          <span className="font-medium text-rose-500">{formatDueAge(x.dueDate)}</span>
                        </div>
                      </div>
                      <div className="hidden grid-cols-[1.7fr_1.1fr_0.9fr_1fr] items-center gap-3 sm:grid">
                        <p className="truncate text-sm font-semibold text-slate-800">{x.title}</p>
                        <p className="truncate text-sm text-slate-600">{x.projectName}</p>
                        <p className="text-right text-sm font-semibold text-rose-600">{x.dueDate.toLocaleDateString()}</p>
                        <p className="text-right text-sm font-medium text-rose-500">{formatDueAge(x.dueDate)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    onClick={async () => {
                      instance?.destroy?.();
                      await logout();
                    }}
                  >
                    <LogOut size={13} />
                    Logout Anyway
                  </button>
                </div>
                <span className="text-xs text-slate-400">
                  Close dismisses popup only.
                </span>
              </div>
            </div>
          ),
          okText: (
            <span className="inline-flex items-center gap-1">
              Open in TMS
              <ExternalLink size={14} />
            </span>
          ),
          okButtonProps: { className: 'rounded-lg bg-blue-600 px-4 shadow-sm' },
          cancelText: 'Close',
          cancelButtonProps: { className: 'rounded-lg' },
          onOk: async () => {
            window.open(`${tmsUrl}/projects`, '_blank', 'noopener,noreferrer');
          },
          onCancel: () => { }
        });

        return;
      }
    } catch {
      // If tasks fetch fails, allow logout to avoid trapping the user.
    }
    await logout();
  };

  const employeeDisplayName = (() => {
    const isGeneric = (val) => {
      const v = String(val || '').trim().toLowerCase();
      return !v || v === 'user' || v === 'admin' || v === 'employee' || v === 'null' || v === 'undefined';
    };

    // 1. Try first + last name from profile
    const first = String(profile?.firstName || '').trim();
    const last = String(profile?.lastName || '').trim();
    const full = (first && last) ? `${first} ${last}`.trim() : (first || last);
    if (full && !isGeneric(full)) return full;

    // 2. Try generic profile name fields
    const profileName = String(profile?.name || profile?.employeeName || profile?.fullName || '').trim();
    if (profileName && !isGeneric(profileName)) return profileName;

    // 3. Try identity system (auth) name/fullName
    const identityName = String(user?.fullName || user?.name || '').trim();
    if (identityName && !isGeneric(identityName)) return identityName;

    // 4. Try username if available
    const username = String(user?.username || '').trim();
    if (username && !isGeneric(username)) return username;

    // 5. Fallback to email prefix (most unique identifier)
    const emailName = String(user?.email || '').split('@')[0].trim();
    if (emailName && !isGeneric(emailName)) return emailName;

    return 'Employee';
  })();

  const employeeInitials = getDisplayInitials(employeeDisplayName);
  const profileImageUrl = useMemo(
    () => getEmployeeProfileImage(profile, user),
    [profile, user]
  );
  const hasWorkingProfileImage = Boolean(profileImageUrl) && brokenProfileImageUrl !== profileImageUrl;

  const PAGE_TITLES = {
    dashboard: 'My Dashboard',
    attendance: 'Attendance',
    regularization: 'Fix Attendance',
    'face-attendance': 'Check In',
    leaves: 'Leaves',
    'team-attendance': 'Team Work Time',
    'team-leaves': 'Team Leaves',
    'team-regularization': 'Team Approval',
    payslips: '',
    'internal-jobs': 'Internal Jobs',
    'my-applications': 'My Applications',
    'my-documents': 'My Documents',
    'tickets': 'Ticket Inbox',
    'support-center': 'Support Center',
    'my-records': 'My Records',
    onboarding: '',
    profile: 'My Profile',
    exit: 'Resignation',
    resignation: 'Resignation',
    'people': '',
    'settings/social-media': '',
    'reports': '',
  };

  const isMainDashboard = activeTab === 'dashboard';
  const currentTitle = (activeTab === 'dashboard' || activeTab === 'my-dashboard' || isMainDashboard || activeTab === 'access' || activeTab === 'attendance') ? '' : (PAGE_TITLES[activeTab] || '');
  const workspaceName = (
    (tenant?.companyName || tenant?.tenantName || tenant?.displayName || tenant?.name) && !isLikelyObjectId(tenant?.companyName || tenant?.tenantName || tenant?.displayName || tenant?.name)
      ? (tenant?.companyName || tenant?.tenantName || tenant?.displayName || tenant?.name)
      : (localStorage.getItem('companyName') || tenant?.code || user?.companyName || user?.tenantName || user?.company || user?.name || user?.companyCode || 'Employee')
  ).split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  const sectionTabs = useMemo(() => {
    const isTenant = location.pathname.startsWith('/tenant');
    const isHr = location.pathname.startsWith('/hr');
    const pathPrefix = isTenant ? '/tenant' : (isHr ? '/hr' : '/employee');
    const sections = [
      {
        match: ['/organization', '/org'],
        tabs: [
          { label: 'Organization', to: `${pathPrefix}/organization`, icon: MapPin, permission: 'people.org' },
          { label: 'Org Structure', to: `${pathPrefix}/org`, icon: Users, permission: 'people.org' },
        ],
      },
      {
        match: ['/employees', '/departments', '/users'],


        tabs: [
          { label: 'Employees', to: `${pathPrefix}/employees`, icon: Users, permission: 'people.employees' },
          { label: 'Departments', to: `${pathPrefix}/departments`, icon: Building2, permission: 'people.departments' },
          { label: 'Users', to: `${pathPrefix}/users`, icon: UserCog, permission: 'people.users' },
        ],
      },
      {
        match: ['/management-attendance', '/attendance-calendar', '/face-update-requests', '/attendance-history', '/attendance-live-tracking', '/attendance-settings', '/leave-approvals', '/leave-requests'],
        tabs: [
          {
            label: 'Attendance',
            to: `${pathPrefix}/management-attendance`,
            icon: LayoutDashboard,
            permission: 'attendance.dashboard'
          },
          { label: 'History', to: `${pathPrefix}/attendance-history`, icon: History, permission: 'attendance.dashboard' },
          { label: 'Live Tracking', to: `${pathPrefix}/attendance-live-tracking`, icon: MapPin, permission: 'attendance.dashboard' },
          { label: 'Calendar', to: `${pathPrefix}/attendance-calendar`, icon: CalendarDays, permission: 'attendance.calendar' },
          { label: 'Face Updates', to: `${pathPrefix}/face-update-requests`, icon: Fingerprint, permission: 'attendance.face' },
          { label: 'Requests', to: `${pathPrefix}/leave-approvals`, icon: Plane, permission: 'leave.requests' },
          { label: 'Settings', to: `${pathPrefix}/attendance-settings`, icon: Settings, permission: 'attendance.dashboard' },
        ],
      },
      {
        match: ['/leave-policies'],
        tabs: [
          { label: 'Policies', to: `${pathPrefix}/leave-policies`, icon: Settings2, permission: 'leave.policies' },
          { label: 'Custom', to: `${pathPrefix}/leave-policies/custom`, icon: Settings2, permission: 'leave.custom' },
        ],
      },
      {
        match: ['/payroll', '/salary-structure', '/payslip-templates'],
        tabs: [
          { label: 'Stats', to: `${pathPrefix}/payroll/dashboard`, icon: LayoutDashboard, permission: 'payroll.stats' },
          { label: 'Salary', to: `${pathPrefix}/payroll/salary-components`, icon: Banknote, permission: 'payroll.salary' },
          { label: 'Compensation', to: `${pathPrefix}/payroll/compensation`, icon: Banknote, permission: 'payroll.compensation' },
          { label: 'Process', to: `${pathPrefix}/payroll/process`, icon: Settings2, permission: 'payroll.process' },
          { label: 'Run History', to: `${pathPrefix}/payroll/run`, icon: CalendarDays, permission: 'payroll.run' },
          { label: 'Payslips', to: `${pathPrefix}/payroll/payslips`, icon: FileText, permission: 'payroll.payslips' },
          { label: 'Templates', to: `${pathPrefix}/payslip-templates`, icon: Paintbrush, permission: 'payroll.payslips' },
        ],
      },
      {
        match: ['/requirements', '/create-requirement', '/applicants', '/internal-applicants', '/candidate-status', '/positions', '/offer-templates', '/offers-joining', '/job/'],
        tabs: [
          { label: 'Job List', to: `${pathPrefix}/requirements`, icon: Briefcase, permission: 'hiring.jobList' },
          { label: 'Create Req', to: `${pathPrefix}/create-requirement`, icon: Briefcase, permission: 'hiring.createReq' },
          { label: 'External', to: `${pathPrefix}/applicants`, icon: Users, permission: 'hiring.external' },
          { label: 'Internal', to: `${pathPrefix}/internal-applicants`, icon: Users, permission: 'hiring.internal' },
          { label: 'Tracker', to: `${pathPrefix}/candidate-status`, icon: LayoutDashboard, permission: 'hiring.tracker' },
          { label: 'Templates', to: `${pathPrefix}/offer-templates`, icon: FileText, permission: 'hiring.offerTemplates' },
          { label: 'Offers & Joining', to: `${pathPrefix}/offers-joining`, icon: FileText, permission: 'hiring.offersJoining' },
        ],
      },
      {
        match: ['/bgv'],
        tabs: [
          { label: 'Case Master', to: `${pathPrefix}/bgv`, icon: Shield, permission: 'bgv.caseMaster' },
          { label: 'Email Logs', to: `${pathPrefix}/bgv/emails`, icon: FileText, permission: 'bgv.emailLogs' },
        ],
      },
      {
        match: ['/settings/company', '/settings/sequences'],
        tabs: [
          { label: 'Company Profile', to: `${pathPrefix}/settings/company`, icon: Building2, permission: 'configuration.company' },
          { label: 'Document Sequences', to: `${pathPrefix}/settings/sequences`, icon: FileText, permission: 'configuration.sequences' },
        ],
      },
      {
        match: ['/settings/social-media'],
        tabs: [
          { label: 'Dashboard', to: `${pathPrefix}/settings/social-media`, icon: LayoutDashboard, permission: 'socialMedia.dashboard' },
          { label: 'Accounts', to: `${pathPrefix}/settings/social-media/accounts`, icon: Users, permission: 'socialMedia.accounts' },
          { label: 'Create Post', to: `${pathPrefix}/settings/social-media/create`, icon: PenSquare, permission: 'socialMedia.create' },
          { label: 'History', to: `${pathPrefix}/settings/social-media/history`, icon: History, permission: 'socialMedia.history' },
        ],
      },
      {
        match: ['/career-builder', '/apply-builder'],
        tabs: [
          { label: 'Career Page', to: `${pathPrefix}/career-builder`, icon: Paintbrush, permission: 'portals.careerPage' },
          { label: 'Apply Page', to: `${pathPrefix}/apply-builder`, icon: Paintbrush, permission: 'portals.applyPage' },
          {
            label: 'Public Page',
            icon: ExternalLink,
            permission: 'portals.publicPage',
            isExternal: true,
            onClick: async () => {
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
              } catch {
                // ignore
              }

              const fallbackCode = String(user?.companyCode || '').trim();
              if (fallbackCode) {
                window.open(`/jobs/${encodeURIComponent(fallbackCode)}`, '_blank', 'noopener,noreferrer');
              }
            }
          },
        ],
      },
      {
        match: ['/reports'],
        tabs: [
          { label: 'Staffing Overview', to: `${pathPrefix}/reports`, icon: Users, permission: 'reports.staffing' },
          { label: 'Replacement Movements', to: `${pathPrefix}/reports/replacements`, icon: UserPlus, permission: 'reports.movements' },
          { label: 'Hiring Trends', to: `${pathPrefix}/reports/trends`, icon: BarChart, permission: 'reports.trends' },
          { label: 'Performance', to: `${pathPrefix}/reports/performance`, icon: Clock, permission: 'reports.performance' },
        ],
      },
    ];

    const currentSection = sections.find((section) => {
      const isPersonalAttendance = location.pathname.endsWith('/attendance') || location.search.includes('tab=');
      const isManagementSection = section.match.includes('/management-attendance');

      if (isPersonalAttendance && isManagementSection) return false;
      if (!isPersonalAttendance && section.match.includes('/employee/attendance')) return false;

      return section.match.some((suffix) => {
        const path = location.pathname;
        return path === suffix || path.endsWith(suffix) || path.includes(suffix + '/');
      });

    });

    return currentSection
      ? currentSection.tabs.filter(tab => !tab.permission || hasPermission(tab.permission, 'any'))
      : [];
  }, [location.pathname, location.search, user?.companyCode, hasPermission]);

  return (
    <div
      className={`employee-panel h-screen overflow-hidden text-slate-900 ${theme === 'dark' ? 'dark' : ''}`}
    >
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex h-screen overflow-hidden employee-panel">
        <div
          className={`fixed inset-y-0 left-0 z-50 transform bg-white transition-[width,transform] duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } w-[200px] ${isSidebarCollapsed ? 'lg:w-[80px]' : 'lg:w-[200px]'}`}
        >
          <EmployeeSidebar
            activeTab={activeTab}
            setActiveTab={setManualActiveTab}
            onClose={() => setSidebarOpen(false)}
            isCollapsed={isSidebarCollapsed}
            toggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            userProfile={profile}
            fullName={employeeDisplayName}
            employeeId={profile?.employeeId || user?.employeeId}
          />
        </div>

        <div className={`flex h-screen flex-1 flex-col overflow-hidden transition-[padding] duration-200 ${isSidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[200px]'}`}>
          <header
            className="sticky top-0 z-30 border-b border-slate-200 shadow-sm/5"
            style={{ backgroundColor: appearance.pageCardColor, color: appearance.pageTextColor }}
          >
            <div className="flex h-14 items-center justify-between px-4">
              <div className="flex min-w-0 items-center gap-4">
                <button
                  type="button"
                  aria-label="Open navigation"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Menu size={20} />
                </button>

                <div className="flex items-center gap-6">
                  {(!sectionTabs.length || currentTitle !== 'Attendance') && (
                    <p className="truncate text-xl font-bold text-slate-900">
                      {currentTitle}
                    </p>
                  )}
                  {sectionTabs.length > 0 && (
                    <SectionTabs tabs={sectionTabs} className="mb-0 border-none !bg-transparent" />
                  )}
                  <div id="hr-header-portal-target"></div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Sidebar settings button removed per user request */}



                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50">
                  <AnnouncementDropdown />
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50">
                  <DashboardThemeSettings />
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50">
                  <NotificationDropdown />
                </div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowProfilePopup((prev) => !prev)}
                    className="flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3"
                  >
                    {hasWorkingProfileImage ? (
                      <img
                        src={profileImageUrl}
                        alt={employeeDisplayName}
                        className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                        onError={() => setBrokenProfileImageUrl(profileImageUrl)}
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                        {employeeInitials}
                      </div>
                    )}
                    {/* Name removed per user request */}
                  </button>

                  {showProfilePopup && (
                    <>
                      <button
                        type="button"
                        aria-label="Close employee popup"
                        className="fixed inset-0 z-30"
                        onClick={() => setShowProfilePopup(false)}
                      />
                      <div className="absolute right-0 top-[calc(100%+10px)] z-40 w-[320px] rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            {hasWorkingProfileImage ? (
                              <img
                                src={profileImageUrl}
                                alt={employeeDisplayName}
                                className="h-10 w-10 rounded-lg border border-slate-200 object-cover"
                                onError={() => setBrokenProfileImageUrl(profileImageUrl)}
                              />
                            ) : (
                              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                                {employeeInitials}
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{employeeDisplayName}</p>
                              <p className="text-xs text-slate-500">{profile?.employeeId || user?.employeeId || 'Employee'}</p>
                            </div>
                          </div>
                          <button type="button" onClick={() => setShowProfilePopup(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
                            <X size={14} />
                          </button>
                        </div>

                        <div className="space-y-3">




                          {user?.email && (
                            <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                              <User size={16} className="text-slate-500" />
                              <div className="min-w-0">

                                <p className="truncate text-sm text-slate-700">{user.email}</p>
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              navigate('/employee/profile');
                              setShowProfilePopup(false);
                            }}
                            className="w-full rounded-lg border border-sky-200 bg-sky-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-sky-700"
                          >
                            My Profile
                          </button>

                          <button
                            type="button"
                            onClick={async () => {
                              setShowProfilePopup(false);
                              await handleLogout();
                            }}
                            className="w-full rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-100"
                          >
                            Logout
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-0" style={{ backgroundColor: appearance.pageBgColor }}>
            <div
              className="min-h-[calc(100vh-104px)] overflow-hidden rounded-none border-0"
              style={{ backgroundColor: appearance.pageCardColor, color: appearance.pageTextColor, padding: '12px' }}
            >
              <ErrorBoundary>
                <Outlet context={{ activeTab, setActiveTab: setManualActiveTab, isSidebarCollapsed }} />
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      <style>{`
        .employee-panel *:not(.employee-sidebar-scroll) {
          scrollbar-width: thin;
        }

        .employee-panel *:not(.employee-sidebar-scroll)::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }

        .employee-panel *:not(.employee-sidebar-scroll)::-webkit-scrollbar-track {
          background: transparent;
        }

        .employee-panel *:not(.employee-sidebar-scroll)::-webkit-scrollbar-thumb {
          background: rgba(203, 213, 225, 0.95);
          border-radius: 999px;
        }

        .employee-panel *:not(.employee-sidebar-scroll)::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 1);
        }

        /* Theme Overrides */
        :root {
          --hr-page-bg: ${appearance.pageBgColor} !important;
          --hr-card-bg: ${appearance.pageCardColor} !important;
          --hr-text-color: ${appearance.pageTextColor} !important;
          --hr-metric-bg: ${appearance.metricBgColor || appearance.pageCardColor} !important;
          --hr-metric-text: ${appearance.metricTextColor || appearance.pageTextColor} !important;
          --hr-sidebar-bg: ${appearance.sidebarBgColor || appearance.pageCardColor} !important;
          --hr-sidebar-text: ${appearance.sidebarTextColor || appearance.pageTextColor} !important;
          --hr-sidebar-active-text: ${appearance.sidebarActiveColor || '#0369a1'} !important;
          --hr-sidebar-active-bg: ${appearance.sidebarActiveBgColor || '#f0f9ff'} !important;
          --hr-sidebar-hover-bg: ${appearance.sidebarHoverBgColor || '#f8fafc'} !important;
          --hr-sidebar-hover-text: ${appearance.sidebarHoverTextColor || appearance.sidebarTextColor || '#000000'} !important;
          --hr-button-text: ${appearance.buttonTextColor || '#ffffff'} !important;
        }

        .employee-panel .bg-white {
          background-color: var(--hr-card-bg) !important;
        }
        .employee-panel .text-slate-900 {
          color: var(--hr-text-color);
        }
        .employee-panel h1, .employee-panel h2, .employee-panel h3, .employee-panel h4, .employee-panel p, .employee-panel span, .employee-panel label {
          color: var(--hr-text-color);
        }
        .employee-panel .metric-card, .employee-panel .metric-card * {
          color: var(--hr-metric-text) !important;
        }
        .employee-panel section, .employee-panel .rounded-2xl, .employee-panel .rounded-xl {
           background-color: var(--hr-card-bg);
           color: var(--hr-text-color);
        }
        .employee-panel header {
           background-color: var(--hr-card-bg) !important;
        }
        .employee-panel aside, .employee-panel .employee-sidebar {
           background-color: var(--hr-sidebar-bg) !important;
           color: var(--hr-sidebar-text) !important;
        }
        .employee-panel aside *, .employee-panel .employee-sidebar * {
           color: var(--hr-sidebar-text) !important;
        }

        /* Sidebar Interaction Styles */
        .employee-panel .sidebar-item-active,
        .employee-panel aside .sidebar-item-active {
           background-color: var(--hr-sidebar-active-bg) !important;
           color: var(--hr-sidebar-active-text) !important;
        }
        .employee-panel .sidebar-item-active *,
        .employee-panel aside .sidebar-item-active * {
           color: var(--hr-sidebar-active-text) !important;
        }
        
        .employee-panel .sidebar-item-inactive:hover,
        .employee-panel aside .sidebar-item-inactive:hover {
           background-color: var(--hr-sidebar-hover-bg) !important;
           opacity: 1 !important;
        }
        .employee-panel .sidebar-item-inactive:hover *,
        .employee-panel .sidebar-item-inactive:hover svg,
        .employee-panel aside .sidebar-item-inactive:hover *,
        .employee-panel aside .sidebar-item-inactive:hover svg {
           color: var(--hr-sidebar-hover-text) !important;
           stroke: var(--hr-sidebar-hover-text) !important;
        }

        .employee-panel .sidebar-icon-active,
        .employee-panel aside .sidebar-icon-active {
           background-color: var(--hr-sidebar-active-bg) !important;
           color: var(--hr-sidebar-active-text) !important;
           border-color: var(--hr-sidebar-active-text) !important;
        }
        .employee-panel .sidebar-icon-active *,
        .employee-panel aside .sidebar-icon-active * {
           color: var(--hr-sidebar-active-text) !important;
        }

        /* PRIMARY BUTTON TEXT COLOR */
        .employee-panel button.bg-slate-900,
        .employee-panel .bg-slate-900,
        .employee-panel button[type="submit"],
        .employee-panel .ant-btn-primary {
           color: var(--hr-button-text) !important;
        }

        .ess-overdue-modal .ant-modal-content {
          border-radius: 16px;
          box-shadow: 0 22px 50px rgba(15, 23, 42, 0.2);
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }

        .ess-overdue-modal .ant-modal-header {
          border-bottom: 1px solid #e2e8f0;
          margin-bottom: 14px;
          padding-bottom: 12px;
        }

        .ess-overdue-modal .ant-modal-title {
          font-size: 18px;
          font-weight: 700;
          color: #0f172a;
        }

        .ess-overdue-modal .ant-modal-body {
          padding-top: 4px;
        }

        .ess-overdue-modal .ant-modal-confirm-btns {
          margin-top: 14px;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
      `}</style>
    </div>
  );
}
