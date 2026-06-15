import React, { useEffect, useState } from "react";
import { Pagination } from 'antd';
import { useNavigate } from 'react-router-dom';
import api, { API_ROOT } from "../../utils/api";
import CompanyForm from "./CompanyForm";
import CompanyView from "./CompanyView";
import {
  Building2,
  Mail,
  Search,
  Plus,
  Zap,
  Eye,
  EyeOff,
  Edit2,
  Settings,
  Lock,
  Layers,
  Briefcase,
  Activity,
  Hash
} from 'lucide-react';

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  const [openForm, setOpenForm] = useState(false);
  const [selected, setSelected] = useState(null);

  const [openView, setOpenView] = useState(false);
  const [revealMap, setRevealMap] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const _navigate = useNavigate();


  async function load() {
    try {
      const res = await api.get("/tenants");
      setCompanies(Array.isArray(res.data) ? res.data : (res.data?.tenants || res.data?.data || []));

    } catch (err) {
      console.log(err);
      alert("Failed to load companies");
    }
  }

  useEffect(() => {
    (async () => {
      await load();
      setCurrentPage(1);
    })();
  }, []);

  const filtered = companies.filter(c => {
    if (!searchQuery) return true;
    const q = String(searchQuery).toLowerCase();
    const name = String(c.companyName || c.name || "").toLowerCase();
    const email = String(c.companyEmail || c.meta?.primaryEmail || c.meta?.email || "").toLowerCase();
    const code = String(c.code || "").toLowerCase();
    const tenantId = String(c.tenantId || "").toLowerCase();
    const status = String(c.status === 'active' ? 'operational' : (c.status || "suspended")).toLowerCase();
    return name.includes(q) || email.includes(q) || code.includes(q) || tenantId.includes(q) || status.includes(q);
  });

  const start = (currentPage - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  async function toggleActive(company) {
    try {
      const newStatus = company.status === 'active' ? 'suspended' : 'active';
      await api.put(`/tenants/${company._id}`, { status: newStatus });
      load();
    } catch (err) {
      console.error(err);
      alert('Failed to update status');
    }
  }

  const [verifyingId, setVerifyingId] = useState(null);
  const [psaPassword, setPsaPassword] = useState("");
  const [verifyingLoader, setVerifyingLoader] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  function handleReveal(id) {
    if (revealMap[id]) {
      setRevealMap(prev => ({ ...prev, [id]: false }));
      return;
    }
    setVerifyingId(id);
    setPsaPassword("");
    setErrorMsg("");
  }

  async function performVerification() {
    if (!psaPassword) return;
    try {
      setVerifyingLoader(true);
      setErrorMsg("");
      const res = await api.post('/tenants/verify-password', { password: psaPassword });
      if (res.data.success) {
        setRevealMap(prev => ({ ...prev, [verifyingId]: true }));
        setVerifyingId(null);
        setPsaPassword("");
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || "Invalid Super Admin password");
    } finally {
      setVerifyingLoader(false);
    }
  }

  const stats = {
    total: companies.length,
    active: companies.filter(c => c.status === 'active').length,
    inactive: companies.filter(c => c.status !== 'active').length,
  };

  const statsCards = [
    { label: 'TOTAL COMPANIES', value: stats.total, icon: Building2, color: '#00C292' },
    { label: 'ACTIVE COMPANIES', value: stats.active, icon: Layers, color: '#7047EB' },
    { label: 'INACTIVE COMPANIES', value: stats.inactive, icon: Briefcase, color: '#FF5C8D' },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-8 font-sans text-slate-900 overflow-x-hidden">
      <div className="w-full mx-auto space-y-6 animate-in fade-in duration-700">
        
        {/* 1. Header Section + Integrated Search */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 px-10 pt-2.5">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight uppercase">MANAGE COMPANIES</h1>
            <p className="text-[10px] font-bold text-slate-400 tracking-tight uppercase">Ecosystem Control Center</p>
          </div>

          {/* Integrated Search Bar */}
          <div className="flex-1 max-w-[420px] relative group mx-4">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="SEARCH COMPANIES..."
              className="w-full pl-16 pr-8 py-2.5 bg-white border border-slate-100 rounded-2xl shadow-sm focus:outline-none focus:border-indigo-600 transition-all text-[11px] font-bold tracking-widest text-slate-700 placeholder:text-slate-300"
            />
          </div>

          <button
            onClick={() => { setSelected(null); setOpenForm(true); }}
            className="flex items-center gap-2 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl shadow-xl shadow-slate-900/10 active:scale-95 transition-all text-[11px] font-bold uppercase tracking-widest shrink-0"
          >
            <Plus size={16} />
            Create Node
          </button>
        </div>

        {/* 2. Compact Stats Cards */}
        <div className="flex flex-wrap items-start gap-6 px-10 w-full">
          {statsCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div 
                key={idx} 
                className="bg-white p-6 rounded-[2rem] shadow-sm border-t-[5px] transition-all duration-300 flex flex-col gap-6 w-[220px] hover:shadow-md"
                style={{ borderTopColor: card.color }}
              >
                <div className="w-12 h-12 rounded-xl bg-[#F1F4F9] flex items-center justify-center text-slate-700 shadow-sm self-start">
                  {Icon && <Icon size={20} className="text-slate-800" strokeWidth={2.5} />}
                </div>
                
                <div className="space-y-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] leading-none mb-1">
                    {card.label}
                  </p>
                  <h2 className="text-4xl font-bold text-slate-800 tracking-tighter">
                    {card.value}
                  </h2>
                </div>
              </div>
            );
          })}
        </div>

        {/* 3. Table Rows as Individual Cards - Matches Step 920 image */}
        <div className="px-10 space-y-4 pb-20">
          {/* Header Row */}
          <div className="grid grid-cols-12 px-8 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">
            <div className="col-span-4 flex items-center gap-2"><Building2 size={12}/> COMPANY DETAILS</div>
            <div className="col-span-1 flex items-center gap-2"><Hash size={12}/> COMPANY CODE</div>
            <div className="col-span-3 flex items-center gap-2"><Lock size={12}/> ACCESS DETAILS</div>
            <div className="col-span-2 flex items-center gap-2"><Activity size={12}/> STATUS</div>
            <div className="col-span-2 text-right">ACTIONS</div>
          </div>

          <div className="space-y-4">
            {paged.map((c) => (
              <div key={c._id} className="grid grid-cols-12 items-center bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100/50 hover:shadow-md transition-all group">
                {/* Branding */}
                <div className="col-span-4">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 rounded-2xl bg-[#F8FAFC] border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                      {c.logo || c.meta?.logo ? (
                        <img src={(c.logo || c.meta?.logo || '').startsWith('http') ? (c.logo || c.meta?.logo) : `${API_ROOT}${c.logo || c.meta?.logo || ''}`} alt="logo" className="w-full h-full object-contain p-2" />
                      ) : (
                        <Building2 className="text-slate-200" size={28} />
                      )}
                    </div>
                    <div>
                      <h3 className="text-[15px] font-bold text-slate-800 tracking-tight leading-none mb-1.5">{c.companyName || c.name}</h3>
                      <p className="text-[11px] font-bold text-slate-400 tracking-tight lowercase">{c.companyEmail || c.meta?.primaryEmail || c.meta?.email || '-'}</p>
                    </div>
                  </div>
                </div>

                {/* Code */}
                <div className="col-span-1">
                  <span className="text-[11px] font-bold text-slate-800 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 uppercase tracking-widest">
                    {c.code || '-'}
                  </span>
                </div>

                {/* Access */}
                <div className="col-span-3 pl-4">
                   <p className="text-[11px] font-bold text-slate-500 mb-1">{c.companyEmail || c.meta?.primaryEmail || c.meta?.email || '-'}</p>
                   <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 tracking-widest bg-slate-50/50 px-2 py-0.5 rounded border border-slate-100/50">
                        {revealMap[c._id] ? (c.meta?.adminPassword ? c.meta.adminPassword : 'Encrypted') : '••••••••'}
                      </span>
                      {c.meta?.adminPassword && (
                        <button onClick={() => handleReveal(c._id)} className="text-slate-300 hover:text-blue-500 transition-colors">
                          {revealMap[c._id] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                   </div>
                </div>

                {/* Status */}
                <div className="col-span-2">
                   <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border border-transparent ${c.status === 'active' ? 'text-emerald-500 font-bold italic' : 'bg-rose-50 text-rose-500 font-bold'}`}>
                    <span className="text-[11px] font-bold uppercase tracking-wider pl-1">
                      {c.status === 'active' ? 'active' : 'inactive'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button onClick={() => { setSelected(c); setOpenView(true); }} className="p-2 tex-slate-300 hover:text-blue-500 rounded-xl transition-all" title="View"><Eye size={18} /></button>
                  <button onClick={() => { setSelected(c); setOpenForm(true); }} className="p-2 tex-slate-300 hover:text-emerald-500 rounded-xl transition-all" title="Edit"><Edit2 size={18} /></button>
                  <button onClick={() => toggleActive(c)} className="p-2 tex-slate-300 hover:text-rose-500 rounded-xl transition-all" title="Status"><Zap size={18} /></button>
                  <button onClick={() => _navigate(`/psa/modules/${c._id}`)} className="p-2 tex-slate-300 hover:text-indigo-500 rounded-xl transition-all" title="Modules"><Settings size={18} /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {filtered.length > pageSize && (
            <div className="flex justify-center pt-10">
              <Pagination
                current={currentPage}
                total={filtered.length}
                pageSize={pageSize}
                onChange={setCurrentPage}
                showSizeChanger={false}
              />
            </div>
          )}
        </div>
      </div>

      {openForm && (
        <CompanyForm
          company={selected}
          onClose={() => {
            setOpenForm(false);
            load();
          }}
        />
      )}

      {openView && (
        <CompanyView
          company={selected}
          onClose={() => {
            setOpenView(true);
            setSelected(null);
          }}
        />
      )}

      {/* Verification Modal */}
      {verifyingId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setVerifyingId(null)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="h-20 w-20 rounded-[2rem] bg-blue-50 text-blue-600 flex items-center justify-center mb-4 rotate-12 shadow-xl shadow-blue-500/10">
                <Lock size={40} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 uppercase tracking-tight">Identity Check</h2>
              <p className="text-[10px] font-bold text-slate-400 mt-2 px-6">MASTER PASSWORD REQUIRED</p>
            </div>

            <div className="space-y-6">
              <input
                type="password"
                value={psaPassword}
                onChange={(e) => setPsaPassword(e.target.value)}
                placeholder="PASSWORD..."
                className="w-full bg-slate-50 border border-slate-100 rounded-3xl px-6 py-4 text-xs font-bold focus:border-blue-500 outline-none transition"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && performVerification()}
              />
              <div className="flex gap-3">
                <button onClick={() => setVerifyingId(null)} className="flex-1 py-4 text-slate-400 font-bold uppercase text-[10px] tracking-widest hover:bg-slate-50 rounded-2xl transition">Cancel</button>
                <button onClick={performVerification} disabled={verifyingLoader || !psaPassword} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest transition shadow-lg active:scale-95 disabled:opacity-50">AUTHORIZE</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
