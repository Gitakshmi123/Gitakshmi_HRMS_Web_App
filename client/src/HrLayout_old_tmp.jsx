import React, { useState, useContext, useEffect } from 'react';
import HRSidebar, { NAV_GROUPS } from '../components/HRSidebar';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UIContext } from '../context/UIContext';
import { Menu, LogOut, Building2, Mail, Phone, X, ArrowLeft } from 'lucide-react';
import NotificationDropdown from '../components/NotificationDropdown';
import ErrorBoundary from '../components/ErrorBoundary';
import api from '../utils/api';

export default function HRLayout() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [profile, setProfile] = useState(null);
  const [tenantName, setTenantName] = useState('');
  const [tenant, setTenant] = useState(null);
  const [showCompanyPopup, setShowCompanyPopup] = useState(false);

  const uiContext = useContext(UIContext);
  const { theme, toggleTheme } = uiContext || { theme: 'light', toggleTheme: () => { } };

  useEffect(() => {
    if (user) {
      api.get('/employee/profile').then(res => setProfile(res.data)).catch(() => { });
      api.get('/tenants/me').then(res => {
        setTenant(res.data);
        setTenantName(res.data?.name || '');
      }).catch(() => { });
    }
  }, [user]);

  const getActivePageName = () => {
    // Check if we are viewing a job specific candidates /hr/job/:id/candidates
    if (location.pathname.includes('/job/') && location.pathname.includes('/candidates')) {
      return 'External Applicants';
    }
    // General matching
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        if (item.to && location.pathname === item.to) {
          return item.label;
        }
      }
    }
    // Fallback partial matching if exact path isn't mapped
    if (location.pathname.includes('/payroll/dashboard')) return 'Stats';
    if (location.pathname.includes('/payroll/salary-components')) return 'Salary';
    if (location.pathname.includes('/payroll/compensation')) return 'Compensation';
    if (location.pathname.includes('/payroll/process')) return 'Process';
    if (location.pathname.includes('/payroll/run')) return 'History';
    if (location.pathname.includes('/payroll/payslips')) return 'Payslips';
    if (location.pathname.includes('/create-requirement')) return 'Create Requirement';
    if (location.pathname.includes('/positions')) return 'Position Master';
    if (location.pathname.includes('/internal-applicants')) return 'Internal Applicants';
    if (location.pathname.includes('/applicants')) return 'External Applicants';
    if (location.pathname.includes('/candidate-status')) return 'Tracker';
    if (location.pathname.includes('/attendance-calendar')) return 'Calendar';
    if (location.pathname.includes('/face-update-requests')) return 'Face Updates';
    if (location.pathname.includes('/attendance')) return 'Dashboard'; // from Attendance Dashboard
    if (location.pathname.includes('/leave-approvals')) return 'Requests';
    if (location.pathname.includes('/leave-policies')) return 'Policies';
    if (location.pathname.includes('/reports')) return 'Reports';
    if (location.pathname.includes('/employees')) return 'Employees';
    if (location.pathname.includes('/departments')) return 'Departments';
    if (location.pathname.includes('/org')) return 'Org Structure';
    if (location.pathname.includes('/users')) return 'Users';
    return 'Dashboard';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const fullName = profile ? `${profile.firstName} ${profile.lastName}` : user?.name || 'HR Admin';

  const [sidebarHovered, setSidebarHovered] = useState(false);

  const isMainDashboard = location.pathname === '/hr' || location.pathname === '/hr/';

  return (
    <div className={`flex h-screen bg-white dark:bg-[#0F172A] transition-colors duration-300 ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Mobile/Tablet Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[59] lg:hidden transition-all duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: drawer on mobile/tablet, icon-collapsed on lg+, hover-expands */}
      <div
        onMouseEnter={() => setSidebarHovered(true)}
        onMouseLeave={() => setSidebarHovered(false)}
        className={`no-print fixed h-screen z-[60] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group
          ${sidebarOpen
            ? 'translate-x-0 w-72'
            : `-translate-x-full lg:translate-x-0 ${sidebarHovered ? 'lg:w-72' : 'lg:w-20'}`
          }`}
      >
        <HRSidebar
          activeTab={activeTab}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Main Content: shifts based on sidebar state */}
      <div className={`flex-1 flex flex-col w-full h-screen overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
        ${sidebarHovered ? 'lg:ml-72' : 'lg:ml-20'}`}>
        {/* Header */}
        <header className="no-print flex justify-between items-center px-4 sm:px-6 md:px-8 h-14 sm:h-20 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 sticky top-0 z-10">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2.5 rounded-2xl hover:bg-white dark:hover:bg-slate-800 transition-all text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm shrink-0"
            >
              <Menu size={18} />
            </button>
            <div className="hidden lg:flex items-center gap-4 min-w-0">
              {!isMainDashboard && (
                <button
                  onClick={() => navigate(-1)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-slate-900 border border-slate-200 dark:border-slate-700 hover:shadow-sm transition-all shrink-0"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <h1 className="text-sm sm:text-lg font-black text-slate-700 dark:text-white uppercase tracking-tight truncate">
                {getActivePageName()}
              </h1>
            </div>
            {/* Mobile page title */}
            <div className="md:hidden flex items-center gap-2">
              {!isMainDashboard && (
                <button
                  onClick={() => navigate(-1)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 shrink-0"
                >
                  <ArrowLeft size={14} />
                </button>
              )}
              <h1 className="text-sm font-black text-slate-700 dark:text-white uppercase tracking-tight truncate">
                {getActivePageName()}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-5 shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 dark:bg-slate-950 p-1 sm:p-1.5 rounded-[1.25rem] border border-slate-200/50 dark:border-slate-800/50">


              <div className="relative">
                <NotificationDropdown />
              </div>


            </div>

            <div className="h-8 sm:h-10 w-px bg-slate-200 dark:bg-slate-800"></div>

            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden lg:block text-right">
                <p className="text-xs font-semibold text-slate-700 dark:text-white leading-none">{fullName}</p>
                {tenantName && (
                  <p className="text-[9px] font-normal text-slate-400 dark:text-slate-500 mt-0.5 truncate max-w-[120px]">{tenantName}</p>
                )}
              </div>

              {/* Avatar button with company popup */}
              <div className="relative">
                <button
                  onClick={() => setShowCompanyPopup(p => !p)}
                  className="relative cursor-pointer block"
                >
                  <div className="h-9 w-9 sm:h-11 sm:w-11 rounded-2xl bg-gradient-to-tr from-[#4F46E5] to-indigo-600 p-[2px] shadow-lg shadow-indigo-500/20 hover:scale-105 transition-all duration-300">
                    <div className="w-full h-full rounded-[14px] bg-white dark:bg-slate-900 overflow-hidden flex items-center justify-center">
                      {profile?.profilePic ? (
                        <img src={profile.profilePic} alt="profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-[#4F46E5] dark:text-indigo-400">{(tenantName || fullName)?.[0]?.toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                </button>

                {/* Company detail popup */}
                {showCompanyPopup && (
                  <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setShowCompanyPopup(false)} />
                    <div className="absolute right-0 top-14 z-50 w-72 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-2xl shadow-slate-200/60 overflow-hidden"
                      style={{ animation: 'csDropIn .15s cubic-bezier(.4,0,.2,1)' }}>
                      {/* Header */}
                      <div className="bg-gradient-to-r from-[#4F46E5] to-indigo-600 px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <Building2 size={20} className="text-white" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white leading-none">{tenant?.name || tenantName}</p>
                            <p className="text-[10px] text-indigo-100 mt-0.5">{tenant?.code || ''}</p>
                          </div>
                        </div>
                        <button onClick={() => setShowCompanyPopup(false)} className="text-white/70 hover:text-white transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                      {/* Details */}
                      <div className="p-4 space-y-3">
                        {tenant?.adminEmail && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-[#4F46E5] shrink-0">
                              <Mail size={14} />
                            </div>
                            <div>
                              <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide">Email</p>
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{tenant.adminEmail}</p>
                            </div>
                          </div>
                        )}
                        {tenant?.phone && (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-[#4F46E5] shrink-0">
                              <Phone size={14} />
                            </div>
                            <div>
                              <p className="text-[9px] font-medium text-slate-400 uppercase tracking-wide">Phone</p>
                              <p className="text-xs font-medium text-slate-700 dark:text-slate-200">{tenant.phone}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Footer */}
                      <div className="px-4 pb-4">
                        <button
                          onClick={() => { navigate('/hr/settings/company'); setShowCompanyPopup(false); }}
                          className="w-full py-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-[#4F46E5] text-xs font-semibold hover:bg-indigo-100 transition-colors border border-indigo-100 dark:border-indigo-800"
                        >
                          View Company Profile →
                        </button>
                      </div>
                    </div>
                    <style>{`
                      @keyframes csDropIn {
                        from { opacity: 0; transform: translateY(-6px) scale(0.98); }
                        to   { opacity: 1; transform: translateY(0) scale(1); }
                      }
                    `}</style>
                  </>
                )}
              </div>

              <button
                onClick={handleLogout}
                className="p-2 sm:p-3 text-slate-400 hover:text-rose-500 bg-slate-50 dark:bg-slate-950 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-2xl transition-all border border-slate-200/50 dark:border-slate-800/50 hover:border-rose-200 dark:hover:border-rose-900/40 group shadow-sm"
                title="Terminate Session"
              >
                <LogOut size={16} className="group-hover:translate-x-1 transition-transform sm:w-[18px] sm:h-[18px]" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3 sm:p-4 lg:p-8 overflow-y-auto overflow-x-hidden bg-white dark:bg-[#0F172A] custom-scrollbar">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

