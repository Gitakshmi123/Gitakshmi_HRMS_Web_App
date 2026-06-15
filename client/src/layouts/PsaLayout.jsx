import React, { useEffect, useState, useRef } from "react";
import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  LogOut, Menu, Bell, User, LayoutGrid, Building2, Activity, HelpCircle, ChevronRight, ArrowLeft, X, Layers, History
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import logo from "/favicon.png";

const NavItem = ({ to, icon: Icon, label, end = false, hasSubmenu = false, onClick, isOpen }) => {
  const innerContent = (
    <div className={`flex items-center gap-4 px-6 py-3.5 transition-all duration-200 min-w-[260px]`}>
      <Icon size={20} strokeWidth={2} className={`${isOpen ? 'text-indigo-600' : 'text-slate-400 group-hover/side:text-slate-900'}`} />
      <span className={`text-[12px] font-bold font-outfit uppercase tracking-widest transition-all duration-300 opacity-0 group-hover/side:opacity-100 whitespace-nowrap ${isOpen ? 'text-slate-900' : 'text-slate-500 group-hover/side:text-slate-900'}`}>
        {label}
      </span>
      {hasSubmenu && (
        <ChevronRight size={14} className={`ml-auto transition-all duration-300 text-slate-300 opacity-0 group-hover/side:opacity-100 ${isOpen ? 'rotate-90 text-indigo-500' : ''}`} />
      )}
    </div>
  );

  if (hasSubmenu) {
    return (
      <div onClick={onClick} className="cursor-pointer group hover:bg-slate-50 transition-all">
        {innerContent}
      </div>
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `block relative group transition-all ${isActive ? 'bg-indigo-50/40 text-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
    >
      {({ isActive }) => (
        <>
          {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-indigo-600 rounded-r-full" />}
          <div className={`flex items-center gap-4 px-6 py-3.5 transition-all duration-200 min-w-[260px]`}>
            <Icon size={20} strokeWidth={2} className={`${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover/side:text-slate-900'}`} />
            <span className={`text-[12px] font-bold font-outfit uppercase tracking-widest transition-all duration-300 opacity-0 group-hover/side:opacity-100 whitespace-nowrap ${isActive ? 'text-slate-900' : 'text-slate-500 group-hover/side:text-slate-900'}`}>
              {label}
            </span>
          </div>
        </>
      )}
    </NavLink>
  );
};

export default function PsaLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const [hoveredSubmenu, setHoveredSubmenu] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isMainDashboard = location.pathname === '/psa' || location.pathname === '/psa/dashboard';

  return (
    <div className="flex h-screen bg-white font-['Outfit',sans-serif] overflow-hidden">

      {/* 🏛️ Hover-Expandable Sidebar (72px -> 260px) */}
      <aside className={`peer fixed lg:static inset-y-0 left-0 z-[60] bg-white shadow-[8px_0_30px_rgba(0,0,0,0.04)] flex flex-col w-[72px] lg:hover:w-[260px] transition-all duration-300 group/side overflow-hidden border-r border-slate-100 ${isMobileMenuOpen ? 'translate-x-0 w-[260px]' : '-translate-x-full lg:translate-x-0'}`}>
        {/* 🏢 Brand Section */}
        <div className="h-24 flex items-center justify-start shrink-0 border-b border-slate-50 relative px-6 overflow-hidden">
          <div 
            className="cursor-pointer active:scale-95 flex items-center w-full"
            onClick={() => navigate('/psa')}
          >
            <div className="flex items-center gap-3">
              <img 
                src={logo} 
                alt="Logo" 
                className="w-10 h-10 object-contain shrink-0" 
              />
              <span className="text-[17px] font-black font-outfit text-slate-800 tracking-tight opacity-0 lg:group-hover/side:opacity-100 transition-all duration-300 whitespace-nowrap translate-x-[-10px] lg:group-hover/side:translate-x-0">
                GitakshmiHR
              </span>
            </div>
          </div>
          {/* Close button for mobile */}
          <button className="lg:hidden ml-auto p-2" onClick={() => setIsMobileMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 py-4 overflow-y-auto no-scrollbar flex flex-col gap-1">
          <NavItem 
            to="/psa" 
            icon={LayoutGrid} 
            label="Dashboard" 
            end 
          />
          
          <NavItem 
            to="/psa/companies" 
            icon={Building2} 
            label="Companies" 
          />
          
          <NavItem to="/psa/modules" icon={Layers} label="Modules" />
          <NavItem to="/psa/activities" icon={History} label="Activities" />
        </nav>

        {/* Footer Section - Standardized Alignment */}
        <div className="shrink-0 border-t border-slate-50 py-4 space-y-4">
          <div className="flex items-center px-6 gap-6">
            <div className="w-10 flex justify-center shrink-0">
              <button 
                onClick={() => navigate('/psa/notifications')}
                className="relative p-2 text-slate-400 hover:text-indigo-600 transition-all hover:bg-indigo-50 rounded-xl"
              >
                <Bell size={20} strokeWidth={2.5} />
                <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-600 border border-white rounded-full"></span>
              </button>
            </div>
            <span 
              onClick={() => navigate('/psa/notifications')}
              className="text-xs font-bold text-slate-500 opacity-0 lg:group-hover/side:opacity-100 transition-opacity whitespace-nowrap cursor-pointer hover:text-indigo-600"
            >
              Notifications
            </span>
          </div>

          <div className="flex items-center px-6 gap-6">
            <div className="w-10 flex justify-center shrink-0">
              <button 
                onClick={() => { logout(); }}
                className="p-2 text-slate-400 hover:text-red-600 transition-all hover:bg-red-50 rounded-xl"
              >
                <LogOut size={20} />
              </button>
            </div>
            <span className="text-xs font-bold text-slate-500 opacity-0 lg:group-hover/side:opacity-100 transition-opacity whitespace-nowrap">Logout</span>
          </div>

          <div className="px-4">
            <div className="flex items-center gap-4 p-1.5 rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm">
              <div className="w-10 h-10 min-w-[2.5rem] rounded-xl bg-slate-50 flex items-center justify-center text-indigo-500 border border-white shadow-sm shrink-0">
                <User size={18} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col min-w-0 opacity-0 lg:group-hover/side:opacity-100 transition-opacity duration-300 pr-2">
                <span className="text-xs font-bold text-slate-800 truncate">GitakshmiHR</span>
                <span className="text-[10px] font-medium text-slate-400 truncate tracking-tight uppercase">System Manager</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 🚀 Main Content Area - Fixed margin so sidebar overlaps */}
      <main className="flex-1 flex flex-col min-h-screen relative lg:ml-0 transition-all duration-300">

        {/* Header removed per user request */}

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="w-full h-full min-h-screen">
            <Outlet />
          </div>
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

