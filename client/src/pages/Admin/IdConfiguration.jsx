import React, { useState, useEffect } from 'react';
import { useRBAC } from '../../context/RBACContext';

import api from '../../utils/api';
import './IdConfiguration.css';
import { Save, RefreshCw, Settings, FileText, Hash, CheckCircle2 } from 'lucide-react';

const IdConfiguration = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savingDoc, setSavingDoc] = useState(null);

    // Data Models
    const [settings, setSettings] = useState({
        companyCode: '',
        branchCode: '',
        departmentCode: '',
        financialYear: '',
        resetPolicy: 'YEARLY'
    });
    const [documentTypes, setDocumentTypes] = useState([]);

    // UI State
    const [activeTab, setActiveTab] = useState('global');
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);

    const { hasPermission } = useRBAC();
    const [tenantProfile, setTenantProfile] = useState(null);

    // Permissions
    const canViewGlobal = hasPermission('configuration.company', 'view');
    const canEditGlobal = hasPermission('configuration.company', 'edit');

    const canViewDocs = hasPermission('configuration.sequences', 'view');
    const canEditDocs = hasPermission('configuration.sequences', 'edit');

    useEffect(() => {
        loadConfiguration();
        loadTenantProfile();
    }, []);

    const loadTenantProfile = async () => {
        try {
            const res = await api.get('/tenants/me');
            setTenantProfile(res.data || null);
        } catch (err) {
            console.error('Failed to load company profile:', err);
        }
    };

    const formatDateValue = (value) => {
        if (!value) return 'Not Available';
        const dt = new Date(value);
        if (Number.isNaN(dt.getTime())) return 'Not Available';
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getCompanyAddress = () => {
        if (!tenantProfile) return 'Not Available';
        const directAddress = tenantProfile.address || tenantProfile.companyAddress || tenantProfile.registeredAddress;
        if (typeof directAddress === 'string' && directAddress.trim()) return directAddress;

        const addrObj = tenantProfile.address && typeof tenantProfile.address === 'object' ? tenantProfile.address : null;
        if (!addrObj) return 'Not Available';

        return [
            addrObj.line1,
            addrObj.line2,
            addrObj.city,
            addrObj.state,
            addrObj.pincode || addrObj.zipCode,
            addrObj.country
        ].filter(Boolean).join(', ') || 'Not Available';
    };

    const companyInfo = [
        { label: 'Company Name', value: tenantProfile?.name || tenantProfile?.companyName || 'Not Available' },
        { label: 'Company Code', value: tenantProfile?.code || tenantProfile?.tenantCode || settings.companyCode || 'Not Available' },
        { label: 'Company Email', value: tenantProfile?.adminEmail || tenantProfile?.companyEmail || tenantProfile?.email || 'Not Available' },
        { label: 'Phone Number', value: tenantProfile?.phone || tenantProfile?.contactNumber || 'Not Available' },
        { label: 'Address', value: getCompanyAddress() },
        { label: 'Opened On', value: formatDateValue(tenantProfile?.createdAt || tenantProfile?.activatedAt || tenantProfile?.onboardedAt) },
    ];

    useEffect(() => {
        if (!canViewGlobal && canViewDocs) {
            setActiveTab('docs');
        } else if (!canViewGlobal && !canViewDocs) {
            // Both disabled
            setActiveTab(null);
        }
    }, [canViewGlobal, canViewDocs]);



    const loadConfiguration = async () => {
        try {
            setLoading(true);
            const res = await api.get('/company-id-config');
            if (res.data.success) {
                setSettings(res.data.data.settings);
                const priorityMap = { 'EMP': 1, 'INTN': 2 };
                const sortedTypes = [...res.data.data.documentTypes].sort((a, b) => {
                    const keyA = String(a.key || '').toUpperCase().trim();
                    const keyB = String(b.key || '').toUpperCase().trim();
                    
                    const pA = priorityMap[keyA] || 999;
                    const pB = priorityMap[keyB] || 999;
                    
                    if (pA !== pB) return pA - pB;
                    return String(a.name || '').localeCompare(String(b.name || ''));
                });
                setDocumentTypes(sortedTypes);
            }
        } catch (err) {
            console.error('Failed to load ID Config:', err);
            setError('Could not load configuration engine.');
        } finally {
            setLoading(false);
        }
    };

    const handleGlobalChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleDocTypeChange = (key, field, value) => {
        setDocumentTypes(prev => prev.map(dt =>
            dt.key === key ? { ...dt, [field]: value } : dt
        ));
    };

    const handleSaveGlobal = async () => {
        try {
            setSaving(true);
            await api.post('/company-id-config', { settings });
            setSuccess('Global Settings saved successfully.');
            await loadConfiguration();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSingle = async (docKey) => {
        try {
            setSavingDoc(docKey);
            const docToSave = documentTypes.find(d => d.key === docKey);
            await api.post('/company-id-config', { documentTypes: [docToSave] });
            setSuccess(`${docToSave.name || docKey} sequence saved successfully.`);
            await loadConfiguration();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Save failed');
        } finally {
            setSavingDoc(null);
        }
    };

    if (loading) return (
        <div className="h-full flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw size={32} className="animate-spin mb-4 text-[#4F46E5]" />
            <span className="text-sm font-bold uppercase tracking-widest text-[#4F46E5]">Loading Engine...</span>
        </div>
    );

    return (
        <div className="w-full font-['Outfit'] animate-in fade-in duration-500 overflow-x-hidden">
            <div className="bg-white border-b border-slate-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/30 dark:bg-indigo-900/10 blur-3xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="flex items-center gap-4 relative z-10">
                    <div className="h-12 w-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#4F46E5] shadow-sm">
                        <Hash size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase leading-none">Enterprise ID Engine</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Configure master numbering sequences</p>
                    </div>
                </div>
            </div>

            <div className="p-6 max-w-[1400px] mx-auto space-y-6">
                {error && (
                    <div className="bg-rose-50 border border-rose-100 text-rose-700 px-6 py-4 rounded-2xl flex items-center gap-3">
                        <span className="text-sm font-bold uppercase tracking-wide">{error}</span>
                    </div>
                )}
                {success && (
                    <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-6 py-4 rounded-2xl flex items-center gap-3">
                        <CheckCircle2 size={20} className="text-emerald-500" />
                        <span className="text-sm font-bold uppercase tracking-wide">{success}</span>
                    </div>
                )}

                <div className="flex gap-2 border-b border-slate-200">
                    {canViewGlobal && (
                        <button
                            className={`pb-4 px-6 text-[11px] font-black uppercase tracking-[0.15em] transition-all relative flex items-center gap-2 ${activeTab === 'global' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            onClick={() => setActiveTab('global')}
                        >
                            <Settings size={14} /> Global Settings
                            {activeTab === 'global' && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full shadow-[0_-2px_8px_rgba(20,184,166,0.3)]" />}
                        </button>
                    )}
                    {canViewDocs && (
                        <button
                            className={`pb-4 px-6 text-[11px] font-black uppercase tracking-[0.15em] transition-all relative flex items-center gap-2 ${activeTab === 'docs' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            onClick={() => setActiveTab('docs')}
                        >
                            <FileText size={14} /> Document Sequences
                            {activeTab === 'docs' && <div className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-indigo-600 rounded-t-full shadow-[0_-2px_8px_rgba(20,184,166,0.3)]" />}
                        </button>
                    )}
                </div>

                {activeTab === 'global' && (
                    <div className="space-y-6">
                        {/* Company Profile Section */}
                        <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100">
                            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Company Profile Overview</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {companyInfo.map((item) => (
                                    <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition-all hover:bg-white hover:shadow-sm">
                                        <p className="text-[10px] font-black text-slate-400 mb-1 uppercase tracking-widest">{item.label}</p>
                                        <p className="text-sm font-bold text-slate-700 break-words">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100">
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6">Master Configuration</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Company Code</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={settings.companyCode}
                                    onChange={(e) => handleGlobalChange('companyCode', e.target.value.toUpperCase())}
                                    placeholder="GTPL"
                                    disabled={!canEditGlobal}
                                />
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Used in {'{{COMPANY}}'} token</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Branch Code</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={settings.branchCode}
                                    onChange={(e) => handleGlobalChange('branchCode', e.target.value.toUpperCase())}
                                    placeholder="AHM"
                                    disabled={!canEditGlobal}
                                />
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Used in {'{{BRANCH}}'} token</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Default Dept Code</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={settings.departmentCode}
                                    onChange={(e) => handleGlobalChange('departmentCode', e.target.value.toUpperCase())}
                                    placeholder="GEN"
                                    disabled={!canEditGlobal}
                                />
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Fallback for {'{{DEPT}}'}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Financial Year</label>
                                <input
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase disabled:opacity-60 disabled:cursor-not-allowed"
                                    value={settings.financialYear}
                                    onChange={(e) => handleGlobalChange('financialYear', e.target.value)}
                                    placeholder="25-26"
                                    disabled={!canEditGlobal}
                                />
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1">Current Active Fiscal Year</p>
                            </div>
                        </div>

                        {canEditGlobal && (
                            <div className="mt-8 flex justify-end border-t border-slate-100 pt-6">
                                <button
                                    className="bg-slate-900 text-white px-8 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-[0.15em] hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-slate-200"
                                    onClick={handleSaveGlobal}
                                    disabled={saving}
                                >
                                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                    {saving ? 'Saving...' : 'Save Global Settings'}
                                </button>
                            </div>
                        )}
                        </div>
                    </div>
                )}

                {activeTab === 'docs' && (
                    <div className="grid grid-cols-1 gap-6 pb-20">
                        {documentTypes.map(doc => (
                            <div key={doc.key} className="bg-white p-6 md:p-8 rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col xl:flex-row gap-8 relative overflow-hidden group hover:border-indigo-100 transition-colors">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-bl-[100px] pointer-events-none transition-transform group-hover:scale-110" />
                                
                                <div className="flex-1 space-y-6 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xs font-black uppercase tracking-widest border border-indigo-100/50 shadow-sm">
                                            {doc.key}
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-black text-slate-800 tracking-tight uppercase">{doc.name || 'Custom Document'}</h3>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Sequence Configuration</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Prefix</label>
                                            <input
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all uppercase disabled:opacity-60 disabled:cursor-not-allowed"
                                                value={doc.prefix}
                                                onChange={(e) => handleDocTypeChange(doc.key, 'prefix', e.target.value.toUpperCase())}
                                                disabled={!canEditDocs}
                                            />
                                        </div>
                                        <div className="lg:col-span-2 space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Format Template</label>
                                            <input
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-700 font-mono text-sm px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-inner disabled:opacity-60 disabled:cursor-not-allowed"
                                                value={doc.formatTemplate}
                                                onChange={(e) => handleDocTypeChange(doc.key, 'formatTemplate', e.target.value)}
                                                disabled={!canEditDocs}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Start From</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                                value={doc.startFrom}
                                                onChange={(e) => handleDocTypeChange(doc.key, 'startFrom', parseInt(e.target.value))}
                                                disabled={!canEditDocs}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Padding Digits</label>
                                            <input
                                                type="number"
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                                value={doc.paddingDigits}
                                                onChange={(e) => handleDocTypeChange(doc.key, 'paddingDigits', parseInt(e.target.value))}
                                                disabled={!canEditDocs}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Reset Policy</label>
                                            <select
                                                className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                                value={doc.resetPolicy}
                                                onChange={(e) => handleDocTypeChange(doc.key, 'resetPolicy', e.target.value)}
                                                disabled={!canEditDocs}
                                            >
                                                <option value="YEARLY">Yearly Reset</option>
                                                <option value="NEVER">Never Reset</option>
                                            </select>
                                        </div>
                                        {(doc.key === 'EMP' || doc.key === 'INTN') && (
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Generation Mode</label>
                                                <select
                                                    className="w-full bg-slate-50 border border-slate-200 text-slate-900 font-semibold px-4 py-3 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                                    value={doc.generationMode || 'AUTO'}
                                                    onChange={(e) => handleDocTypeChange(doc.key, 'generationMode', e.target.value)}
                                                    disabled={!canEditDocs}
                                                >
                                                    <option value="AUTO">AUTO</option>
                                                    <option value="MANUAL">MANUAL</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {canEditDocs && (
                                        <div className="pt-2">
                                            <button
                                                className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 shadow-md shadow-slate-200"
                                                onClick={() => handleSaveSingle(doc.key)}
                                                disabled={savingDoc === doc.key}
                                            >
                                                {savingDoc === doc.key ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                                                {savingDoc === doc.key ? 'Saving...' : 'Save Sequence'}
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="w-full xl:w-[340px] bg-slate-50/50 rounded-2xl p-6 border border-slate-100 flex flex-col justify-center relative z-10 mt-6 xl:mt-0 shadow-inner">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" /> Live Preview
                                    </span>
                                    
                                    <div 
                                        className="min-h-[64px] w-full rounded-2xl flex items-center justify-center px-6 shadow-sm border-2 border-slate-300"
                                        style={{ backgroundColor: 'white !important', color: '#000000 !important', fontWeight: '900 !important' }}
                                    >
                                        {doc.previewId && doc.previewId.trim() ? (
                                            <span className="font-mono text-xl tracking-widest" style={{ color: '#000000 !important', fontWeight: '900 !important' }}>
                                                {doc.previewId}
                                            </span>
                                        ) : (
                                            <span className="text-rose-600 text-xs font-black uppercase tracking-[0.2em] animate-pulse">
                                                Waiting for sequence...
                                            </span>
                                        )}
                                    </div>
                                    
                                    <div className="mt-6 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest border-t border-slate-200 pt-4">
                                        <span className="flex flex-col gap-1">
                                            <span className="opacity-50">Last Used</span>
                                            <span className="text-slate-800">{doc.lastNumber >= doc.startFrom ? doc.lastNumber : 'None'}</span>
                                        </span>
                                        <span className="flex flex-col gap-1 text-right">
                                            <span className="opacity-50">Fiscal Year</span>
                                            <span className="text-slate-800 text-[#4F46E5]">{settings.financialYear}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default IdConfiguration;
