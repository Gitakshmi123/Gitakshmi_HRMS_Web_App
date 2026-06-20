import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Mail,
    Calendar,
    Shield,
    Users,
    ChevronLeft,
    Layout,
    Database,
    MapPin,
    Fingerprint,
    Zap,
    Package
} from 'lucide-react';
import companiesService from '../../services/companiesService';
import { API_ROOT } from '../../utils/api';
import { enabledModulesToArray, normalizeEnabledModules } from '../../utils/moduleConfig';
import { getPsaModuleByCode, PSA_MODULE_CODES } from '../../constants/psaModuleCatalog';

export default function ViewCompany() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);

    const getLogoUrl = (url) => {
        if (!url) return null;
        return url.startsWith('http') ? url : `${API_ROOT}${url}`;
    };

    useEffect(() => {
        loadCompany();
    }, [id]);

    const loadCompany = async () => {
        try {
            setLoading(true);
            const data = await companiesService.getCompanyById(id);
            setCompany(data);
        } catch (error) {
            console.error('Failed to load company details', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
            <div className="w-16 h-16 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="mt-6 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] animate-pulse">Syncing Entity Matrix...</p>
        </div>
    );

    if (!company) return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center text-rose-500 mb-6">
                <Shield size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Entity Not Found</h2>
            <p className="text-slate-400 mb-8 max-w-xs uppercase text-[10px] font-bold tracking-widest">The requested node identifier does not exist in the registry.</p>
            <button
                onClick={() => navigate('/psa/companies')}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95"
            >
                Return to Registry
            </button>
        </div>
    );

    const activeModules = enabledModulesToArray(normalizeEnabledModules(company.enabledModules, company.modules))
        .filter((code) => PSA_MODULE_CODES.includes(code));

    const getModuleIcon = (mod) => {
        const moduleConfig = getPsaModuleByCode(mod);
        if (!moduleConfig) {
            return { icon: <Layout size={18} />, color: 'text-slate-600', bg: 'bg-slate-50', name: mod };
        }
        const Icon = moduleConfig.icon;
        return {
            icon: <Icon size={18} />,
            color: moduleConfig.color.replace('-600', '-500'),
            bg: moduleConfig.bg,
            name: moduleConfig.label
        };
    };

    const getModuleDescription = (mod) => {
        const descriptions = {
            hr: 'Manage workforce profiles and organizational structural strategy.',
            payroll: 'Process compensation cycles and monitor employee financials.',
            attendance: 'Track precision time logs and operational availability.',
            leave: 'Manage temporal absence requests and balance tracking.',
            recruitment: 'Pipeline talent acquisition and candidate integration.',
            backgroundVerification: 'Security validation and candidate integrity checks.',
            documentManagement: 'Centralized repository for institutional certifications.',
            socialMediaIntegration: 'Cross-platform engagement and brand dissemination.',
            employeePortal: 'Self-service interface for personnel infrastructure.',
            onboarding: 'Coordinate joining workflows, tasks, and approvals.',
            policy: 'Institutional guidelines and corporate governance protocols.'
        };
        return descriptions[mod] || `Advanced functional capability for ${mod.replace(/-/g, ' ')} protocol.`;
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] font-['Outfit',sans-serif] pb-20 pt-6 px-6 max-w-[1600px] mx-auto animate-in fade-in duration-700">
            {/* Top Navigation Row */}
            <div className="flex items-center justify-between mb-8 px-2">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/psa/companies')}
                        className="h-10 w-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all shadow-sm active:scale-90"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">Company Profile // {company.code || 'ALPHA'}</h2>
                        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            System Status: Active
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                {/* LEFT CONSOLE: Core Briefing */}
                <div className="xl:col-span-12 lg:col-span-12 xl:grid xl:grid-cols-5 gap-8">
                    <div className="xl:col-span-3 space-y-8">
                        {/* Company Details Card */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
                            <div className="p-6">
                                <h3 className="text-sm font-black text-slate-900 mb-6 tracking-widest uppercase flex items-center gap-3">
                                    <Shield size={16} className="text-indigo-600" />
                                    Company Details
                                </h3>
                                
                                <div className="space-y-6">
                                    {/* Data Fields Condensed */}
                                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2.5">
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Primary Email</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Mail size={14} className="text-indigo-500" />
                                                <span className="text-[11px] font-bold text-slate-700 truncate">{company.adminUser?.email || company.adminEmail || company.companyEmail || 'void@null.system'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Administrator</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Users size={14} className="text-emerald-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.adminUser?.name || company.ownerName || 'Unknown Entity'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Created On</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Calendar size={14} className="text-rose-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.createdAt ? new Date(company.createdAt).toLocaleDateString('en-GB') : '2024'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">User Limit</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Users size={14} className="text-indigo-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.userLimit || '0'} Users</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">GST / PAN</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <Fingerprint size={14} className="text-blue-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.meta?.gst || '-'} / {company.meta?.pan || '-'}</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Location</p>
                                            <div className="h-11 bg-slate-50 rounded-xl flex items-center px-4 gap-3 border border-transparent group-hover:border-slate-100 transition-all">
                                                <MapPin size={14} className="text-emerald-500" />
                                                <span className="text-[11px] font-bold text-slate-700">{company.address || `${company.meta?.state || ''}, ${company.meta?.country || ''}` || 'Not Specified'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Holographic Profile Card Condensed */}
                                    <div className="relative h-44 bg-slate-900 rounded-2xl p-6 overflow-hidden shadow-xl flex flex-col justify-between group/card">
                                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '12px 12px' }}></div>
                                        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-indigo-500/10 via-transparent to-transparent"></div>

                                        <div className="relative z-10 flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-white p-2 border border-white/10 shadow-lg">
                                                {company.meta?.logo || company.logo ? (
                                                    <img src={getLogoUrl(company.meta?.logo || company.logo)} alt="Logo" className="w-full h-full object-contain" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-lg font-black text-slate-200 uppercase">
                                                        {(company.companyName || company.name || 'C').charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="text-base font-black text-white tracking-tight leading-tight uppercase">{company.companyName || company.name}</h4>
                                                <p className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.2em] mt-0.5">Display Profile</p>
                                            </div>
                                        </div>

                                        <div className="relative z-10 space-y-1">
                                            <p className="text-[8px] font-bold text-white/30 uppercase tracking-widest px-1">Primary Contact</p>
                                            <div className="flex items-center gap-2 text-white/90">
                                                <Zap size={11} className="text-emerald-400" />
                                                <span className="text-sm font-black font-mono tracking-tight">{company.phone || '800-233-7370'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Admin Actions */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 group">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-sm font-black text-slate-900 tracking-widest uppercase flex items-center gap-3">
                                    <Database size={16} className="text-indigo-600" />
                                    Recent Admin Actions
                                </h3>
                            </div>
                            
                            <div className="space-y-6 pl-4 border-l-2 border-slate-50">
                                <div className="relative">
                                    <div className="absolute -left-[25px] top-1 w-4 h-4 rounded-full bg-white border-4 border-indigo-500 shadow-sm shadow-indigo-200"></div>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[11px] font-black text-slate-800 uppercase">Parameters Updated</p>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">3 month ago</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-widest">System node configuration modified.</p>
                                </div>
                                <div className="relative opacity-60">
                                    <div className="absolute -left-[25px] top-1 w-4 h-4 rounded-full bg-slate-100 border-4 border-slate-300"></div>
                                    <div className="flex items-center justify-between mb-1">
                                        <p className="text-[11px] font-black text-slate-400 uppercase">Initial Boot Sequence</p>
                                        <span className="text-[9px] font-bold text-slate-300 tracking-widest uppercase">Initial</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-300 leading-relaxed uppercase tracking-widest">Infrastructure deployment complete.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT CONSOLE: Module Marketplace */}
                    <div className="xl:col-span-2">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 h-full">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-100/50">
                                        <Package size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-slate-900 tracking-widest uppercase leading-none">Modules</h3>
                                        <p className="text-[8px] font-bold text-indigo-500 uppercase tracking-[0.2em] mt-1.5">Active Modules</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => navigate(`/psa/modules/${company._id}`)}
                                    className="h-9 w-9 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white transition-all shadow-sm active:scale-95"
                                    title="Manage Protocols"
                                >
                                    <Layout size={16} />
                                </button>
                            </div>

                            {activeModules && activeModules.length > 0 ? (
                                <div className="grid grid-cols-2 lg:grid-cols-2 3xl:grid-cols-3 gap-3">
                                    {activeModules.map((mod) => (
                                        <div
                                            key={mod}
                                            className="group bg-slate-50/50 border border-slate-100/50 rounded-xl p-3 hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all duration-300 flex flex-col items-center text-center gap-2 active:scale-[0.98]"
                                        >
                                            <div className={`w-9 h-9 rounded-lg ${getModuleIcon(mod).bg} flex items-center justify-center ${getModuleIcon(mod).color} group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shadow-sm`}>
                                                {getModuleIcon(mod).icon}
                                            </div>
                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest leading-none text-center group-hover:text-slate-900 transition-colors">
                                                {getModuleIcon(mod).name}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="h-[400px] border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center p-8 group hover:bg-slate-50/50 transition-all">
                                    <div className="w-20 h-20 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-200 mb-6 blur-[1px] group-hover:blur-0 transition-all duration-700 border border-slate-100">
                                        <Package size={32} />
                                    </div>
                                    <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase">No Modules Found</h4>
                                    <p className="text-[9px] font-bold text-slate-400 mt-3 max-w-xs uppercase tracking-[0.15em] leading-relaxed">No active modules found for this company.</p>
                                    <button 
                                        onClick={() => navigate(`/psa/modules/${company._id}`)}
                                        className="mt-8 h-10 px-6 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-[0.15em] shadow-lg hover:bg-indigo-600 transition-all active:scale-95"
                                    >
                                        Setup Modules
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tactical Footer Overlay */}
            <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent opacity-50"></div>
        </div>
    );
}
