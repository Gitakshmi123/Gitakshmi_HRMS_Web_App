import React, { useState } from 'react';
import {
  Building2,
  Globe,
  Mail,
  CheckCircle2,
  Calendar,
  Layers,
  X,
  Shield,
  Activity,
  User,
  Package,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Hash,
  Terminal,
  ExternalLink,
  ChevronRight,
  Database,
  Lock,
  Zap,
  Users,
  Fingerprint,
  Copy,
  Check,
  Link2,
  Save
} from 'lucide-react';
import { normalizeEnabledModules } from '../../utils/moduleConfig';
import { PSA_MODULE_CODES } from '../../constants/psaModuleCatalog';

export default function CompanyView({ company, onClose }) {
  if (!company) return null;
  const normalizedModules = normalizeEnabledModules(company.enabledModules, company.modules);
  const activeModuleCount = PSA_MODULE_CODES.filter((code) => normalizedModules?.[code] === true).length;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  // DMS Integration state
  const [copied, setCopied] = useState(false);
  const [dmsIdInput, setDmsIdInput] = useState(company.dmsCompanyId || '');
  const [dmsSaving, setDmsSaving] = useState(false);
  const [dmsSaved, setDmsSaved] = useState(false);

  const handleCopyId = (id) => {
    if (!id) return;
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveDmsId = async () => {
    if (!dmsIdInput.trim()) return;
    try {
      setDmsSaving(true);
      const api = (await import('../../utils/api')).default;
      await api.put(`/tenants/${company._id || company.tenantId}/dms-company-id`, { dmsCompanyId: dmsIdInput.trim() });
      setDmsSaved(true);
      setTimeout(() => setDmsSaved(false), 3000);
    } catch (err) {
      alert('Failed to save DMS Company ID: ' + (err?.response?.data?.message || err.message));
    } finally {
      setDmsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 font-outfit">
      {/* Soft Background Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" onClick={onClose}></div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-[0_30px_70px_rgba(0,0,0,0.2)] relative overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-500 flex flex-col max-h-[90vh]">
        
        {/* Refined Header */}
        <div className="relative h-40 shrink-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950"></div>
          
          {/* Subtle Ambient Detail */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>

          <div className="relative h-full flex flex-col justify-end px-6 pb-5">
            {/* Action Group */}
            <div className="absolute top-5 right-5 flex gap-2">
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/10 border border-white/5 flex items-center justify-center text-white hover:bg-rose-500 transition-all group"
              >
                <X size={16} className="group-hover:rotate-90 transition-transform duration-500" />
              </button>
            </div>

            <div className="flex items-end gap-5">
              {/* Logo Box */}
              <div className="w-20 h-20 rounded-2xl bg-white p-3 shadow-xl relative shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 to-transparent rounded-2xl"></div>
                {company.logo || company.meta?.logo ? (
                  <img src={company.logo || company.meta?.logo} alt="Logo" className="w-full h-full object-contain relative z-10" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-black text-slate-200 relative z-10">
                    {(company.companyName || company.name || 'C').charAt(0)}
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-lg border-2 border-white flex items-center justify-center shadow-lg ${company.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                  {company.status === 'active' ? <Zap size={12} className="text-white animate-pulse" /> : <Shield size={12} className="text-white" />}
                </div>
              </div>

              {/* Title Block */}
              <div className="flex-1 pb-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-indigo-600 font-black text-white text-[9px] uppercase tracking-[0.15em] rounded shadow-sm">Active Status</span>
                  <span className="px-2 py-0.5 bg-white/10 font-black text-white/60 text-[9px] uppercase tracking-[0.15em] rounded border border-white/5">Verified</span>
                </div>
                <h1 className="text-xl font-black text-white tracking-tight leading-none uppercase">{company.companyName || company.name}</h1>
                <div className="flex items-center gap-3 mt-1.5 text-white/40">
                  <div className="flex items-center gap-1.5">
                    <Globe size={11} className="text-indigo-400" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">{company.domain || 'internal.node'}</span>
                  </div>
                  <div className="w-1 h-1 rounded-full bg-white/10"></div>
                  <div className="flex items-center gap-1.5">
                    <Hash size={11} className="text-emerald-400" />
                    <span className="text-[9px] font-bold uppercase tracking-widest">{company.code || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
          
          {/* Key Metrics */}
          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1 bg-white border border-slate-100 p-4 rounded-xl transition-all shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <Layers size={16} />
              </div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">Modules</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-slate-900 tracking-tight">{activeModuleCount}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Linked</span>
              </div>
            </div>
            
            <div className="col-span-1 bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <Package size={16} />
              </div>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] mb-1">Plan</p>
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{company.plan || 'Standard'}</span>
            </div>

            <div className="col-span-2 bg-gradient-to-br from-slate-900 to-indigo-950 p-4 rounded-xl relative overflow-hidden group shadow-xl">
              <div className="absolute top-0 right-0 w-24 h-full bg-white/5 -skew-x-12 translate-x-8"></div>
              <div className="relative z-10 flex flex-col justify-between h-full">
                <div className="flex justify-between items-start">
                  <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center border border-white/10">
                    <Database size={15} />
                  </div>
                  <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> System Active
                  </span>
                </div>
                <div className="mt-2 text-white">
                  <p className="text-[11px] font-black text-slate/40 uppercase tracking-[0.1em] mb-1 opacity-60">Admin Email</p>
                  <p className="text-[12px] font-black truncate uppercase tracking-tight text-white/90">{company.companyEmail || company.emailDomain || 'NO_MAIL'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Technical Summary */}
          <div className="space-y-4">
            <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
              Company Details
              <span className="flex-1 h-px bg-slate-100"></span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2 ml-1">
                  <User size={13} className="text-indigo-500" /> Admin Name
                </label>
                <div className="h-11 px-4 bg-slate-50 border border-transparent rounded-xl flex items-center">
                   <p className="text-[13px] font-black text-slate-800 uppercase tracking-tight">{company.ownerName || company.meta?.ownerName || 'Unknown'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2 ml-1">
                  <Calendar size={13} className="text-emerald-500" /> Created Date
                </label>
                <div className="h-11 px-4 bg-slate-50 border border-transparent rounded-xl flex items-center">
                  <p className="text-[13px] font-black text-slate-800 uppercase tracking-tight">{formatDate(company.createdAt)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2 ml-1">
                  <Fingerprint size={13} className="text-amber-500" /> ID Number
                </label>
                <div className="h-11 px-4 bg-slate-50 border border-transparent rounded-xl flex items-center overflow-hidden">
                  <p className="text-[12px] font-black text-indigo-600 truncate font-mono uppercase tracking-tight">{company.tenantId}</p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-2 ml-1">
                  <ShieldCheck size={13} className="text-rose-500" /> Access Level
                </label>
                <div className="h-11 px-4 bg-slate-50 border border-transparent rounded-xl flex items-center">
                  <p className="text-[13px] font-black text-slate-800 uppercase tracking-tight">Full Admin</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 shrink-0 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
             onClick={onClose}
             className="h-9 px-5 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-lg font-black text-[9px] uppercase tracking-[0.1em] transition-all active:scale-95"
          >
            Close
          </button>
          <button
             onClick={() => {
                localStorage.setItem('tenantId', company._id || company.tenantId);
                // Navigation to the HR dashboard for this specific tenant
                window.location.href = '/hr/create_requirement';
             }}
             className="h-9 px-5 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-black text-[9px] uppercase tracking-[0.1em] shadow-lg shadow-indigo-100 transition-all active:scale-95 flex items-center gap-2"
          >
            Manage Company <ArrowRight size={13} />
          </button>
        </div>
      </div>
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}
