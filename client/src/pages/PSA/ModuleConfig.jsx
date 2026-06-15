import React, { useEffect, useState, useMemo } from "react";
import PropTypes from "prop-types";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../utils/api";
import {
  applyModuleDependencies,
  normalizeEnabledModules
} from "../../utils/moduleConfig";
import { PSA_MODULES } from "../../constants/psaModuleCatalog";
import {
  Save,
  LayoutGrid,
  Building2,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
  Search,
  Check,
  X,
  Plus,
  ShieldCheck
} from "lucide-react";

const AVAILABLE_MODULES = PSA_MODULES;

export default function ModuleConfig({ company, onClose }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const isStandalonePage = !company;

  const [enabledModules, setEnabledModules] = useState(
    normalizeEnabledModules(company?.enabledModules || {}, company?.modules || [])
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(company || null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeCount = useMemo(() =>
    AVAILABLE_MODULES.filter((moduleItem) => enabledModules?.[moduleItem.code] === true).length,
    [enabledModules]
  );
  const allSelected = activeCount === AVAILABLE_MODULES.length;

  useEffect(() => {
    if (isStandalonePage) fetchCompanies();
  }, [isStandalonePage]);

  useEffect(() => {
    if (id && companies.length > 0) {
      const found = companies.find(c => c._id === id);
      if (found) {
        setSelectedCompany(found);
        setEnabledModules(normalizeEnabledModules(found.enabledModules || {}, found.modules || []));
      }
    }
  }, [id, companies]);

  useEffect(() => {
    if (company) {
      setSelectedCompany(company);
      setEnabledModules(normalizeEnabledModules(company.enabledModules || {}, company.modules || []));
    }
  }, [company]);

  async function fetchCompanies() {
    setLoading(true);
    try {
      const res = await api.get("/tenants");
      const raw = res?.data;
      const data =
        Array.isArray(raw) ? raw
          : (Array.isArray(raw?.data) ? raw.data
            : (Array.isArray(raw?.tenants) ? raw.tenants
              : (Array.isArray(raw?.companies) ? raw.companies : [])));

      const cleaned = (data || []).filter(Boolean);
      setCompanies(cleaned);
      if (id) {
        const found = cleaned.find(c => c._id === id);
        if (found) {
          setSelectedCompany(found);
          setEnabledModules(normalizeEnabledModules(found.enabledModules || {}, found.modules || []));
        }
      } else if (!selectedCompany && cleaned.length === 1) {
        setSelectedCompany(cleaned[0]);
        setEnabledModules(normalizeEnabledModules(cleaned[0].enabledModules || {}, cleaned[0].modules || []));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleBulk(active) {
    if (!selectedCompany) return;
    const next = Object.fromEntries(AVAILABLE_MODULES.map(m => [m.code, active]));
    setEnabledModules(applyModuleDependencies(next));
  }

  function handleSelectAll() {
    handleBulk(true);
  }

  function toggle(code) {
    if (!selectedCompany) return;
    setEnabledModules((prev) => {
      const next = { ...prev, [code]: !prev[code] };
      return applyModuleDependencies(next);
    });
  }

  async function handleSave() {
    const target = selectedCompany || company;
    if (!target?._id) return;
    setSaving(true);
    try {
      const selectedModules = Object.fromEntries(
        AVAILABLE_MODULES.map((moduleItem) => [moduleItem.code, enabledModules?.[moduleItem.code] === true])
      );
      const payloadModules = applyModuleDependencies(selectedModules);
      const res = await api.put(`/tenants/company/${target._id}/modules`, { enabledModules: payloadModules });
      
      const updatedCompany = res.data;
      if (updatedCompany) {
        setSelectedCompany(updatedCompany);
        setEnabledModules(normalizeEnabledModules(updatedCompany.enabledModules || {}, updatedCompany.modules || []));
        
        // Update the item in the companies list too
        setCompanies(prev => prev.map(c => c._id === updatedCompany._id ? updatedCompany : c));
      }

      alert("Configuration updated successfully!");
      if (typeof onClose === "function") onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full font-outfit animate-in fade-in duration-700 bg-white min-h-screen">
      <div className="space-y-0.5">
        <div className="bg-white border-b border-slate-100 p-5 flex flex-col md:flex-row items-center justify-between gap-4 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/4"></div>

          <div className="flex items-center gap-4 relative z-10">
            <div className="h-11 w-11 rounded-none bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 shadow-sm">
              <LayoutGrid size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-[18px] font-black text-slate-900 uppercase tracking-tight">Module Configuration</h1>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tenant controls and access matrix</p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !selectedCompany}
            className="h-10 px-8 bg-[#6366F1] text-white rounded-none font-black text-[11px] uppercase tracking-[0.14em] flex items-center gap-2 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 relative z-10"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} strokeWidth={2.5} />}
            <span>Save Changes</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
          <div className="lg:col-span-12 p-6 space-y-8">
            <div className="space-y-3">
              <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.18em] flex items-center gap-2 ml-1">
                <Building2 size={13} className="text-slate-800" /> Selected Company
              </h3>
              <div className="bg-slate-50/30 rounded-none border border-slate-100 p-4 flex items-center justify-between group cursor-pointer hover:bg-white transition-all relative" onClick={() => setIsOpen(!isOpen)}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-none bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-all shadow-sm">
                    <Building2 size={20} />
                  </div>
                  <span className="text-sm font-black text-slate-800 uppercase tracking-tight">
                    {selectedCompany ? (selectedCompany.companyName || selectedCompany.name) : 'No Company Selected'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-black text-slate-800 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">
                  <span>Change Company</span>
                  <ChevronRight size={14} strokeWidth={3} />
                </div>

                {isOpen && (
                  <div className="absolute top-[calc(100%+12px)] left-0 right-0 bg-white border border-slate-100 rounded-2xl shadow-2xl overflow-hidden z-[100] animate-in fade-in slide-in-from-top-2">
                    <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
                      <Search size={16} className="text-slate-400" />
                      <input
                        type="text"
                        placeholder="SEARCH COMPANIES..."
                        className="bg-transparent border-none focus:ring-0 text-[11px] font-black w-full uppercase placeholder:text-slate-300"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
                      {companies.filter(c => (c.companyName || c.name || '').toLowerCase().includes(searchQuery.toLowerCase())).map((c) => (
                        <div
                          key={c._id}
                          onClick={(e) => { e.stopPropagation(); setSelectedCompany(c); setIsOpen(false); setSearchQuery(''); setEnabledModules(normalizeEnabledModules(c.enabledModules || {}, c.modules || [])); }}
                          className={`flex items-center justify-between px-5 py-3.5 rounded-xl cursor-pointer transition-all mb-1
                                             ${selectedCompany?._id === c._id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-50 text-slate-600'}`}
                        >
                          <div className="flex items-center gap-4">
                            <Building2 size={16} className={selectedCompany?._id === c._id ? 'text-white' : 'text-slate-300'} />
                            <span className="text-[12px] font-black uppercase tracking-tight">{c.companyName || c.name}</span>
                          </div>
                          {selectedCompany?._id === c._id && <CheckCircle2 size={16} />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[12px] font-black text-slate-800 uppercase tracking-[0.18em] flex items-center gap-2">
                  <LayoutGrid size={14} className="text-indigo-500" /> Active Modules
                </h3>
                <div className="flex items-center gap-3">
                  <div className="px-4 py-1.5 bg-slate-100/50 rounded-full font-black text-[11px] text-slate-700 uppercase tracking-[0.12em]">
                    {activeCount} Active Modules
                  </div>
                  {selectedCompany && (
                    <button 
                      onClick={() => handleBulk(activeCount !== AVAILABLE_MODULES.length)}
                      className="h-8 px-4 bg-white border border-slate-200 text-slate-600 rounded-none font-black text-[10px] uppercase tracking-[0.14em] flex items-center gap-2 hover:bg-slate-50 hover:text-slate-900 transition-all active:scale-95 shadow-sm"
                    >
                      {activeCount === AVAILABLE_MODULES.length ? (
                        <>
                          <X size={12} strokeWidth={3} className="text-rose-500" />
                          <span>Disable All</span>
                        </>
                      ) : (
                        <>
                          <Check size={12} strokeWidth={3} className="text-emerald-500" />
                          <span>Enable All</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {!selectedCompany ? (
                <div className="h-[400px] bg-white rounded-[2.5rem] border border-slate-100 flex flex-col items-center justify-center p-12 text-center opacity-50">
                  <Building2 size={64} className="text-slate-100 mb-6" />
                  <h3 className="text-lg font-black text-slate-800 uppercase mb-2">Initialize Config</h3>
                  <p className="text-[12px] font-bold text-slate-700 uppercase tracking-widest max-w-[240px]">Select a target company from the list above to begin managing their enterprise architecture.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {AVAILABLE_MODULES.map((m, idx) => {
                    const active = !!enabledModules[m.code];
                    const Icon = m.icon;
                    return (
                      <div
                        key={m.code}
                        onClick={() => !saving && toggle(m.code)}
                        className={`group p-4 rounded-none border transition-all duration-300 cursor-pointer flex items-center gap-4 ${active
                          ? 'bg-white border-slate-100 shadow-sm'
                          : 'bg-slate-50/30 border-slate-100 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 hover:bg-white hover:border-slate-200'
                          }`}
                      >
                        <div className={`h-11 w-11 rounded-none flex items-center justify-center shrink-0 transition-all duration-500 ${active ? `${m.bg} ${m.color}` : 'bg-white text-slate-300 border border-slate-100'
                          }`}>
                          <Icon size={20} strokeWidth={2.5} />
                        </div>
                        <div className="min-w-0">
                          <h4 className={`text-[13px] font-black uppercase tracking-tight leading-none mb-1 ${active ? 'text-slate-800' : 'text-slate-400'}`}>
                            {m.label}
                          </h4>
                          <span className={`text-[11px] font-black uppercase tracking-widest ${active ? m.color : 'text-slate-300'}`}>
                            {active ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Removed Need Help? section */}
          </div>

        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap');
        .font-outfit { font-family: 'Outfit', sans-serif; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
}

ModuleConfig.propTypes = {
  company: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    modules: PropTypes.arrayOf(PropTypes.string),
    enabledModules: PropTypes.object
  }),
  onClose: PropTypes.func
};

