/**
 * ═══════════════════════════════════════════════════════════════════════
 * ENTERPRISE ID ENGINE CONFIGURATION - SETTINGS VIEW
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Centralized configuration for all Document IDs in the system.
 * Manages Company Codes, Branch Codes, and Financial Year rollover.
 * 
 * @version 3.0 (Enterprise)
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { notification } from '../../utils/antdGlobal';
import api from '../../utils/api';
import CustomSelect from '../../components/shared/CustomSelect';
import usePagePermissions from '../../hooks/usePagePermissions';
import { DatabaseZap, Lock, Link2, CheckCircle2, AlertCircle } from 'lucide-react';

const CompanySettings = ({ forceTab }) => {
    const location = useLocation();
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
    const [tenantProfile, setTenantProfile] = useState(null);

    // DMS Integration state
    const [dmsCompanyId, setDmsCompanyId] = useState('');
    const [dmsCompanyIdInput, setDmsCompanyIdInput] = useState('');
    const [dmsSaving, setDmsSaving] = useState(false);
    const [dmsLoaded, setDmsLoaded] = useState(false);
    const [dmsStatus, setDmsStatus] = useState(null); // 'saved' | 'error'

    // UI State
    const [activeTab, setActiveTab] = useState(
        forceTab === 'dms' ? 'dms' :
        forceTab === 'company' ? 'global' : 
        forceTab === 'sequences' ? 'docs' :
        location.pathname.includes('sequences') ? 'docs' : 'global'
    );
    const [error, setError] = useState(null);
    const [seedingDemo, setSeedingDemo] = useState(false);

    // RBAC Hooks
    const globalPerms = usePagePermissions('configuration.company');
    const sequencePerms = usePagePermissions('configuration.sequences');

    useEffect(() => {
        if (location.pathname.includes('sequences')) {
            setActiveTab('docs');
        } else {
            setActiveTab('global');
        }
    }, [location.pathname]);

    useEffect(() => {
        loadConfiguration();
        loadTenantProfile();
        loadDmsIntegration();
    }, []);

    const loadTenantProfile = async () => {
        try {
            const res = await api.get('/tenants/me');
            setTenantProfile(res.data || null);
        } catch (err) {
            console.error('Failed to load company profile:', err);
        }
    };

    const loadDmsIntegration = async () => {
        try {
            const res = await api.get('/tenants/dms-integration');
            if (res.data?.success) {
                setDmsCompanyId(res.data.dmsCompanyId || '');
                setDmsCompanyIdInput(res.data.dmsCompanyId || '');
                setDmsLoaded(true);
            }
        } catch (err) {
            console.error('Failed to load DMS integration:', err);
            setDmsLoaded(true);
        }
    };

    const handleSaveDmsIntegration = async () => {
        try {
            setDmsSaving(true);
            setDmsStatus(null);
            const res = await api.put('/tenants/dms-integration', { dmsCompanyId: dmsCompanyIdInput });
            if (res.data?.success) {
                setDmsCompanyId(dmsCompanyIdInput);
                setDmsStatus('saved');
                notification.success({
                    message: 'DMS Integration Saved',
                    description: 'DMS Company ID has been linked successfully.',
                    duration: 3
                });
            }
        } catch (err) {
            setDmsStatus('error');
            notification.error({
                message: 'Save Failed',
                description: err.response?.data?.message || 'Could not save DMS Company ID.',
                duration: 4
            });
        } finally {
            setDmsSaving(false);
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

        const line = [
            addrObj.line1,
            addrObj.line2,
            addrObj.city,
            addrObj.state,
            addrObj.pincode || addrObj.zipCode,
            addrObj.country
        ].filter(Boolean).join(', ');

        return line || 'Not Available';
    };

    const companyInfo = [
        { label: 'Company Name', value: tenantProfile?.name || tenantProfile?.companyName || 'Not Available' },
        { label: 'Company Code', value: tenantProfile?.code || tenantProfile?.tenantCode || settings.companyCode || 'Not Available' },
        { label: 'Company Email', value: tenantProfile?.adminEmail || tenantProfile?.companyEmail || tenantProfile?.email || 'Not Available' },
        { label: 'Phone Number', value: tenantProfile?.phone || tenantProfile?.contactNumber || 'Not Available' },
        { label: 'Address', value: getCompanyAddress() },
        { label: 'Opened On', value: formatDateValue(tenantProfile?.createdAt || tenantProfile?.activatedAt || tenantProfile?.onboardedAt) },
    ];

    const loadConfiguration = async () => {
        try {
            setLoading(true);
            // Calls the new enterprise controller
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

    const handleSave = async () => {
        try {
            setSaving(true);
            const payload = {
                settings,
                documentTypes
            };

            await api.post('/company-id-config', payload);

            // Show success notification
            notification.success({
                message: 'Settings Saved',
                description: 'Configuration verified and saved.',
                duration: 3
            });

            // Reload to refresh Next Numbers
            await loadConfiguration();
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

            const payload = {
                documentTypes: [docToSave]
            };

            await api.post('/company-id-config', payload);

            notification.success({
                message: 'Sequence Saved',
                description: `${docToSave.name || docKey} sequence saved successfully.`,
                duration: 3
            });

            await loadConfiguration();
        } catch (err) {
            setError(err.response?.data?.message || 'Save failed');
            notification.error({
                message: 'Save Failed',
                description: err.response?.data?.message || 'Could not save the sequence.',
                duration: 3
            });
        } finally {
            setSavingDoc(null);
        }
    };

    const handleSeedDemoData = async () => {
        const confirmed = window.confirm('Create demo data for this company? This will add employees, attendance, leave requests, jobs, candidates, and tickets. Existing records will not be deleted.');
        if (!confirmed) return;

        try {
            setSeedingDemo(true);
            const res = await api.post('/demo-data/seed');
            const summary = res.data?.data?.summary || {};
            const total = Object.values(summary).reduce((sum, item) => sum + (item.created || 0) + (item.updated || 0), 0);

            notification.success({
                message: 'Demo Data Ready',
                description: `${total || 'All'} demo records prepared. Demo employee password: Demo@12345`,
                duration: 5
            });
        } catch (err) {
            notification.error({
                message: 'Demo Seed Failed',
                description: err.response?.data?.message || 'Could not create demo data.',
                duration: 5
            });
        } finally {
            setSeedingDemo(false);
        }
    };

    if (loading) return <div className="p-8 flex justify-center text-slate-500">Loading Enterprise Engine...</div>;

    return (
        <div className="w-full h-full p-0">

            {error && <div className="bg-rose-50 text-rose-700 p-4 rounded mb-6">{error}</div>}

            {error && <div className="bg-rose-50 text-rose-700 p-4 rounded mb-6">{error}</div>}

            {activeTab === 'global' && (
                <div className="space-y-4">
                    {/* DMS Integration Quick Link Banner */}
                    <div
                        className="flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition"
                        style={{ background: dmsCompanyId ? '#f0fdf4' : '#fff7ed', borderColor: dmsCompanyId ? '#86efac' : '#fed7aa' }}
                        onClick={() => setActiveTab('dms')}
                    >
                        <Link2 size={18} style={{ color: dmsCompanyId ? '#16a34a' : '#ea580c' }} />
                        <span className="text-sm font-semibold" style={{ color: dmsCompanyId ? '#16a34a' : '#ea580c' }}>
                            {dmsCompanyId
                                ? `DMS Linked ✓ — Company ID: ${dmsCompanyId}`
                                : 'DMS Not Linked — Click to configure DMS Integration'}
                        </span>
                    </div>

                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex flex-col gap-3 px-[5px] mb-3 lg:flex-row lg:items-center lg:justify-between">
                            <h2 className="text-xl font-semibold">Company Profile Overview</h2>
                            {globalPerms.canEdit && (
                                <button
                                    type="button"
                                    onClick={handleSeedDemoData}
                                    disabled={seedingDemo}
                                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 text-xs font-bold uppercase tracking-wide text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    title="Create demo records across HRMS modules"
                                >
                                    <DatabaseZap size={16} />
                                    {seedingDemo ? 'Creating Demo Data...' : 'Create Demo Data'}
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 px-[5px]">
                            {companyInfo.map((item) => (
                                <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">{item.label}</p>
                                    <p className="text-sm font-semibold text-slate-800 break-words">{item.value}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white p-[10px] rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-xl font-semibold mb-4 px-[5px]">Master Configuration</h2>
                    <div className="grid grid-cols-2 gap-4 px-[5px]">
                        <div className="form-group">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Company Code</label>
                            <input
                                className={`w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 uppercase ${!globalPerms.canEdit ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                                value={settings.companyCode}
                                onChange={(e) => handleGlobalChange('companyCode', e.target.value.toUpperCase())}
                                placeholder="GTPL"
                                readOnly={!globalPerms.canEdit}
                            />
                            <p className="text-xs text-slate-500 mt-1">Used in &#123;&#123;COMPANY&#125;&#125; token</p>
                        </div>

                        <div className="form-group">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Branch Code</label>
                            <input
                                className={`w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 uppercase ${!globalPerms.canEdit ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                                value={settings.branchCode}
                                onChange={(e) => handleGlobalChange('branchCode', e.target.value.toUpperCase())}
                                placeholder="AHM"
                                readOnly={!globalPerms.canEdit}
                            />
                            <p className="text-xs text-slate-500 mt-1">Used in &#123;&#123;BRANCH&#125;&#125; token</p>
                        </div>

                        <div className="form-group">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Default Dept Code</label>
                            <input
                                className={`w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 uppercase ${!globalPerms.canEdit ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                                value={settings.departmentCode}
                                onChange={(e) => handleGlobalChange('departmentCode', e.target.value.toUpperCase())}
                                placeholder="GEN"
                                readOnly={!globalPerms.canEdit}
                            />
                            <p className="text-xs text-slate-500 mt-1">Fallback for &#123;&#123;DEPT&#125;&#125;</p>
                        </div>

                        <div className="form-group">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Financial Year</label>
                            <input
                                className={`w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 ${!globalPerms.canEdit ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                                value={settings.financialYear}
                                onChange={(e) => handleGlobalChange('financialYear', e.target.value)}
                                placeholder="25-26"
                                readOnly={!globalPerms.canEdit}
                            />
                            <p className="text-xs text-slate-500 mt-1">Current Active Fiscal Year</p>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                        {globalPerms.canEdit ? (
                            <button
                                className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 font-medium flex items-center gap-2"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save Global Settings'}
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-500 bg-slate-100 px-4 py-2 rounded-lg border border-slate-200">
                                <Lock size={14} />
                                <span className="text-xs font-semibold uppercase tracking-wider">View Only Mode</span>
                            </div>
                        )}
                    </div>
                    </div>
                </div>
            )}

            {activeTab === 'docs' && (
                <div className="grid grid-cols-1 gap-4 pb-[10px]">
                    {documentTypes.map(doc => (
                        <div key={doc.key} className="bg-white p-[10px] rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-[10px] hover:border-indigo-200 transition-colors">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="bg-indigo-100 text-indigo-700 p-1.5 rounded text-xs font-bold w-12 text-center">
                                        {doc.key}
                                    </div>
                                    <h3 className="text-base font-bold text-slate-800">{doc.name || 'Custom Document'}</h3>
                                </div>

                                <div className="flex flex-col xl:flex-row flex-wrap gap-4 items-start">
                                    <div className="w-full xl:w-20">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Prefix</label>
                                        <input
                                            className={`w-full mt-0.5 p-1.5 border rounded text-xs uppercase focus:ring-1 focus:ring-indigo-500 ${!sequencePerms.canEdit ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                                            value={doc.prefix}
                                            onChange={(e) => handleDocTypeChange(doc.key, 'prefix', e.target.value.toUpperCase())}
                                            readOnly={!sequencePerms.canEdit}
                                        />
                                    </div>
                                    <div className="w-full xl:flex-1 min-w-[280px]">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Format Template</label>
                                        <input
                                            className={`w-full mt-0.5 p-1.5 border rounded text-xs font-mono text-slate-600 focus:ring-1 focus:ring-indigo-500 ${!sequencePerms.canEdit ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                                            value={doc.formatTemplate}
                                            onChange={(e) => handleDocTypeChange(doc.key, 'formatTemplate', e.target.value)}
                                            readOnly={!sequencePerms.canEdit}
                                        />
                                    </div>
                                    <div className="w-full xl:w-24">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Start From</label>
                                        <input
                                            type="number"
                                            className={`w-full mt-0.5 p-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 ${!sequencePerms.canEdit ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                                            value={doc.startFrom}
                                            onChange={(e) => handleDocTypeChange(doc.key, 'startFrom', parseInt(e.target.value))}
                                            readOnly={!sequencePerms.canEdit}
                                        />
                                    </div>
                                    <div className="w-full xl:w-20">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Padding</label>
                                        <input
                                            type="number"
                                            className={`w-full mt-0.5 p-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 ${!sequencePerms.canEdit ? 'bg-slate-50 cursor-not-allowed text-slate-500' : ''}`}
                                            value={doc.paddingDigits}
                                            onChange={(e) => handleDocTypeChange(doc.key, 'paddingDigits', parseInt(e.target.value))}
                                            readOnly={!sequencePerms.canEdit}
                                        />
                                    </div>
                                    <div className="w-full xl:w-32">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Reset Policy</label>
                                        <select
                                            className={`w-full mt-0.5 p-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 bg-white outline-none ${!sequencePerms.canEdit ? 'bg-slate-50 cursor-not-allowed text-slate-500 opacity-70' : ''}`}
                                            value={doc.resetPolicy}
                                            onChange={(e) => handleDocTypeChange(doc.key, 'resetPolicy', e.target.value)}
                                            disabled={!sequencePerms.canEdit}
                                        >
                                            <option value="YEARLY">Yearly</option>
                                            <option value="NEVER">Never</option>
                                        </select>
                                    </div>
                                    {(doc.key === 'EMP' || doc.key === 'INTN' || doc.key === 'DEPT') && (
                                        <div className="w-full xl:w-32">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Generation Mode</label>
                                            <select
                                                className={`w-full mt-0.5 p-1.5 border rounded text-xs focus:ring-1 focus:ring-indigo-500 bg-white outline-none font-semibold text-slate-900 ${!sequencePerms.canEdit ? 'bg-slate-50 cursor-not-allowed text-slate-500 opacity-70' : ''}`}
                                                value={doc.generationMode || 'AUTO'}
                                                onChange={(e) => handleDocTypeChange(doc.key, 'generationMode', e.target.value)}
                                                disabled={!sequencePerms.canEdit}
                                            >
                                                <option value="AUTO">AUTO</option>
                                                <option value="MANUAL">MANUAL</option>
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="w-full xl:w-[300px] lg:w-[250px] shrink-0 bg-slate-50 rounded-xl px-3 pt-2.5 pb-1.5 border border-slate-100 flex flex-col md:flex-row items-end justify-between gap-3 relative">
                                <div className="flex-1 min-w-0 flex flex-col">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase mb-0.5 block">Live Preview (Next ID)</label>
                                    <div className="relative">
                                        <div 
                                            className="min-h-[44px] w-full rounded-xl flex items-center justify-center px-4 shadow-sm border-2 border-slate-300"
                                            style={{ backgroundColor: 'white !important', color: '#000000 !important', fontWeight: '900 !important', fontSize: '15px !important' }}
                                        >
                                            {doc.previewId && doc.previewId.trim() ? (
                                                <span style={{ color: '#000000 !important', fontWeight: '900 !important' }}>
                                                    {doc.previewId}
                                                </span>
                                            ) : (
                                                <span className="text-rose-600 text-[10px] font-bold uppercase tracking-widest animate-pulse">
                                                    Waiting for Data...
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="shrink-0 w-full md:w-auto">
                                    {sequencePerms.canEdit ? (
                                        <button
                                            className="w-full bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                                            onClick={() => handleSaveSingle(doc.key)}
                                            disabled={savingDoc === doc.key}
                                        >
                                            {savingDoc === doc.key ? 'Saving...' : 'Save'}
                                        </button>
                                    ) : (
                                        <div className="flex items-center gap-1.5 text-slate-400 px-3 py-1.5 rounded-lg border border-slate-100 bg-white shadow-sm">
                                            <Lock size={12} />
                                            <span className="text-[10px] font-bold uppercase">Locked</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── DMS INTEGRATION TAB ── */}
            {activeTab === 'dms' && (
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100">
                                <Link2 size={22} className="text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-slate-800">DMS Integration</h2>
                                <p className="text-sm text-slate-500">Link this company to the Document Management System</p>
                            </div>
                        </div>

                        {/* Current Status */}
                        <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${dmsCompanyId ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                            {dmsCompanyId
                                ? <CheckCircle2 size={20} className="text-green-600 shrink-0" />
                                : <AlertCircle size={20} className="text-amber-600 shrink-0" />
                            }
                            <div>
                                <p className={`text-sm font-semibold ${dmsCompanyId ? 'text-green-700' : 'text-amber-700'}`}>
                                    {dmsCompanyId ? 'DMS Linked ✓' : 'DMS Not Linked'}
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    {dmsCompanyId
                                        ? `Current DMS Company ID: ${dmsCompanyId}`
                                        : 'Without a DMS Company ID, candidate documents will not sync to DMS.'}
                                </p>
                            </div>
                        </div>

                        {/* Input Field */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">
                                DMS Company ID
                                <span className="ml-2 text-xs font-normal text-slate-400">(DMS Admin Console → Companies → Copy _id)</span>
                            </label>
                            <input
                                type="text"
                                className="w-full p-3 border border-slate-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-400 outline-none transition"
                                placeholder="e.g. 6859abc123def456789012"
                                value={dmsCompanyIdInput}
                                onChange={(e) => setDmsCompanyIdInput(e.target.value.trim())}
                            />
                            <p className="text-xs text-slate-400 mt-1.5">
                                📋 Go to <strong>DMS Panel → Super Admin → Companies</strong>, open the desired company, copy its <code className="bg-slate-100 px-1 py-0.5 rounded">_id</code> and paste it here.
                            </p>
                        </div>

                        {/* Save Button */}
                        <div className="flex items-center gap-3">
                            <button
                                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
                                onClick={handleSaveDmsIntegration}
                                disabled={dmsSaving || !dmsCompanyIdInput.trim()}
                            >
                                <Link2 size={16} />
                                {dmsSaving ? 'Saving...' : 'Save DMS Link'}
                            </button>
                            {dmsStatus === 'saved' && (
                                <span className="flex items-center gap-1.5 text-green-600 text-sm font-semibold">
                                    <CheckCircle2 size={16} /> Saved successfully!
                                </span>
                            )}
                            {dmsStatus === 'error' && (
                                <span className="flex items-center gap-1.5 text-rose-600 text-sm font-semibold">
                                    <AlertCircle size={16} /> Save failed. Try again.
                                </span>
                            )}
                        </div>

                        {/* How it works box */}
                        <div className="mt-6 bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">🔗 How it works</p>
                            <ol className="list-decimal list-inside space-y-1.5 text-xs text-slate-500">
                                <li>Open <strong>DMS Panel → Super Admin → Companies</strong></li>
                                <li>Click on the company you want to link with this HRMS account</li>
                                <li>Copy the <strong>_id</strong> from the URL or company details (24-character string)</li>
                                <li>Paste it in the field above and click <strong>"Save DMS Link"</strong></li>
                                <li>✅ Done! Candidate documents will now automatically sync into the linked DMS company's folder.</li>
                            </ol>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompanySettings;
