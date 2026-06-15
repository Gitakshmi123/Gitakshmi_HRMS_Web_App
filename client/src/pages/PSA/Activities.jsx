import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import {
  History, Trash2, RefreshCw, Search, Building2, Calendar,
  Activity as ActivityIcon, AlertCircle, ChevronRight, Zap, Cpu,
  ArrowUpRight, Shield, ShieldAlert, Clock, Filter, Trash,
  Layers, Database, Terminal, CheckCircle2, MoreHorizontal
} from 'lucide-react';

const StatCard = ({ icon: Icon, label, value, percentage, color, iconBg }) => (
  <div className={`bg-[#F8FAFC] border-t-2 ${color} rounded-lg p-4 shadow-sm flex items-center gap-4 w-full`}>
    <div className={`w-11 h-11 rounded-lg ${iconBg} flex items-center justify-center shadow-sm shrink-0`}>
      <Icon size={18} className="text-slate-600" />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest truncate">{label}</p>
        {percentage && <span className="text-[9px] font-semibold text-slate-800 shrink-0">{percentage}</span>}
      </div>
      <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
    </div>
  </div>
);


export default function Activities() {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(15);
  const [selectedLog, setSelectedLog] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const res = await api.get('/superadmin/activities');
      setActivities(res.data?.data || []);
    } catch (err) {
      console.error('Failed to load activities', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = activities.filter(log => {
    const term = searchTerm.toLowerCase();
    const action = (log.actionType || log.action || '').toLowerCase();
    const message = (log.message || '').toLowerCase();
    const company = (log.companyName || log.company || log.tenantInfo?.name || '').toLowerCase();
    return action.includes(term) || message.includes(term) || company.includes(term);
  });

  const paged = filtered.slice(0, pageSize);

  const getLogVisuals = (action) => {
    const act = (action || '').toLowerCase();
    if (act.includes('delete') || act.includes('remove') || act.includes('fail') || act.includes('alert') || act.includes('security')) {
      return {
        icon: ShieldAlert,
        badgeColor: 'bg-rose-500 text-white',
        label: 'SECURITY ALERT'
      };
    }
    if (act.includes('update') || act.includes('edit') || act.includes('module')) {
      return {
        icon: Layers,
        badgeColor: 'bg-indigo-600 text-white',
        label: 'MODULES UPDATED',
        showMore: true
      };
    }
    return {
      icon: CheckCircle2,
      badgeColor: 'bg-gray-200 text-gray-700',
      label: 'COMPANY UPDATED'
    };
  };

  const DetailsModal = ({ log, onClose }) => {
    if (!log) return null;
    const dateStr = new Date(log.time || log.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Map internal keys to friendly names
    const MODULE_NAMES = {
      hr: 'Core HR & Employee Management',
      payroll: 'Payroll & Salary Management',
      attendance: 'Attendance & Time Tracking',
      leave: 'Leave & Absence Management',
      recruitment: 'Recruitment & Talent Acquisition',
      backgroundVerification: 'Background Verification',
      documentManagement: 'Document & Policy Management',
      socialMediaIntegration: 'Social Media Integration',
      employeePortal: 'Employee Self-Service (ESS)'
    };

    // Extract active modules from metadata
    let activeModules = [];
    if (log.metadata?.enabledModules && typeof log.metadata.enabledModules === 'object') {
      activeModules = Object.entries(log.metadata.enabledModules)
        .filter(([_, enabled]) => enabled === true)
        .map(([key, _]) => MODULE_NAMES[key] || key);
    }

    // Fallback if no specific modules found
    if (activeModules.length === 0) {
      activeModules = ["Module configuration updated", "System settings synchronized"];
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
        <div className="relative bg-[#F8FAFC] w-full max-w-lg rounded-[20px] shadow-2xl border border-white animate-in zoom-in-95 duration-200">
          <div className="p-6">

            <div className="flex items-center gap-3.5 mb-5">
              <div className="w-11 h-11 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm border border-white">
                <Layers size={20} />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-900 tracking-tight uppercase">Module Updates</h2>
                <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">ID: {String(log._id).slice(-8).toUpperCase()}</p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center gap-3.5 mb-5 shadow-sm">
              <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-indigo-400 border border-slate-50">
                <Layers size={16} />
              </div>
              <div>
                <p className="text-[12px] font-bold text-slate-800">
                  {log.companyName || log.company || log.tenantId?.name || log.tenantInfo?.name || 'Central'}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Clock size={10} className="text-indigo-400" />
                  <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-tight">{dateStr}</p>
                </div>

              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3.5 ml-1">Activated Modules</h3>
              <div className="max-h-[240px] overflow-y-auto pr-2 custom-scrollbar space-y-2.5">
                {activeModules.map((item, i) => (
                  <div key={i} className="flex gap-2.5 items-center bg-white/40 p-2 rounded-lg border border-transparent hover:border-slate-100 transition-all">
                    <div className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-50 text-emerald-500 border border-emerald-100">
                      <CheckCircle2 size={12} strokeWidth={3} />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 tracking-tight">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100/60">
              <button
                onClick={onClose}
                className="px-6 h-9 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all active:scale-95 shadow-lg shadow-indigo-100"
              >
                Close
              </button>

            </div>
          </div>
        </div>

        <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 20px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
        `}</style>
      </div>
    );
  };



  return (
    <div className="w-full p-[15px] space-y-6 animate-in fade-in duration-500 font-outfit min-h-screen">

      {selectedLog && <DetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />}

      {/* Removed ACTIVITY HISTORY header */}

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={Layers}
          label="TOTAL RECORDS"
          value="1,420"
          percentage="+12%"
          color="border-[#EA4C89]"
          iconBg="bg-[#FDE2ED]"
        />
        <StatCard
          icon={Shield}
          label="SECURITY ALERTS"
          value="03"
          color="border-[#22D3EE]"
          iconBg="bg-[#E0FAFE]"
        />
        <StatCard
          icon={ActivityIcon}
          label="24H LOG VOL"
          value="248"
          percentage="+5%"
          color="border-[#F97316]"
          iconBg="bg-[#FFF1E7]"
        />
      </div>

      {/* Search & Refresh Row */}
      <div className="flex items-center justify-between gap-3 !mt-2.5 pt-0">
        <div className="relative flex-1 max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search . ."
            className="w-full h-10 bg-white border border-slate-200 rounded-lg pl-11 pr-4 focus:outline-none transition-all text-[13px] font-medium placeholder:text-slate-400"
          />
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-6 h-10 bg-white border border-slate-200 shadow-sm text-slate-700 rounded-lg text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-all active:scale-95 whitespace-nowrap"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Refresh History</span>
        </button>
      </div>

      {/* Activities List */}
      <div className="!mt-2.5 space-y-2.5">
        {loading && paged.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="animate-spin" size={24} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">Retrieving logs...</span>
          </div>
        ) : paged.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center gap-3 text-slate-400 border border-dashed border-slate-200 rounded-xl">
            <AlertCircle size={24} />
            <span className="text-[10px] font-semibold uppercase tracking-widest">No matching activities found</span>
          </div>
        ) : (
          paged.map((log, idx) => {
            const visuals = getLogVisuals(log.actionType || log.action);
            const LogIcon = visuals.icon;
            return (
              <div
                key={log._id || idx}
                className="bg-white border border-slate-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-all flex items-center gap-6"
              >
                <div className="w-8 h-8 rounded-full border border-slate-100 flex items-center justify-center shrink-0">
                  <LogIcon size={14} className="text-slate-900" />
                </div>

                <div className="w-24 shrink-0">
                  <p className="text-[13px] font-bold text-slate-900 leading-none">
                    {new Date(log.time || log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  </p>
                  <p className="text-[9px] font-semibold text-slate-400 uppercase mt-1 tracking-tight">
                    {new Date(log.time || log.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase()}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-tighter ${visuals.badgeColor}`}>
                      {visuals.label}
                    </span>
                    <span className="text-[9px] font-semibold text-slate-300 uppercase tracking-tighter">ID: {String(log._id).slice(-8).toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-[13px] font-semibold text-slate-700 leading-snug truncate">
                      {log.message || log.action}
                    </h3>
                    {visuals.showMore && (
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 hover:underline transition-all"
                      >
                        ..more
                      </button>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0 min-w-[180px]">
                  <p className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest mb-1 opacity-60">COMPANY</p>
                  <p className="text-[10px] font-bold text-slate-800 uppercase tracking-tight truncate max-w-[200px]">
                    {log.companyName || log.company || log.tenantInfo?.name || 'GITAKSHMI TECHNOLOGIES PVT. LTD.'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>


      {/* Pagination / Load More */}
      {filtered.length > pageSize && (
        <div className="flex justify-center pt-6">
          <button
            onClick={() => setPageSize(prev => prev + 10)}
            className="px-8 h-10 bg-white border border-slate-200 text-slate-600 rounded-lg text-[11px] font-bold uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95"
          >
            Load Older Activities
          </button>
        </div>
      )}




      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}

