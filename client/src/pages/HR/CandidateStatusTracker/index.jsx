import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../../utils/api';
import { Eye, Clock, User, Briefcase, Calendar, CheckCircle, XCircle, ChevronRight, RefreshCw, Database, Search, Filter, LayoutGrid, Target, Users, Landmark, Layers } from 'lucide-react';
import { getHiringRoute } from '../../../utils/navigation';
import dayjs from 'dayjs';

import usePagePermissions from '../../../hooks/usePagePermissions';

export default function CandidateStatusTracker() {
    const navigate = useNavigate();
    const location = useLocation();
    const { canView, canEdit } = usePagePermissions('hiring.tracker');
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const panelPrefix = location.pathname.startsWith('/tenant') ? '/tenant' : '/hr';

    const openCandidate = (candidate) => {
        const targetRoute = getHiringRoute(candidate, {
            panelPrefix,
            applicantsPath: `${panelPrefix}/applicants`
        });

        if (targetRoute.startsWith('/hiring/')) {
            navigate(targetRoute, {
                state: {
                    panelPrefix,
                    applicantsPath: `${panelPrefix}/applicants`
                }
            });
            return;
        }

        navigate(targetRoute);
    };

    const loadCandidates = async () => {
        setLoading(true);
        try {
            const res = await api.get('/hr/candidate-status');
            setCandidates(res.data || []);
        } catch (err) {
            console.error('[CANDIDATE_LOAD_ERR]', err);
        } finally {
            setLoading(false);
        }
    };

    const seedSampleData = async () => {
        if (!confirm('This will seed sample candidates. Continue?')) return;
        setLoading(true);
        try {
            await api.post('/hr/candidate-status/seed');
            await loadCandidates();
        } catch (err) {
            console.error('[SEED_ERR]', err);
            alert('Failed to seed sample data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCandidates();
    }, []);

    const getStatusBadge = (status) => {
        const config = {
            'Applied': { color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', icon: Clock },
            'Shortlisted': { color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100', icon: CheckCircle },
            'Interview Scheduled': { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', icon: Calendar },
            'Selected': { color: 'text-[#4F46E5]', bg: 'bg-indigo-50', border: 'border-indigo-100', icon: CheckCircle },
            'Rejected': { color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100', icon: XCircle },
        };
        const style = config[status] || { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100', icon: Clock };
        const Icon = style.icon;

        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${style.bg} ${style.color} ${style.border}`}>
                <div className={`w-1 h-1 rounded-full animate-pulse ${style.icon === CheckCircle && status === 'Selected' ? 'bg-[#4F46E5]' : 'bg-current'}`}></div>
                {status}
            </span>
        );
    };

    const getStageBadge = (stage) => {
        let label = stage;
        let styleKey = 'Default';

        if (stage === 'Applied' || stage === 'New') {
            label = 'APPLICATION';
            styleKey = 'Application';
        } else if (stage === 'Shortlisted' || stage === 'Interview Scheduled' || stage === 'HR' || stage === 'Technical') {
            label = 'INTERVIEW';
            styleKey = 'Interview';
        } else if (stage === 'Selected' || stage === 'Offer Sent' || stage === 'Hired') {
            label = 'FINAL';
            styleKey = 'Final';
        } else if (stage === 'Rejected') {
            label = 'CLOSED';
            styleKey = 'Closed';
        }

        const styles = {
            'Application': 'text-blue-600 bg-blue-50 ring-blue-100',
            'Interview': 'text-orange-600 bg-orange-50 ring-orange-100',
            'Final': 'text-purple-600 bg-purple-50 ring-purple-100',
            'Closed': 'text-slate-500 bg-slate-50 ring-slate-200',
            'Default': 'text-slate-600 bg-slate-50 ring-slate-100'
        };

        return (
            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ring-1 ring-inset whitespace-nowrap ${styles[styleKey]}`}>
                {label}
            </span>
        );
    };

    const filteredCandidates = candidates.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.requirementTitle.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-slate-100 shadow-sm text-center m-6">
                <XCircle size={48} className="text-rose-500 mb-6" />
                <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Access Denied</h3>
                <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto text-center">You do not have permission to view the Candidate Tracker.</p>
            </div>
        );
    }

    return (
        <div className="p-6 w-full animate-in fade-in duration-700 font-sans selection:bg-indigo-100 selection:text-indigo-600 bg-slate-50/30 min-h-screen">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                    { label: 'Total Tracked', count: candidates.length, key: 'slate', icon: User },
                    { label: 'In Interview', count: candidates.filter(c => c.currentStatus === 'Interview Scheduled').length, key: 'purple', icon: Calendar },
                    { label: 'Selected Candidates', count: candidates.filter(c => c.currentStatus === 'Selected').length, key: 'indigo', icon: CheckCircle },
                    { label: 'Rejected', count: candidates.filter(c => c.currentStatus === 'Rejected').length, key: 'rose', icon: XCircle },
                ].map((stat, i) => {
                    const styles = {
                        slate: {
                            bar: 'bg-slate-500',
                            iconBg: 'bg-slate-100 text-slate-700',
                            value: 'text-slate-900',
                            pill: 'bg-slate-50 text-slate-600 border border-slate-200/80',
                        },
                        purple: {
                            bar: 'bg-violet-500',
                            iconBg: 'bg-violet-50 text-violet-700',
                            value: 'text-violet-800',
                            pill: 'bg-violet-50 text-violet-700 border border-violet-100',
                        },
                        indigo: {
                            bar: 'bg-indigo-500',
                            iconBg: 'bg-indigo-50 text-indigo-700',
                            value: 'text-indigo-800',
                            pill: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
                        },
                        rose: {
                            bar: 'bg-rose-500',
                            iconBg: 'bg-rose-50 text-rose-600',
                            value: 'text-rose-700',
                            pill: 'bg-rose-50 text-rose-600 border border-rose-100',
                        },
                    }[stat.key];
                    const total = candidates.length || 1;
                    const pct = stat.count > 0 ? Math.round((stat.count / total) * 100) : null;
                    return (
                        <div
                            key={i}
                            className="relative flex w-full items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 hover:border-slate-300 hover:shadow-md"
                        >
                            <div className={`w-1 shrink-0 ${styles.bar}`} aria-hidden />
                            <div className="flex min-w-0 flex-1 items-center justify-between gap-4 p-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${styles.iconBg}`}>
                                        <stat.icon size={20} strokeWidth={2} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                            {stat.label}
                                        </p>
                                        <p className={`mt-0.5 text-2xl font-semibold tabular-nums tracking-tight ${styles.value}`}>
                                            {stat.count}
                                        </p>
                                    </div>
                                </div>
                                {pct !== null && (
                                    <div className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold tabular-nums ${styles.pill}`} title="Share of tracked candidates">
                                        {pct}%
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Search left; Seed + Refresh + Total + Filter grouped on the right */}
            <div className="mb-6 flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative group w-full max-w-md shrink-0">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-slate-300 transition-colors group-focus-within:text-[#4F46E5] pointer-events-none">
                        <Search size={16} />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by candidate or job role..."
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-11 text-sm font-medium shadow-sm transition-all outline-none placeholder:text-slate-400 focus:border-[#4F46E5] focus:ring-4 focus:ring-indigo-500/5"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3 lg:justify-end shrink-0">
                    {canEdit && (
                        <button
                            type="button"
                            onClick={seedSampleData}
                            className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold tracking-widest text-slate-600 uppercase shadow-sm transition-all hover:bg-slate-50 sm:px-5 sm:text-[11px]"
                        >
                            <Database size={16} strokeWidth={2.5} className="shrink-0 text-slate-400" />
                            Seed Data
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={loadCandidates}
                        title="Refresh list"
                        aria-label="Refresh list"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-[#4F46E5] active:scale-95 disabled:opacity-50"
                        disabled={loading}
                    >
                        <RefreshCw size={18} strokeWidth={2.25} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-bold tracking-widest text-slate-500 uppercase shadow-sm">
                        Total Records: <span className="ml-1 font-bold text-slate-900">{filteredCandidates.length}</span>
                    </div>
                    <button
                        type="button"
                        className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-400 shadow-sm transition-all hover:bg-indigo-50 hover:text-[#4F46E5]"
                        aria-label="Filter"
                    >
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            {/* List Container */}
            <div className="w-full bg-white/20 rounded-[1.5rem] p-2 backdrop-blur-sm border border-white/50 shadow-sm">
                {/* Spaced Headers */}
                <div className="grid grid-cols-[2fr_1.5fr_1.2fr_1.2fr_1.2fr_0.8fr] items-center px-6 py-2 mb-1">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Candidate</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Role Applied</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center">Status</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center">Stage</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em]">Applied On</span>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] text-center">Timeline</span>
                </div>

                {loading && candidates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-dashed border-slate-200 animate-pulse">
                        <div className="w-12 h-12 rounded-full border-4 border-indigo-500/10 border-t-[#4F46E5] animate-spin mb-4"></div>
                        <p className="text-[10px] font-bold text-[#4F46E5] uppercase tracking-widest">Syncing Records...</p>
                    </div>
                ) : filteredCandidates.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-24 bg-white rounded-[3rem] border border-slate-100 shadow-sm text-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center text-slate-300 mb-6">
                            <Layers size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">No candidates found</h3>
                        <p className="text-slate-400 font-medium text-sm max-w-xs mx-auto">Try adjusting your search filters to find what you're looking for.</p>
                    </div>
                ) : (
                    <div className="space-y-1.5">
                        {filteredCandidates.map((candidate, idx) => (
                            <div
                                key={candidate._id}
                                onClick={() => openCandidate(candidate)}
                                className="group grid grid-cols-[2fr_1.5fr_1.2fr_1.2fr_1.2fr_0.8fr] items-center p-2.5 bg-white rounded-[1.2rem] border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all duration-300 cursor-pointer"
                            >
                                {/* Candidate Info */}
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center text-white font-bold text-xs shadow-sm ring-2 ring-white transition-transform group-hover:scale-105 ${idx % 3 === 0 ? 'bg-gradient-to-br from-[#4F46E5] to-indigo-600' :
                                        idx % 3 === 1 ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                                        }`}>
                                        {candidate.name.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-slate-800 text-[12px] group-hover:text-[#4F46E5] transition-colors truncate pr-4" title={candidate.name}>
                                            {candidate.name}
                                        </div>
                                        <div className="text-[9px] text-slate-400 mt-0.5 font-bold uppercase tracking-tight truncate pr-4" title={candidate.email}>
                                            {candidate.email}
                                        </div>
                                    </div>
                                </div>

                                {/* Role Applied */}
                                <div>
                                    <div 
                                        className="flex items-center gap-2 cursor-pointer group/role"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const reqId = candidate.requirementId || candidate.requirement;
                                            if (reqId) {
                                                navigate(`${panelPrefix}/job/${reqId}/candidates`);
                                            } else {
                                                navigate(`${panelPrefix}/requirements`);
                                            }
                                        }}
                                        title="View all candidates for this role"
                                    >
                                        <div className="p-1 rounded-lg bg-slate-50 text-slate-400 group-hover/role:bg-indigo-50 group-hover/role:text-[#4F46E5] transition-all">
                                            <Briefcase size={10} />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-tight group-hover/role:text-[#4F46E5] group-hover/role:underline">{candidate.requirementTitle}</span>
                                    </div>
                                </div>

                                {/* Status */}
                                <div className="flex justify-center scale-90">
                                    {getStatusBadge(candidate.currentStatus)}
                                </div>

                                {/* Stage */}
                                <div className="flex justify-center scale-90">
                                    {getStageBadge(candidate.currentStage)}
                                </div>

                                {/* Applied On */}
                                <div>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                                            <Calendar size={10} className="text-slate-300" />
                                            {dayjs(candidate.createdAt).format('MMM DD, YYYY')}
                                        </div>
                                        <span className="text-[7px] font-black text-slate-300 uppercase tracking-[0.2em] mt-0.5 ml-4">Registration Date</span>
                                    </div>
                                </div>

                                <div className="flex justify-center">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`${panelPrefix}/candidate-status/${candidate._id}`);
                                        }}
                                        title="View Candidate Timeline"
                                        className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-[#4F46E5] transition-all border border-slate-100 hover:border-indigo-200"
                                    >
                                        <Eye size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
