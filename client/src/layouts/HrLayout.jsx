import React, { useContext, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, Briefcase, Building2, CalendarDays, ChevronLeft, ChevronRight, FileText, Fingerprint, LayoutDashboard, LogOut, Mail, Menu, Paintbrush, Plane, Settings2, Shield, UserCog, Users, ExternalLink, Share2, History, UserPlus, BarChart, Clock, MapPin, Settings } from 'lucide-react';
import HRSidebar from '../components/HRSidebar';
import NotificationDropdown from '../components/NotificationDropdown';
import AnnouncementDropdown from '../components/AnnouncementDropdown';
import api from '../utils/api';
import ErrorBoundary from '../components/ErrorBoundary';
import { useAuth } from '../context/AuthContext';
import { useRBAC } from '../context/RBACContext';
import { UIContext } from '../context/UIContext';
import SectionTabs from '../components/HR/SectionTabs';
import { getScopedStorageKey } from '../utils/sidebarStorage';
import DashboardThemeSettings from '../components/DashboardThemeSettings';
import { getSectionTabs } from '../utils/hrmsNavigationHierarchy';
// import HRMSAssistantWidget from '../components/common/HRMSAssistantWidget';

const DEFAULT_APPEARANCE = {
  tabsPlacement: 'top',
  pageBgColor: '#ffffff',
  pageCardColor: '#ffffff',
  pageTextColor: '#0f172a',
};

