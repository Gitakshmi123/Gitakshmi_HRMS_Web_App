import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  Menu, Search, Bell, Settings, Megaphone, 
  LayoutDashboard, Building2, Blocks, History, 
  BellRing
} from 'lucide-react';

const MAIN_NAV = [
  { name: 'Dashboard', path: '/super-admin', icon: LayoutDashboard, exact: true },
  { name: 'Companies', path: '/super-admin/companies', icon: Building2 },
  { name: 'Modules', path: '/super-admin/modules', icon: Blocks },
  { name: 'Activities', path: '/super-admin/activities', icon: History },
];

const BOTTOM_NAV = [
  { name: 'Notification', path: '/super-admin/notifications', icon: BellRing },
  { name: 'Activities', path: '/super-admin/activities-log', icon: History },
];

export default function SuperAdminLayout() {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  // Get current page title
  const getPageTitle = () => {
    if (location.pathname === '/super-admin') return 'My Dashboard';
    if (location.pathname.includes('/companies')) return 'Companies';
    if (location.pathname.includes('/modules')) return 'Module Configuration';
    if (location.pathname.includes('/activities')) return 'Activities';
    return 'Dashboard';
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex flex-col bg-white border-r border-slate-200 transition-all duration-300 z-20 ${
          isSidebarOpen ? 'w-[260px]' : 'w-[80px]'
        }`}
      >
        {/* Logo */}
        <div className="h-[72px] flex items-center px-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl flex-shrink-0">
              g
            </div>
            {isSidebarOpen && (
              <span className="font-bold text-xl text-slate-800 tracking-tight whitespace-nowrap">
                GitakshmiHR
              </span>
            )}
          </div>
        </div>

        {/* Main Nav */}
        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar flex flex-col">
          <div className="space-y-1">
            {MAIN_NAV.map((item) => (
              <NavLink
                key={item.name}
                to={item.path}
                end={item.exact}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-6 py-3 transition-colors ${
                    isActive
                      ? 'bg-blue-50/50 text-blue-600 font-medium border-r-4 border-blue-600'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} strokeWidth={isActive ? 2.5 : 2} />
                    {isSidebarOpen && <span className="whitespace-nowrap">{item.name}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>

          <div className="mt-auto pt-8">
            <div className="space-y-1 mb-4">
              {BOTTOM_NAV.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-6 py-3 transition-colors ${
                      isActive
                        ? 'bg-blue-50/50 text-blue-600 font-medium border-r-4 border-blue-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 text-slate-400" />
                  {isSidebarOpen && <span className="whitespace-nowrap">{item.name}</span>}
                </NavLink>
              ))}
            </div>

            {/* Profile */}
            {isSidebarOpen && (
              <div className="px-4 pb-4">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-slate-800 truncate">GitakshmiHR</p>
                    <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase truncate">SYSTEM MANAGER</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-[72px] bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!isSidebarOpen)}
              className="text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-xl font-medium text-slate-800">{getPageTitle()}</h1>
          </div>

          <div className="flex items-center gap-4">
            <button className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-blue-600 transition-colors">
              <Search className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-blue-600 transition-colors">
              <Megaphone className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-blue-600 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-blue-600 transition-colors relative">
              <Bell className="w-5 h-5" />
            </button>
            <button className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
