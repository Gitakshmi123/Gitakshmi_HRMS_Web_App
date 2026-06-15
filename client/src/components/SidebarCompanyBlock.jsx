import React, { useEffect, useState, useRef } from 'react';
import ReactDOM from 'react-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Building2, X, ChevronDown, Mail, ShieldCheck, Globe } from 'lucide-react';

export default function SidebarCompanyBlock() {
  const { user, isInitialized } = useAuth();
  const [tenant, setTenant] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) return;
    if (user.role === 'candidate') return;

    let mounted = true;
    api.get('/tenants/me')
      .then(res => { if (mounted) setTenant(res.data); })
      .catch(err => {
        if (err.response?.status !== 401) {
          console.warn('Failed to fetch tenant:', err.message);
        }
      });

    return () => { mounted = false; };
  }, [user, isInitialized]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownRef]);

  const name = tenant?.companyName || tenant?.name || 'Company';
  const code = tenant?.code || '';
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

  // Portal modal to avoid backdrop-filter clipping from parent header
  const profileModal = showProfile ? ReactDOM.createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={() => setShowProfile(false)}
    >
      <div
        style={{ background: 'white', borderRadius: '2.5rem', width: '100%', maxWidth: '30rem', boxShadow: '0 35px 60px -15px rgba(0,0,0,0.3)', overflow: 'hidden', animation: 'zoomIn 0.2s ease' }}
        onClick={e => e.stopPropagation()}
      >
        {/* indigo top stripe */}
        <div style={{ height: '6px', background: 'linear-gradient(to right, #5eead4, #0d9488, #5eead4)' }}></div>

        <div style={{ padding: '2rem' }}>
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
            <div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em', margin: 0 }}>Enterprise Identity</h3>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <Globe size={11} style={{ animation: 'pulse 2s infinite' }} /> Global Authorization Sync
              </p>
            </div>
            <button
              onClick={() => setShowProfile(false)}
              style={{ width: '2.5rem', height: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: 'none', cursor: 'pointer', borderRadius: '0.875rem', color: '#94a3b8', flexShrink: 0 }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff1f2'; e.currentTarget.style.color = '#f43f5e'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#94a3b8'; }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Company Name Card */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '1.5rem', border: '1px solid #f1f5f9', marginBottom: '1rem' }}>
            <div style={{ width: '4rem', height: '4rem', borderRadius: '1rem', background: '#0d9488', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1.25rem', flexShrink: 0, boxShadow: '0 10px 25px -5px rgba(13,148,136,0.3)' }}>
              {initials}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.5625rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.25rem' }}>Registered Entity</p>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
            </div>
          </div>

          {/* Info Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '1.25rem', border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                <ShieldCheck size={11} color="#4F46E5" /> Identifier
              </p>
              <p style={{ fontSize: '0.875rem', fontWeight: 900, color: '#334155', fontFamily: 'monospace' }}>{code || 'N/A'}</p>
            </div>
            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '1.25rem', border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.5rem' }}>Status</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4F46E5', animation: 'pulse 2s infinite' }}></div>
                <span style={{ fontSize: '0.625rem', fontWeight: 900, color: '#0d9488', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Active</span>
              </div>
            </div>
          </div>

          {/* Admin Email */}
          <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '1.25rem', border: '1px solid #f1f5f9', marginBottom: '1.75rem' }}>
            <p style={{ fontSize: '0.5625rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
              <Mail size={11} color="#4F46E5" /> Admin Email
            </p>
            <p style={{ fontSize: '0.875rem', fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant?.adminEmail || 'admin@company.com'}</p>
          </div>

          {/* Close Button */}
          <button
            onClick={() => setShowProfile(false)}
            style={{ width: '100%', padding: '1rem', background: '#0f172a', color: 'white', border: 'none', borderRadius: '1rem', fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.2em', cursor: 'pointer', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4)', transition: 'background 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#000'}
            onMouseLeave={e => e.currentTarget.style.background = '#0f172a'}
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 md:gap-3 p-2 rounded-2xl hover:bg-slate-50 transition-all select-none text-left border border-transparent hover:border-slate-100 group"
        type="button"
      >
        <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shadow-sm border border-indigo-100 group-hover:scale-105 transition-transform">
          {initials || 'HR'}
        </div>

        <div className="hidden md:block">
          <div className="font-bold text-xl text-slate-900 leading-tight max-w-[160px] truncate">{name}</div>

        </div>

        <ChevronDown
          size={16}
          className={`text-slate-300 transition-transform hidden md:block ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-[2rem] shadow-2xl border border-slate-100 py-3 z-50 animate-in slide-in-from-top-2 duration-200 ring-1 ring-slate-200/50">
          <div className="px-5 py-4 border-b border-slate-50">
            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-[0.2em] mb-1">Authenticated Tenant</p>
            <p className="text-sm font-bold text-slate-900 truncate">{name}</p>
          </div>
          <div className="p-2">
            <button
              onClick={() => { setIsOpen(false); setShowProfile(true); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-[13px] font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all group"
            >
              <Building2 size={18} className="text-slate-300 group-hover:text-indigo-500" />
              Company Profile
            </button>
          </div>
        </div>
      )}

      {/* Portal Modal */}
      {profileModal}
    </div>
  );
}