export default function HRLayout() {
  const { user, logout, hasModule } = useAuth();
  const { hasPermission } = useRBAC();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [employeesPanelRequestedOpen, setEmployeesPanelRequestedOpen] = useState(false);
  const [tabsPlacement, setTabsPlacement] = useState('top');
  const [appearance, setAppearance] = useState(DEFAULT_APPEARANCE);
  const uiContext = useContext(UIContext);
  const { theme } = uiContext || { theme: 'light' };
  const scopedSidebarAdvancedKey = useMemo(
    () => getScopedStorageKey('hrms:sidebar:advanced-config:v1', { user, panel: 'hr' }),
    [user]
  );

  const pathPrefix = location.pathname.startsWith('/tenant') ? '/tenant' : '/hr';

  useEffect(() => {
    const onToggle = (e) => setEmployeesPanelRequestedOpen(!!e?.detail?.open);
    window.addEventListener('hrms:employees:panel', onToggle);
    return () => window.removeEventListener('hrms:employees:panel', onToggle);
  }, []);


  useEffect(() => {
    const readTabsPlacement = () => {
      try {
        const cfg = JSON.parse(
          localStorage.getItem(scopedSidebarAdvancedKey) ||
          localStorage.getItem('hrms:sidebar:advanced-config:v1') ||
          '{}'
        );
        const ap = cfg?.appearance || {};
        const placement = ap?.tabsPlacement;
        setTabsPlacement(placement === 'hidden' ? 'hidden' : 'top');
        setAppearance({
          tabsPlacement: placement === 'hidden' ? 'hidden' : 'top',
          pageBgColor: String(ap?.pageBgColor || DEFAULT_APPEARANCE.pageBgColor),
          pageCardColor: String(ap?.pageCardColor || DEFAULT_APPEARANCE.pageCardColor),
          pageTextColor: String(ap?.pageTextColor || DEFAULT_APPEARANCE.pageTextColor),
          accentColor: String(ap?.accentColor || '#6366f1'),
          borderRadius: String(ap?.borderRadius || '16'),
          glassEffect: !!ap?.glassEffect,
          fontFamily: String(ap?.fontFamily || 'Inter'),
          cardVariant: String(ap?.cardVariant || 'Standard'),
          metricBgColor: String(ap?.metricBgColor || ''),
          metricTextColor: String(ap?.metricTextColor || ''),
          sidebarBgColor: String(ap?.sidebarBgColor || ''),
          sidebarTextColor: String(ap?.sidebarTextColor || ''),
          sidebarActiveColor: String(ap?.sidebarActiveColor || ''),
          buttonTextColor: String(ap?.buttonTextColor || '#ffffff'),
        });
      } catch {
        setTabsPlacement('top');
        setAppearance(DEFAULT_APPEARANCE);
      }
    };
    readTabsPlacement();
    window.addEventListener('focus', readTabsPlacement);
    window.addEventListener('hrms:appearance:changed', readTabsPlacement);
    return () => {
      window.removeEventListener('focus', readTabsPlacement);
      window.removeEventListener('hrms:appearance:changed', readTabsPlacement);
    };
  }, [location.pathname, scopedSidebarAdvancedKey]);

  const isMainDashboard = ['/hr', '/hr/', '/tenant/dashboard', '/tenant', '/tenant/', '/hr/dashboard', '/tenant/my-dashboard', '/hr/my-dashboard'].includes(location.pathname);

  const sectionTabs = useMemo(() => {
    const sections = getSectionTabs(pathPrefix, {
      dashboard: LayoutDashboard,
      organization: MapPin,
      employees: Users,
      departments: Building2,
      users: UserCog,
      requirements: Briefcase,
      settings: Settings2,
      leave: Plane,
      clock: Clock,
      history: History,
      pin: MapPin,
      calendar: CalendarDays,
      fingerprint: Fingerprint,
      payroll: Banknote,
      file: FileText,
      paint: Paintbrush,
      shield: Shield,
      mail: Mail,
      share: Share2,
      userPlus: UserPlus,
      chart: BarChart,
    }).map((section) => {
      if (!section.match.includes('/career-builder')) return section;
      return {
        ...section,
        tabs: [
          ...section.tabs,
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
                // ignore and use fallback below
              }

              const fallbackCode = String(user?.companyCode || '').trim();
              if (fallbackCode) {
                window.open(`/jobs/${encodeURIComponent(fallbackCode)}`, '_blank', 'noopener,noreferrer');
              }
            },
          },
        ],
      };
    });

    const currentSection = sections.find((section) =>
      section.match.some((prefix) => location.pathname.startsWith(`${pathPrefix}${prefix}`)),
    );

    if (!currentSection) return [];

    // Strict granular filtering — all users (including admins) see only permitted tabs
    return currentSection.tabs.filter(tab => !tab.permission || hasPermission(tab.permission, 'any'));
  }, [location.pathname, pathPrefix, hasPermission, user?.companyCode]);

  const pageTitle = useMemo(() => {
    const path = location.pathname;
    if (path.includes('/my-dashboard')) return 'Dashboard';
    if (path.includes('/my-attendance')) return '';
    if (path.includes('/my-payslips')) return '';
    if (path.includes('/my-documents')) return 'My Documents';
    if (path.includes('/internal-jobs')) return 'Internal Jobs';
    if (path.includes('/support-center') || path.includes('/support_center') || path.includes('/my-support')) return 'Support Center';
    if (path.includes('/resignation')) return 'Resignation';
    if (path.includes('/reports')) return '';
    if (path.includes('/tickets')) return 'Ticket Inbox';
    if (path.includes('/access')) return 'Access';
    if (path.includes('/social-media')) return '';
    if (path.includes('/bgv')) return '';
    if (path.includes('/onboarding')) return '';
    if (path.includes('/employees') && !path.includes('/profile')) return '';
    if (path.includes('/branches')) return '';
    if (path.includes('/departments')) return '';
    if (path.includes('/org')) return '';
    if (path.includes('/users')) return '';
    if (path.includes('/attendance')) return '';
    if (path.includes('/exit-management')) return 'Resignation';
    if (path.includes('/leave-policies') || path.includes('/organization-policies')) return '';
    if (path.includes('/leave-approvals')) return '';
    if (path.includes('/leave-requests')) return 'Leave Requests';
    if (path.includes('/payroll')) return '';
    if (path.includes('/requirements')) return '';
    if (path.includes('/candidate-status')) return '';
    if (path.includes('/policy') && !path.includes('/leave-')) return 'Policy';
    return '';
  }, [location.pathname]);

  const isAccessWorkspace = location.pathname.includes('/access');

  return (
    <div
      className={`hr-panel h-screen overflow-hidden text-slate-800 ${theme === 'dark' ? 'dark' : ''}`}
      style={{
        '--hr-sidebar-width': sidebarCollapsed ? '80px' : '200px',
        '--hr-page-bg': appearance.pageBgColor,
        '--hr-card-bg': appearance.pageCardColor,
        '--hr-text-color': appearance.pageTextColor,
        backgroundColor: appearance.pageBgColor,
        color: appearance.pageTextColor,
      }}
    >
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-slate-500/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex h-screen overflow-hidden">
        <div
          className={`fixed inset-y-0 left-0 z-50 transform transition-[width,transform] duration-200 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            } w-[200px] ${sidebarCollapsed ? 'lg:w-[80px]' : 'lg:w-[200px]'}`}
        >
          <HRSidebar
            collapsed={sidebarCollapsed}
            onClose={() => setSidebarOpen(false)}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          />
          <button
            type="button"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="absolute right-0 top-14 hidden translate-x-1/2 items-center justify-center text-slate-300 hover:text-sky-600 transition lg:inline-flex"
            title={sidebarCollapsed ? 'Open sidebar menu' : 'Collapse sidebar menu'}
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <div className={`flex h-screen flex-1 flex-col overflow-hidden transition-[padding] duration-200 ${sidebarCollapsed ? 'lg:pl-[80px]' : 'lg:pl-[200px]'}`}>
          <header
            className={`sticky top-0 z-50 border-b border-slate-100 shadow-sm/5 ${isMainDashboard ? 'min-h-[62px]' : ''} ${appearance.glassEffect ? 'backdrop-blur-md !bg-white/70' : ''}`}
            style={{ 
              backgroundColor: appearance.pageCardColor, 
              color: appearance.pageTextColor,
              borderRadius: '0'
            }}
          >
            <div className={`px-4 sm:px-5 lg:px-6 ${isMainDashboard ? 'py-2' : 'pt-4 pb-3'}`}>
              <div className="flex items-center justify-between gap-4">
                <div className={`flex min-w-0 flex-1 items-center gap-4 ${isMainDashboard ? 'min-h-[36px]' : ''}`}>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    className="inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-bold text-slate-700 lg:hidden shadow-sm shadow-slate-100"
                    style={{ borderRadius: `${appearance.borderRadius}px`, backgroundColor: appearance.pageCardColor, borderColor: 'rgba(0,0,0,0.1)' }}
                  >
                    <Menu size={18} />
                    <span>Menu</span>
                  </button>

                  <div className={`flex items-center gap-6 ${isMainDashboard ? 'w-full justify-end lg:justify-start' : ''}`}>
                    {(pageTitle || isAccessWorkspace) && (
                      <div className="min-w-0">
                        <h1 className="truncate text-[1.85rem] font-black tracking-tight text-slate-900 leading-none antialiased">
                          {isAccessWorkspace ? 'Access' : pageTitle}
                        </h1>
                      </div>
                    )}
                    <div id="hr-header-portal-target" className="flex-1 min-w-0"></div>
                    {!isMainDashboard && tabsPlacement !== 'hidden' && sectionTabs.length > 0 && (
                      <div className="-mb-1 flex-1">
                        <SectionTabs tabs={sectionTabs} className="border-none mb-0 bg-transparent sticky-none p-0" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div 
                    className="flex items-center justify-center border border-slate-200 bg-white transition hover:bg-slate-50 shadow-sm shadow-slate-100 h-11 w-11"
                    style={{ borderRadius: `${appearance.borderRadius}px` }}
                  >
                    <AnnouncementDropdown />
                  </div>

                  {hasModule('customStudio') && (
                    <div 
                      className="flex items-center justify-center border border-slate-200 bg-white transition hover:bg-slate-50 shadow-sm shadow-slate-100 h-11 w-11"
                      style={{ borderRadius: `${appearance.borderRadius}px` }}
                    >
                      <DashboardThemeSettings />
                    </div>
                  )}

                  <div 
                    className="flex items-center justify-center border border-slate-200 bg-white transition hover:bg-slate-50 shadow-sm shadow-slate-100 h-11 w-11"
                    style={{ borderRadius: `${appearance.borderRadius}px` }}
                  >
                    <NotificationDropdown />
                  </div>

                  <button
                    type="button"
                    onClick={logout}
                    className="inline-flex items-center justify-center border border-slate-200 bg-white text-slate-700 hover:text-rose-600 hover:border-rose-100 hover:bg-rose-50 transition-all duration-300 shadow-sm shadow-slate-100 h-11 w-11"
                    style={{ borderRadius: `${appearance.borderRadius}px` }}
                    title="Logout"
                  >
                    <LogOut size={20} />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto px-0 pt-0 pb-0" style={{ backgroundColor: 'var(--hr-page-bg)' }}>
            <div
              className={`min-h-[calc(100vh-62px)] overflow-hidden border-0 ${appearance.glassEffect ? 'backdrop-blur-lg !bg-white/60 shadow-xl' : ''}`}
              style={{ 
                backgroundColor: 'transparent', 
                color: 'var(--hr-text-color)',
                borderRadius: '0',
                margin: '0',
                padding: '12px'
              }}
            >
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Roboto:wght@400;500;700;900&family=Playfair+Display:wght@400;500;600;700;800;900&family=Montserrat:wght@400;600;800&family=Poppins:wght@400;600;800&family=Lexend:wght@400;600;800&family=DM+Sans:wght@400;700&family=Quicksand:wght@400;700&family=Lora:wght@400;700&display=swap');

        .hr-panel *:not(.hr-sidebar-scroll) {
          scrollbar-width: thin;
        }

        .hr-panel *:not(.hr-sidebar-scroll)::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }

        .hr-panel *:not(.hr-sidebar-scroll)::-webkit-scrollbar-track {
          background: transparent;
        }

        .hr-panel *:not(.hr-sidebar-scroll)::-webkit-scrollbar-thumb {
          background: rgba(203, 213, 225, 0.95);
          border-radius: 999px;
        }

        .hr-panel *:not(.hr-sidebar-scroll)::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 1);
        }

        :root {
          --hr-page-bg: ${appearance.pageBgColor};
          --hr-card-bg: ${appearance.pageCardColor};
          --hr-text-color: ${appearance.pageTextColor};
          --hr-accent-color: ${appearance.accentColor || '#6366f1'};
          --hr-border-radius: ${appearance.borderRadius || '16'}px;
          --hr-font-family: '${appearance.fontFamily || 'Inter'}', sans-serif;
          --hr-metric-bg: ${appearance.metricBgColor || appearance.pageCardColor};
          --hr-metric-text: ${appearance.metricTextColor || appearance.pageTextColor};
          --hr-sidebar-bg: ${appearance.sidebarBgColor || appearance.pageCardColor};
          --hr-sidebar-text: ${appearance.sidebarTextColor || appearance.pageTextColor};
          --hr-sidebar-active: ${appearance.sidebarActiveColor || (appearance.accentColor || '#6366f1')};
          --hr-sidebar-hover-text: ${appearance.sidebarHoverTextColor || appearance.sidebarActiveColor || appearance.accentColor};
          --hr-sidebar-hover-bg: ${appearance.sidebarHoverBgColor || 'rgba(0,0,0,0.04)'};
          --hr-button-text: ${appearance.buttonTextColor || '#ffffff'};
        }

        .hr-panel, .hr-panel body, .hr-panel main, .hr-panel #root {
          background-color: var(--hr-page-bg) !important;
          color: var(--hr-text-color) !important;
          font-family: var(--hr-font-family) !important;
        }

        .hr-panel .bg-white, 
        .hr-panel .bg-slate-50,
        .hr-panel .bg-gray-50,
        .hr-panel .bg-slate-100,
        .hr-panel header,
        .hr-panel .hr-header {
          background-color: var(--hr-card-bg) !important;
        }

        .hr-panel aside *,
        .hr-panel .hr-sidebar * {
          color: var(--hr-sidebar-text);
          transition: all 0.2s ease;
        }

        .hr-panel aside a:hover, 
        .hr-panel aside button:hover {
          background-color: var(--hr-sidebar-hover-bg) !important;
        }
        
        .hr-panel aside a:hover *, 
        .hr-panel aside button:hover * {
          color: var(--hr-sidebar-hover-text) !important;
        }

        .hr-panel aside .active,
        .hr-panel aside .active * {
          color: var(--hr-sidebar-active) !important;
          font-weight: 800 !important;
        }

        /* ALL text should follow the theme */
        .hr-panel h1, .hr-panel h2, .hr-panel h3, .hr-panel h4, .hr-panel p, .hr-panel span, .hr-panel label {
          color: var(--hr-text-color);
        }

        .hr-panel .metric-card, .hr-panel .metric-card * {
          color: var(--hr-metric-text) !important;
        }

        /* ACCENT COLOR OVERRIDES */
        .hr-panel .text-sky-600, 
        .hr-panel .text-indigo-600, 
        .hr-panel .text-sky-500, 
        .hr-panel .text-indigo-500,
        .hr-panel .bg-sky-600, 
         .hr-panel .bg-indigo-600, 
         .hr-panel .bg-sky-500, 
         .hr-panel .bg-indigo-500,
         .hr-panel .ant-btn-primary,
         .hr-panel button.bg-slate-900 {
            color: var(--hr-button-text) !important;
            background-color: var(--hr-accent-color) !important;
            border-color: var(--hr-accent-color) !important;
         }

         .hr-panel .border-sky-600,
         .hr-panel .border-indigo-600 {
            color: var(--hr-accent-color) !important;
            border-color: var(--hr-accent-color) !important;
         }

        .hr-panel .bg-indigo-50, .hr-panel .bg-sky-50 {
           background-color: color-mix(in srgb, var(--hr-accent-color) 10%, transparent) !important;
        }

        /* All borders should be subtle but visible */
        .hr-panel .border, 
        .hr-panel .border-slate-100, 
        .hr-panel .border-slate-200 {
           border-color: rgba(0,0,0,0.1) !important;
           ${appearance.cardVariant === 'Minimal' ? 'border: none !important;' : ''}
           ${appearance.cardVariant === 'Neon' ? 'border: 2px solid var(--hr-accent-color) !important; box-shadow: 0 0 15px var(--hr-accent-color)50 !important;' : ''}
           ${appearance.cardVariant === 'Soft' ? 'border: 3px solid rgba(0,0,0,0.05) !important;' : ''}
        }

        .hr-panel .rounded-2xl, 
        .hr-panel .rounded-xl,
        .hr-panel .card,
        .hr-panel .ant-card,
        .hr-panel section {
           background-color: var(--hr-card-bg) !important;
           color: var(--hr-text-color) !important;
           border-radius: var(--hr-border-radius) !important;
           transition: all 0.3s ease;
           
           ${appearance.cardVariant === 'Floating' ? 'box-shadow: 0 30px 60px rgba(0,0,0,0.12) !important;' : ''}
           ${appearance.cardVariant === 'Minimal' ? 'box-shadow: none !important; border: none !important;' : ''}
           ${appearance.cardVariant === 'Glassy' ? 'background-color: rgba(255, 255, 255, 0.1) !important; backdrop-filter: blur(20px) !important; border: 1px solid rgba(255,255,255,0.2) !important;' : ''}
           ${appearance.cardVariant === 'Neon' ? 'border: 2px solid var(--hr-accent-color) !important; box-shadow: 0 0 20px var(--hr-accent-color)40 !important;' : ''}
           ${appearance.cardVariant === 'Soft' ? 'box-shadow: 0 10px 20px rgba(0,0,0,0.03) !important; border: 4px solid rgba(0,0,0,0.04) !important;' : ''}
        }

        /* Glassmorphism Logic */
        ${appearance.glassEffect || appearance.cardVariant === 'Glassy' ? `
          .hr-panel .rounded-2xl, .hr-panel .rounded-xl, .hr-panel section, .hr-panel .card {
             background-color: rgba(255, 255, 255, 0.05) !important;
             backdrop-filter: blur(12px) !important;
             border: 1px solid rgba(255, 255, 255, 0.1) !important;
          }
        ` : ''}
      `}</style>
    </div>
  );
}
