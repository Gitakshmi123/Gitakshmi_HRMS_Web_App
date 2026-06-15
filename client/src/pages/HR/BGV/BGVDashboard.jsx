import React, { useState, useEffect, useCallback } from 'react';
import api from '../../../utils/api';
import { showToast } from '../../../utils/uiNotifications';
import {
    Shield, Search, Filter, CheckCircle, XCircle, Clock, AlertCircle,
    Eye, Download, ChevronRight, User, Calendar, FileText, ArrowRight, X,
    Package, TrendingUp, AlertTriangle, PlayCircle, CheckSquare, XSquare, Target, Layers
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import InitiateBGVModal from './InitiateBGVModal';
import BGVDetailModal from './BGVDetailModal';
import CustomSelect from '../../../components/shared/CustomSelect';
import { useSearchParams } from 'react-router-dom';
import usePagePermissions from '../../../hooks/usePagePermissions';

dayjs.extend(relativeTime);

const BGVDashboard = () => {
    const { canView, canCreate, canEdit, canDelete } = usePagePermissions('bgv.caseMaster');
    const canAccessBGV = canView || canCreate || canEdit || canDelete;
    const [cases, setCases] = useState([]);
    const [stats, setStats] = useState(null);
    const [riskStats, setRiskStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [statusFilter, setStatusFilter] = useState('all');
    const [packageFilter, setPackageFilter] = useState('all');
    const [selectedCase, setSelectedCase] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showInitiateModal, setShowInitiateModal] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchRiskDashboard = useCallback(async () => {
        if (!canAccessBGV) return;
        try {
            const res = await api.get('/bgv/risk-dashboard');
            setRiskStats(res.data.data);
        } catch (err) {
            console.error('Failed to fetch risk dashboard:', err);
        }
    }, [canAccessBGV]);

    const fetchStats = useCallback(async () => {
        if (!canAccessBGV) return;
        try {
            const res = await api.get('/bgv/stats');
            setStats(res.data.data);
        } catch (err) {
            console.error('Failed to fetch BGV stats:', err);
        }
    }, [canAccessBGV]);

    const fetchCases = useCallback(async () => {
        if (!canAccessBGV) return;
        setLoading(true);
        try {
            const params = {
                page,
                limit: 20,
                ...(statusFilter !== 'all' && { status: statusFilter }),
                ...(packageFilter !== 'all' && { package: packageFilter }),
                ...(searchQuery && { search: searchQuery })
            };

            const res = await api.get('/bgv/cases', { params });
            const casesData = res.data.data || [];

            const casesWithRisk = await Promise.all(
                casesData.map(async (caseItem) => {
                    try {
                        const riskRes = await api.get(`/bgv/case/${caseItem._id}/risk-score`);
                        return {
                            ...caseItem,
                            riskScore: riskRes.data.data?.riskScore || null
                        };
                    } catch {
                        return { ...caseItem, riskScore: null };
                    }
                })
            );

            setCases(casesWithRisk);
            setTotalPages(res.data.pagination?.pages || 1);
        } catch (err) {
            console.error('Failed to fetch BGV cases:', err);
            showToast('error', 'Error', 'Failed to load background verification cases');
        } finally {
            setLoading(false);
        }
    }, [canAccessBGV, page, packageFilter, searchQuery, statusFilter]);

    useEffect(() => {
        if (!canAccessBGV) {
            setCases([]);
            setStats(null);
            setRiskStats(null);
            setLoading(false);
            return;
        }

        fetchStats();
        fetchRiskDashboard();
        fetchCases();
    }, [canAccessBGV, fetchCases, fetchRiskDashboard, fetchStats]);

    const handleViewDetails = async (caseItem) => {
        if (!canAccessBGV) return;
        try {
            const res = await api.get(`/bgv/case/${caseItem._id}`);
            setSelectedCase(res.data.data);
            setShowDetailModal(true);
        } catch {
            showToast('error', 'Error', 'Failed to load case details');
        }
    };

    const getStatusStyles = (status) => {
        switch (status) {
            case 'VERIFIED': return { color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' };
            case 'VERIFIED_WITH_DISCREPANCIES': return { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' };
            case 'FAILED': return { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' };
            case 'IN_PROGRESS': return { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' };
            case 'PENDING': return { color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' };
            case 'CLOSED': return { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' };
            default: return { color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' };
        }
    };

    const getPackageBadge = (pkg) => {
        const styles = {
            BASIC: 'bg-slate-50 text-slate-500 border-slate-100',
            STANDARD: 'bg-indigo-50 text-[#4F46E5] border-indigo-100',
            PREMIUM: 'bg-purple-50 text-purple-600 border-purple-100'
        };
        return styles[pkg] || styles.BASIC;
    };

    if (!canView && !loading) {
        return (
            <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-slate-100 shadow-sm text-center m-6 font-inter group">
                <div className="w-24 h-24 bg-rose-50 rounded-[2.5rem] flex items-center justify-center text-rose-500 mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                    <Shield size={48} strokeWidth={2} />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">Access Denied</h3>
                <p className="text-slate-400 font-bold text-[11px] max-w-sm mx-auto uppercase tracking-widest leading-relaxed">
                    You do not have the required permissions to access the Background Verification Dashboard.
                </p>
                <div className="mt-8 flex items-center gap-3">
                    <div className="h-1 w-12 bg-slate-100 rounded-full"></div>
                    <AlertTriangle size={16} className="text-amber-400" />
                    <div className="h-1 w-12 bg-slate-100 rounded-full"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="px-5 py-6 w-full animate-in fade-in duration-700 font-sans selection:bg-indigo-100 selection:text-indigo-600">
            {/* Header - Initiate Button only */}
            <div className="flex justify-end mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
                {canCreate && (
                    <button
                        onClick={() => setShowInitiateModal(true)}
                        className="h-12 px-8 bg-[#4F46E5] text-white rounded-2xl font-bold text-[12px] uppercase tracking-widest hover:bg-[#0d9488] hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 border-none flex items-center gap-2.5"
                    >
                        <PlayCircle size={18} strokeWidth={2.5} />
                        Initiate BGV
                    </button>
                )}
            </div>

            {/* Statistics Cards */}
            {stats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-8">
                    <StatCard
                        title="Total Cases"
                        value={stats.total}
                        icon={<FileText size={24} />}
                        color="slate"
                        trend="+12%"
                    />
                    <StatCard
                        title="Pending"
                        value={stats.pending}
                        icon={<Clock size={24} />}
                        color="amber"
                        onClick={() => setStatusFilter('PENDING')}
                    />
                    <StatCard
                        title="Verified"
                        value={stats.verified}
                        icon={<CheckCircle size={24} />}
                        color="indigo"
                        onClick={() => setStatusFilter('VERIFIED')}
                    />
                    <StatCard
                        title="Failed"
                        value={stats.failed}
                        icon={<XCircle size={24} />}
                        color="rose"
                        onClick={() => setStatusFilter('FAILED')}
                    />
                    <StatCard
                        title="Overdue"
                        value={stats.overdue}
                        icon={<AlertTriangle size={24} />}
                        color="orange"
                        urgent={stats.overdue > 0}
                    />
                </div>
            )}

            {/* Risk Assessment Section */}
            {riskStats && (
                <div className="bg-white rounded-[2.5rem] border border-slate-200/60 p-8 shadow-sm mb-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity">
                        <Shield size={200} />
                    </div>

                    <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Risk Assessment</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Current risk scores</p>
                            </div>
                        </div>
                        <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100">
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 text-center">Avg. Score</p>
                            <p className="text-2xl font-bold text-slate-900 leading-none text-center">{riskStats.averageRiskScore?.toFixed(1) || '0.0'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
                        <RiskCard level="CLEAR" count={riskStats.summary?.CLEAR || 0} color="emerald" icon={<CheckCircle size={20} />} label="Minimal Issues" />
                        <RiskCard level="LOW RISK" count={riskStats.summary?.LOW_RISK || 0} color="blue" icon={<Shield size={20} />} label="Minor Alerts" />
                        <RiskCard level="MODERATE" count={riskStats.summary?.MODERATE_RISK || 0} color="amber" icon={<AlertCircle size={20} />} label="Requires Audit" />
                        <RiskCard level="HIGH RISK" count={riskStats.summary?.HIGH_RISK || 0} color="orange" icon={<AlertTriangle size={20} />} label="Action Needed" />
                        <RiskCard level="CRITICAL" count={riskStats.summary?.CRITICAL || 0} color="rose" icon={<XCircle size={20} />} label="Immediate Risk" />
                    </div>

                    {riskStats.highRiskCases && riskStats.highRiskCases.length > 0 && (
                        <div className="mt-8 p-6 bg-rose-50/50 rounded-[2rem] border border-rose-100 transition-all hover:bg-rose-50">
                            <div className="flex items-center gap-2 mb-4">
                                <AlertTriangle size={18} className="text-rose-500" />
                                <h3 className="text-xs font-bold text-rose-900 uppercase tracking-[0.1em]">High Risk Cases</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {riskStats.highRiskCases.slice(0, 3).map((riskCase) => (
                                    <div key={riskCase.caseId} className="bg-white p-4 rounded-2xl border border-rose-100 flex items-center justify-between group/risk hover:border-rose-300 transition-all">
                                        <div>
                                            <p className="text-[10px] font-bold text-[#4F46E5] font-mono tracking-tighter">{riskCase.caseId}</p>
                                            <p className="text-sm font-semibold text-slate-800 tracking-tight">{riskCase.candidateName}</p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-lg font-bold text-rose-500 leading-none">{riskCase.totalRiskScore}</span>
                                            <span className="text-[8px] font-bold text-rose-300 uppercase mt-1">SCORE</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-300 group-focus-within:text-[#4F46E5] transition-colors">
                            <Search size={16} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search Candidates..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 h-11 bg-white border border-slate-200 rounded-2xl text-sm font-medium transition-all focus:ring-4 focus:ring-indigo-500/5 focus:border-[#4F46E5] outline-none placeholder:text-slate-400 shadow-sm"
                        />
                    </div>

                    {/* Status Filter */}
                    <CustomSelect
                        icon={<Filter size={15} />}
                        value={statusFilter}
                        onChange={val => setStatusFilter(val)}
                        options={[
                            { value: 'all', label: 'All Statuses' },
                            { value: 'PENDING', label: 'Pending' },
                            { value: 'IN_PROGRESS', label: 'In Progress' },
                            { value: 'VERIFIED', label: 'Verified' },
                            { value: 'VERIFIED_WITH_DISCREPANCIES', label: 'Verified with Discrepancies' },
                            { value: 'FAILED', label: 'Failed' },
                            { value: 'CLOSED', label: 'Closed' },
                        ]}
                    />

                    {/* Package Filter */}
                    <CustomSelect
                        icon={<Package size={15} />}
                        value={packageFilter}
                        onChange={val => setPackageFilter(val)}
                        options={[
                            { value: 'all', label: 'All Packages' },
                            { value: 'BASIC', label: 'Basic Tier' },
                            { value: 'STANDARD', label: 'Standard Tier' },
                            { value: 'PREMIUM', label: 'Premium Tier' },
                        ]}
                    />
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-widest shadow-sm">
                        TOTAL CASES: <span className="text-slate-900 ml-1 font-bold">{cases.length}</span>
                    </div>
                </div>
            </div>

            {/* Cases Grid Container */}
            <div className="w-full bg-white/20 rounded-[2.5rem] p-4 backdrop-blur-sm border border-white/50 shadow-sm">
                {/* Headers */}
                <div className="grid grid-cols-[1.2fr_1.8fr_1.2fr_1.2fr_1.2fr_1.5fr_0.8fr] items-center px-8 py-4 mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Case ID</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Candidate</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Package</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center">Status</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center">Risk level</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Due Date</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] text-right">Action</span>
                </div>

                {loading && cases.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-dashed border-slate-200 animate-pulse">
                        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/10 border-t-[#4F46E5] animate-spin mb-4"></div>
                        <p className="text-[10px] font-bold text-[#4F46E5] uppercase tracking-widest">Compiling BGV Records...</p>
                    </div>
                ) : cases.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-slate-100 shadow-sm text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-300 mb-6">
                            <Layers size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">No Cases Found</h3>
                        <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto">Start a background check to begin tracking.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {cases.map((caseItem, idx) => {
                            const statusColor = getStatusStyles(caseItem.overallStatus);
                            return (
                                <div
                                    key={caseItem._id}
                                    className="group grid grid-cols-[1.2fr_1.8fr_1.2fr_1.2fr_1.2fr_1.5fr_0.8fr] items-center p-5 bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 cursor-default"
                                >
                                    {/* Column 1: Case ID */}
                                    <div className="flex">
                                        <span className="text-[9px] font-mono font-bold text-[#4F46E5] bg-indigo-50/50 px-2.5 py-1 rounded-lg uppercase border border-indigo-100/50">
                                            {caseItem.caseId}
                                        </span>
                                    </div>

                                    {/* Column 2: Candidate Info */}
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-white font-bold text-xs ring-4 ring-white shadow-sm ${idx % 3 === 0 ? 'bg-gradient-to-br from-[#4F46E5] to-indigo-600' :
                                            idx % 3 === 1 ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                            }`}>
                                            {caseItem.candidateName?.charAt(0)}
                                        </div>
                                        <div className="min-w-0 pr-4">
                                            <div className="font-semibold text-slate-800 text-[13px] group-hover:text-[#4F46E5] transition-colors truncate">{caseItem.candidateName}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tight truncate">{caseItem.jobTitle}</div>
                                        </div>
                                    </div>

                                    {/* Column 3: Package */}
                                    <div>
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-bold rounded-full uppercase tracking-wider border ${getPackageBadge(caseItem.package)}`}>
                                            <Package size={10} />
                                            {caseItem.package}
                                        </span>
                                    </div>

                                    {/* Column 4: Status */}
                                    <div className="flex justify-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[9px] font-bold rounded-full uppercase tracking-wider border ${statusColor.bg} ${statusColor.color} ${statusColor.border}`}>
                                            <div className={`w-1 h-1 rounded-full animate-pulse ${statusColor.color === 'text-emerald-600' ? 'bg-emerald-500' : 'bg-current'}`}></div>
                                            {caseItem.overallStatus?.replace(/_/g, ' ')}
                                        </span>
                                    </div>

                                    {/* Column 5: Risk Level */}
                                    <div className="flex justify-center">
                                        {caseItem.riskScore ? (
                                            <div className="flex flex-col items-center">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-tight ${caseItem.riskScore.riskLevel === 'CLEAR' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                                    caseItem.riskScore.riskLevel === 'LOW_RISK' ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                                                        caseItem.riskScore.riskLevel === 'MODERATE_RISK' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                            'bg-rose-50 text-rose-600 border border-rose-100'
                                                    }`}>
                                                    {caseItem.riskScore.riskLevel?.replace(/_/g, ' ')}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-400 mt-1">{caseItem.riskScore.totalRiskScore} PTS</span>
                                            </div>
                                        ) : (
                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic font-medium">Pending Audit</span>
                                        )}
                                    </div>

                                    {/* Column 6: SLA & Date */}
                                    <div>
                                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                                            <Calendar size={12} className="text-slate-300" />
                                            {dayjs(caseItem.initiatedAt).format('MMM DD, YYYY')}
                                        </div>
                                        {caseItem.sla && (
                                            <div className={`text-[9px] font-bold uppercase tracking-widest mt-1 flex items-center gap-1 ${caseItem.sla.isOverdue ? 'text-rose-500' : 'text-slate-300'}`}>
                                                {caseItem.sla.isOverdue ? <AlertTriangle size={8} /> : null}
                                                {caseItem.sla.isOverdue ? 'Overdue' : `due ${dayjs(caseItem.sla.dueDate).fromNow()}`}
                                            </div>
                                        )}
                                    </div>

                                    {/* Column 7: Actions */}
                                    <div className="flex justify-end items-center gap-2">
                                        <button
                                            onClick={() => handleViewDetails(caseItem)}
                                            className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-[#4F46E5] transition-all border border-slate-100 hover:border-indigo-200"
                                            title="View Case Details"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        {canDelete && (
                                            <button
                                                className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all border border-slate-100 hover:border-rose-200"
                                                title="Cancel Case"
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Pagination Bar */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-between px-8 py-6 bg-white/50 rounded-[2rem] border border-white mt-4">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    showing page <span className="text-[#4F46E5]">{page}</span> of {totalPages}
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="h-8 px-4 bg-white border border-slate-200 rounded-lg font-bold text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        Prev
                                    </button>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="h-8 px-4 bg-white border border-slate-200 rounded-lg font-bold text-[10px] uppercase tracking-widest text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modals - Unchanged logic */}
            {showInitiateModal && (
                <InitiateBGVModal
                    onClose={() => setShowInitiateModal(false)}
                    onSuccess={() => {
                        setShowInitiateModal(false);
                        fetchCases();
                        fetchStats();
                    }}
                />
            )}

            {showDetailModal && selectedCase && (
                <BGVDetailModal
                    caseData={selectedCase}
                    onClose={() => {
                        setShowDetailModal(false);
                        setSelectedCase(null);
                    }}
                    onUpdate={() => {
                        fetchCases();
                        fetchStats();
                    }}
                />
            )}
        </div>
    );
};

// Statistics Card Component
const StatCard = ({ title, value, icon, color, trend, onClick, urgent }) => {
    const colorStyles = {
        indigo: 'bg-indigo-50 text-[#4F46E5] border-indigo-100 hover:border-indigo-200',
        amber: 'bg-amber-50 text-amber-500 border-amber-100 hover:border-amber-200',
        rose: 'bg-rose-50 text-rose-500 border-rose-100 hover:border-rose-200',
        orange: 'bg-orange-50 text-orange-500 border-orange-100 hover:border-orange-200',
        slate: 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200'
    };

    return (
        <div
            onClick={onClick}
            className={`bg-white p-5 rounded-3xl border border-slate-200/60 shadow-sm flex items-center gap-4 group transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} ${colorStyles[color]} ${urgent ? 'ring-2 ring-rose-500 ring-offset-2' : ''}`}
        >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${color === 'indigo' ? 'bg-indigo-50 text-[#4F46E5]' : 'bg-slate-50 text-slate-400 group-hover:bg-opacity-80'}`}>
                {icon}
            </div>
            <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{title}</span>
                <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-slate-900 leading-none">{value}</span>
                    {trend && <span className="text-[9px] font-bold text-emerald-500">{trend}</span>}
                </div>
            </div>
        </div>
    );
};

// Risk Card Component
const RiskCard = ({ level, count, color, icon, label }) => {
    const colorStyles = {
        emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        blue: 'text-blue-600 bg-blue-50 border-blue-100',
        amber: 'text-amber-600 bg-amber-50 border-amber-100',
        orange: 'text-orange-600 bg-orange-50 border-orange-100',
        rose: 'text-rose-600 bg-rose-50 border-rose-100'
    };

    return (
        <div className={`rounded-3xl border-2 p-5 transition-all hover:scale-[1.02] cursor-default ${colorStyles[color]}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-white shadow-sm">
                    {icon}
                </div>
                <div className="text-3xl font-bold">{count}</div>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider">{level}</div>
            <div className="text-[8px] font-bold opacity-60 uppercase tracking-widest mt-0.5">{label}</div>
        </div>
    );
};

export default BGVDashboard;
