import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { useJobPortalAuth } from '../context/JobPortalAuthContext';
import {
  LogOut, User, Briefcase, FileText,
  LayoutDashboard, ChevronDown,
  Bell, ArrowLeft, Shield, UploadCloud
} from 'lucide-react';
import { getCandidateTenantId } from '../utils/auth';

export default function JobPortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { candidate, logoutCandidate } = useJobPortalAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const tenantId = getCandidateTenantId();
  const isMainDashboard = location.pathname === '/candidate/dashboard';

  const handleLogout = () => {
    const tid = candidate?.tenantId || getCandidateTenantId();
    logoutCandidate();
    if (tid) {
      navigate(`/jobs/${tid}`);
    } else {
      navigate('/');
    }
  };

  useEffect(() => {
    const handlePopState = (event) => {
      const path = window.location.pathname;
      if (path.includes('/apply-job/') || path.includes('/application/')) {
        event.preventDefault();
        const tid = tenantId || getCandidateTenantId();
        if (tid) {
          navigate(`/jobs/${tid}`, { replace: true });
        } else {
          navigate('/candidate/dashboard', { replace: true });
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate, tenantId]);

  const menuItems = [
    { path: '/candidate/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/candidate/open-positions', icon: Briefcase, label: 'Open Positions' },
    { path: '/candidate/applications', icon: FileText, label: 'My Applications' },
    { path: '/candidate/upload-documents', icon: UploadCloud, label: 'Upload Documents' },
    { path: '/candidate/profile', icon: User, label: 'My Profile' }
  ];

  return (
    <div className="h-screen overflow-hidden bg-slate-50 font-sans flex flex-col selection:bg-indigo-100 selection:text-indigo-600">
      {/* LUXURY TOP HEADER */}
      <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-6 min-w-0">
          <div className="flex items-center gap-6">
            {!isMainDashboard && (
              <button
                onClick={() => navigate(`/jobs/${tenantId}`)}
                className="group flex items-center gap-3 text-slate-500 hover:text-indigo-600 transition-all font-black text-[10px] uppercase tracking-[0.2em] whitespace-nowrap"
              >
                <div className="bg-white p-2 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:scale-105 shadow-sm border border-gray-100">
                  <ArrowLeft size={18} />
                </div>
              </button>
            )}
          </div>

          <div className="h-8 w-px bg-gray-100 hidden md:block"></div>

          {/* Luxury Navigation Pills */}
          <nav className="hidden lg:flex items-center gap-6 min-w-0 overflow-x-auto whitespace-nowrap">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.18em] transition-all relative overflow-hidden group whitespace-nowrap
                  ${isActive
                    ? 'text-indigo-600'
                    : 'text-slate-500 hover:text-indigo-600 hover:bg-white/50'}
                `}
              >
                <item.icon size={14} className="relative z-10" />
                <span className="relative z-10">{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors relative bg-white rounded-full border border-gray-100">
            <Bell size={18} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
          </button>

          <div className="h-8 w-px bg-gray-100 hidden sm:block"></div>

          {/* Elevated Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-3 p-1 rounded-[1.25rem] bg-white hover:bg-gray-50 border border-gray-100 transition-all active:scale-[0.98] shadow-sm whitespace-nowrap"
            >
              <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-100 ring-4 ring-white">
                <span className="font-black text-sm uppercase">{(candidate?.name || 'C').charAt(0)}</span>
              </div>
              <div className="text-left hidden sm:block pr-3">
                <p className="text-xs font-black text-deep-navy leading-none truncate max-w-[130px]">{candidate?.name || 'Candidate'}</p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Global Account</p>
                </div>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform duration-500 mr-2 ${profileOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {profileOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setProfileOpen(false)}></div>
                <div className="absolute right-0 mt-3 w-64 bg-white rounded-3xl shadow-[0px_8px_30px_rgba(0,0,0,0.08)] border border-gray-100 py-4 z-20 animate-in fade-in zoom-in duration-200 origin-top-right">
                  <div className="px-6 py-4 border-b border-gray-50 mb-2">
                    <p className="text-sm font-bold text-deep-navy">{candidate?.name || 'Candidate'}</p>
                    <p className="text-xs text-deep-navy/50 font-medium truncate">{candidate?.email}</p>
                  </div>
                   <div className="px-2 mb-2 border-b border-gray-50 pb-2">
                    {menuItems.map((item) => (
                      <button
                        key={item.path}
                        onClick={() => { navigate(item.path); setProfileOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all text-sm font-bold ${
                          item.path === '/candidate/profile' ? '' : 'lg:hidden'
                        }`}
                      >
                        <item.icon size={18} /> {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="px-2">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all text-sm font-bold">
                      <LogOut size={18} /> Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA - LUXURY CONSTRAINTS */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto">
        <div className="p-8 lg:p-14 max-w-[1700px] mx-auto w-full animate-in fade-in duration-500">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
