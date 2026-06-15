import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, Navigate, useLocation } from 'react-router-dom';
import api from '../../utils/api';
import RequirementForm from '../../components/RequirementForm';
import { Plus, Layout, Settings2, Search, Table as TableIcon, LayoutGrid, ChevronRight, Briefcase, MapPin, Zap, Building2, Users, Eye, Edit3, CheckCircle, XCircle, X, Shield, ShieldCheck, Lock } from 'lucide-react';
import usePagePermissions from '../../hooks/usePagePermissions';

export default function RequirementPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { canView, canCreate, canEdit, canDelete, loading: permLoading } = usePagePermissions('hiring.jobList');

    const hrPrefix = location.pathname.startsWith('/tenant/') 
        ? '/tenant' 
        : (location.pathname.startsWith('/employee/') ? '/employee' : '/hr');

    function handleRoleClick(req) {
        if (!req._id) return;
        const isInternal = req.visibility === 'Internal' || req.isInternal === true;
        if (isInternal) {
            navigate(`${hrPrefix}/internal-applicants/job/${req._id}/candidates`);
        } else {
            navigate(`${hrPrefix}/job/${req._id}/candidates`);
        }
    }
    const [requirements, setRequirements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [openForm, setOpenForm] = useState(false);
    const [currentReq, setCurrentReq] = useState(null);
    const [openView, setOpenView] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

    const [pagination, setPagination] = useState({ page: 1, limit: 10, totalPages: 1, total: 0 });

    // Load List of Requirements
    async function loadRequirements(page = 1) {
        setLoading(true);
        try {
            const res = await api.get(`/requirements?page=${page}&limit=${pagination.limit}&search=${searchQuery}`);
            if (res.data.requirements) {
                setRequirements(res.data.requirements);
                setPagination(res.data.pagination);
            } else if (Array.isArray(res.data)) {
                setRequirements(res.data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadRequirements(pagination.page);
    }, [pagination.page, searchQuery]);

    async function toggleStatus(id, currentStatus) {
        const newStatus = currentStatus === 'Open' ? 'Closed' : 'Open';
        try {
            await api.patch(`/requirements/${id}/status`, { status: newStatus });
            loadRequirements(pagination.page);
        } catch (err) {
            console.error(err);
        }
    }

    function openNew() { navigate('/hr/create-requirement'); }
    function openFormBuilder() { navigate('/hr/apply-builder'); }

    function handleEdit(req) {
        setCurrentReq(req);
        setIsEditMode(true);
        setOpenForm(true);
    }

    function handleView(req) {
        setCurrentReq(req);
        setOpenView(true);
    }

    if (permLoading) return null;

    if (!canView) {
        return <Navigate to="/hr/dashboard" replace />;
    }

    return (
        <div className="pt-[10px] px-4 sm:px-6 lg:px-8 pb-4 sm:pb-6 lg:pb-8 w-full animate-in fade-in duration-700 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            <div className="sticky top-[-10px] z-30 -mx-8 px-8 pt-4 pb-4 bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm mb-6">
                {/* Header Section */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                            Job Openings
                        </h1>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-white dark:bg-slate-900 px-4 py-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex items-center gap-6 shadow-sm">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Active Positions</span>
                                <span className="text-xl font-bold text-slate-950 dark:text-white leading-none">{pagination.total}</span>
                            </div>
                            <div className="h-8 w-px bg-slate-100 dark:bg-slate-800"></div>
                                <div className="flex items-center gap-2">
                                    {canEdit && (
                                        <button
                                            onClick={openFormBuilder}
                                            className="h-9 px-4 bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200/50 dark:border-slate-700/50 group"
                                        >
                                            <Settings2 size={14} className="group-hover:rotate-45 transition-transform" />
                                        </button>
                                    )}
                                    {canCreate && (
                                        <button
                                            onClick={openNew}
                                            className="h-9 px-5 bg-[#1e293b] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-[#0ea5e9] transition-all shadow-sm flex items-center gap-2"
                                        >
                                            <Plus size={16} strokeWidth={3} /> Launch New
                                        </button>
                                    )}
                                </div>
                        </div>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-2 md:gap-3">
                    <div className="relative flex-1 max-w-md group w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-[#1e293b] transition-colors pointer-events-none" size={16} />
                        <input
                            type="text"
                            placeholder="Search positions, IDs or departments..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-9 pl-9 pr-3 bg-white dark:bg-slate-800/50 border border-slate-200/50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-semibold text-xs text-slate-700 dark:text-slate-200"
                        />
                    </div>

                    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg self-end md:self-auto shrink-0 border border-slate-100">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white dark:bg-slate-700 text-[#1e293b] dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            <TableIcon size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-700 text-[#1e293b] dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                        >
                            <LayoutGrid size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                {loading ? (
                    <div className="col-span-full p-24 flex flex-col items-center justify-center gap-4 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/50 dark:border-slate-800 shadow-sm">
                        <div className="h-12 w-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
                        <div className="text-center">
                            <p className="text-slate-900 dark:text-white font-bold text-[10px] uppercase tracking-widest">Syncing Records</p>
                        </div>
                    </div>
                ) : requirements.length === 0 ? (
                    <div className="col-span-full p-24 text-center bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200/50 dark:border-slate-800 shadow-sm flex flex-col items-center">
                        <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/10 rounded-[2rem] flex items-center justify-center mb-6 text-[#1e293b] dark:text-indigo-400">
                            <Briefcase size={32} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">No active recruitments</h3>
                        <p className="text-slate-500 dark:text-slate-400 font-bold text-sm max-w-sm mx-auto mb-8">
                            Your hiring pipeline is currently empty. Trigger a new recruitment to get started.
                        </p>
                        {canCreate && (
                            <button
                                onClick={openNew}
                                className="bg-[#1e293b] text-white px-8 py-3 rounded-xl font-bold text-[11px] uppercase tracking-widest hover:bg-[#0ea5e9] transition-all shadow-lg shadow-indigo-500/10"
                            >
                                Launch New Channel
                            </button>
                        )}
                    </div>
                ) : viewMode === 'table' ? (
                    <div className="space-y-3">
                        {/* Table Column Labels */}
                        <div className="px-6 py-2 grid grid-cols-12 gap-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">
                            <div className="col-span-2">REF NO</div>
                            <div className="col-span-4">ROLES</div>
                            <div className="col-span-2">VACANCY</div>
                            <div className="col-span-2">STATUS</div>
                            <div className="col-span-2">ACTION</div>
                        </div>

                        {/* Row Cards */}
                        {requirements.map((req, idx) => (
                            <div 
                                key={req._id?.toString() || req.id || `req-${idx}`} 
                                onClick={() => handleRoleClick(req)}
                                className="grid grid-cols-12 gap-4 items-center px-6 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 shadow-sm hover:border-indigo-600/30 hover:shadow-md hover:cursor-pointer transition-all group"
                            >
                                <div className="col-span-2 flex justify-center">
                                    <span className="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-lg text-[10px] font-mono font-bold border border-slate-200 dark:border-slate-700 transition-colors">
                                        {req.jobOpeningId || 'DRAFT'}
                                    </span>
                                </div>

                                <div className="col-span-4 flex items-center justify-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 flex items-center justify-center text-[#1e293b] dark:text-indigo-400 group-hover:scale-110 transition-transform">
                                        <Building2 size={20} strokeWidth={2.5} />
                                    </div>
                                    <div className="flex flex-col items-center min-w-0">
                                        <span 
                                            onClick={() => handleRoleClick(req)}
                                            className="text-sm font-bold text-slate-800 dark:text-white truncate hover:text-[#0ea5e9] dark:hover:text-[#0ea5e9] hover:underline cursor-pointer transition-colors text-center"
                                        >
                                            {(req.jobTitle || req.title)?.toString() || 'Untitled Role'}
                                        </span>
                                    </div>
                                </div>

                                <div className="col-span-2 flex flex-col items-center">
                                    <div className="flex items-center gap-2">
                                        <Users size={14} className="text-indigo-400" />
                                        <span className="text-sm font-bold text-slate-800 dark:text-white">{req.vacancy}</span>
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">SLOTS</span>
                                </div>

                                <div className="col-span-2 flex justify-center">
                                    <span className={`inline-flex items-center px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider border ${req.status === 'Open'
                                        ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/30'
                                        : 'bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/30'
                                        }`}>
                                        <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${req.status === 'Open' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
                                        {req.status}
                                    </span>
                                </div>

                                <div className="col-span-2 flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                    <button onClick={() => handleView(req)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-[#1e293b] transition-all">
                                        <Eye size={18} />
                                    </button>
                                    {canEdit && (
                                        <button onClick={() => toggleStatus(req._id, req.status)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${req.status === 'Open' ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                            }`}>
                                            {req.status === 'Open' ? <CheckCircle size={18} /> : <XCircle size={18} />}
                                        </button>
                                    )}
                                    {canEdit && (
                                        <button onClick={() => handleEdit(req)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/10 text-[#1e293b] dark:text-indigo-400 hover:bg-[#1e293b] hover:text-white transition-all">
                                            <Edit3 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    requirements.map((req, idx) => (
                        <div 
                            key={req._id?.toString() || req.id || `req-card-${idx}`} 
                            onClick={() => handleRoleClick(req)}
                            className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200/50 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-1 hover:cursor-pointer transition-all group relative overflow-hidden"
                        >
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-6">
                                    <span className="px-2.5 py-1 bg-[#1e293b] text-white rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest">
                                        {req.jobOpeningId || 'NEW'}
                                    </span>
                                    <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase tracking-wider border ${req.status === 'Open'
                                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                        : 'bg-rose-50 text-rose-600 border-rose-100'
                                        }`}>
                                        {req.status}
                                    </span>
                                </div>

                                <div className="mb-6">
                                    <h3 
                                        onClick={() => handleRoleClick(req)}
                                        className="text-xl font-bold text-slate-900 dark:text-white leading-tight mb-2 hover:text-[#0ea5e9] dark:hover:text-[#0ea5e9] hover:underline cursor-pointer transition-colors"
                                    >
                                        {req.jobTitle || req.title}
                                    </h3>
                                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 font-bold text-[10px] uppercase tracking-widest">
                                        <Building2 size={14} /> {req.department}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 mb-6">
                                    <div className="bg-white dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">INTAKE</span>
                                        <div className="flex items-center gap-2">
                                            <Users size={14} className="text-[#1e293b]" />
                                            <span className="text-sm font-bold text-slate-800 dark:text-white">{req.vacancy} Slots</span>
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block mb-1">LOCATION</span>
                                        <div className="flex items-center gap-2 truncate">
                                            <MapPin size={14} className="text-[#1e293b]" />
                                            <span className="text-sm font-bold text-slate-800 dark:text-white truncate">{req.workMode}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        onClick={() => handleView(req)}
                                        className="flex-1 h-10 bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-[10px] uppercase tracking-widest border border-slate-200 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                    >
                                        <Eye size={16} /> View
                                    </button>
                                    {canEdit && (
                                        <button
                                            onClick={() => handleEdit(req)}
                                            className="flex-1 h-10 bg-[#1e293b] text-white rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-[#0ea5e9] transition-all flex items-center justify-center gap-2 shadow-sm"
                                        >
                                            <Edit3 size={16} /> Config
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
                <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Showing <span className="text-slate-900 dark:text-white font-bold">{(pagination.page - 1) * pagination.limit + 1}–{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="text-[#1e293b] font-bold">{pagination.total}</span> Positions
                    </p>

                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                            disabled={pagination.page === 1}
                            className="h-9 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:bg-[#1e293b] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            ‹ Prev
                        </button>

                        <div className="flex gap-1">
                            {[...Array(pagination.totalPages)].map((_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => setPagination(prev => ({ ...prev, page: i + 1 }))}
                                    className={`h-9 w-9 rounded-xl font-bold text-[10px] transition-all ${pagination.page === i + 1 ? 'bg-[#1e293b] text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.totalPages, prev.page + 1) }))}
                            disabled={pagination.page === pagination.totalPages}
                            className="h-9 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:bg-[#1e293b] hover:text-white transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Next ›
                        </button>
                    </div>
                </div>
            )}

            {openForm && createPortal(
                <RequirementForm
                    initialData={currentReq}
                    isEdit={isEditMode}
                    isModal={true}
                    onClose={() => setOpenForm(false)}
                    onSuccess={() => loadRequirements(1)} // Reset to page 1 on new creation
                />,
                document.body
            )}

            {openView && currentReq && createPortal(
                <ViewRequirementModal
                    req={currentReq}
                    onClose={() => { setOpenView(false); setCurrentReq(null); }}
                />,
                document.body
            )}
        </div>
    );
}

function ViewRequirementModal({ req, onClose }) {
    useEffect(() => {
        if (!req) return undefined;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [req]);

    if (!req) return null;

    const jd = req.jobDetails || {};
    const jdesc = req.jobDescription || {};
    const workMode = jd.workMode ?? req.workMode ?? '—';
    const jobType = jd.jobType ?? req.jobType ?? '—';
    const priority = jd.priority ?? req.priority ?? '—';
    const salaryMin = jd.salaryMin ?? req.salaryMin;
    const salaryMax = jd.salaryMax ?? req.salaryMax;
    const roleOverview = (jdesc.roleOverview ?? req.description ?? '').trim();
    const expMin = jd.experienceMin ?? req.experienceMin;
    const expMax = jd.experienceMax ?? req.experienceMax;
    let experienceLabel = 'Fresher / Entry';
    if (req.minExperienceMonths) {
        experienceLabel = `${Math.floor(req.minExperienceMonths / 12)}Y ${req.minExperienceMonths % 12}M+`;
    } else if (expMin != null || expMax != null) {
        experienceLabel = `${expMin ?? '—'}${expMax != null ? `–${expMax}` : ''} Yrs`;
    }

    const sections = [
        { label: 'Role Context', icon: Briefcase, value: req.jobTitle, sub: req.department },
        { label: 'Deployment', icon: MapPin, value: workMode, sub: jobType },
        { label: 'Capacity', icon: Users, value: `${req.vacancy} Position(s)`, sub: `Priority: ${priority}` },
    ];

    const isLikelyObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || '').trim());

    const getAssigneeNames = (stage) => {
        const assignees = [
            ...(Array.isArray(stage?.assignedInterviewers) ? stage.assignedInterviewers : []),
            stage?.assignedInterviewer,
        ].filter(Boolean);
        const names = assignees
            .map((person) => {
                if (typeof person === 'string') {
                    const label = person.trim();
                    return isLikelyObjectId(label) ? '' : label;
                }
                return (
                    person?.name ||
                    person?.fullName ||
                    person?.employeeName ||
                    [person?.firstName, person?.lastName].filter(Boolean).join(' ') ||
                    person?.email ||
                    person?.employeeId ||
                    ''
                );
            })
            .map((name) => String(name || '').trim())
            .filter(Boolean);
        return [...new Set(names)];
    };

    const pipelineDisplayStages = req.pipelineStages && req.pipelineStages.length > 0
        ? [
            { stageName: 'Applied', assignees: [] },
            ...req.pipelineStages.map((stage) => ({
                stageName: stage?.stageName || 'Stage',
                assignees: getAssigneeNames(stage),
            })),
            { stageName: 'Finalized', assignees: [] },
            { stageName: 'Rejected', assignees: [] },
        ]
        : (req.workflow || ['Applied', 'Shortlisted', 'Interview', 'Finalized']).map((stageName) => ({
            stageName,
            assignees: [],
        }));

    return (
        <div
            className="fixed top-14 sm:top-20 left-0 right-0 bottom-0 z-[55] lg:left-[88px] box-border p-[15px] flex flex-col animate-in fade-in duration-300 bg-slate-100 dark:bg-[#0F172A] pointer-events-auto"
            aria-modal="true"
            role="dialog"
        >
            <div className="flex flex-col min-h-0 flex-1 w-full max-w-none rounded-none border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-lg overflow-hidden">
                {/* Header — compact */}
                <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0 flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-slate-800 rounded-none flex items-center justify-center text-white shadow-md shrink-0">
                            <Briefcase size={22} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight truncate">{req.jobTitle}</h2>
                                <span className="text-[9px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-none border border-slate-200 dark:border-slate-700 uppercase tracking-widest shrink-0">
                                    REF: {req.jobOpeningId || 'DRAFT'}
                                </span>
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-widest flex items-center gap-1.5">
                                <Building2 size={12} className="text-indigo-400 shrink-0" /> {req.department}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-slate-900 rounded-none border border-slate-200 dark:border-slate-800 transition-colors active:scale-95 shrink-0" aria-label="Close">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 sm:py-4 space-y-4">
                    {/* Stats — compact grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {sections.map((sec, i) => (
                            <div key={i} className="bg-white dark:bg-slate-900/40 p-3 rounded-none border border-slate-100 dark:border-slate-800">
                                <div className="w-8 h-8 bg-white dark:bg-slate-800 rounded-none flex items-center justify-center mb-2 shadow-sm text-indigo-900">
                                    <sec.icon size={16} />
                                </div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{sec.label}</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight mb-0.5 truncate">{sec.value}</p>
                                <p className="text-[10px] font-bold text-indigo-900 truncate">{sec.sub}</p>
                            </div>
                        ))}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-4 bg-slate-800 rounded-full shrink-0" />
                            <h3 className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-widest">Job Mission & Scope</h3>
                        </div>
                        <div className="bg-white dark:bg-slate-900/50 p-3 rounded-none border border-slate-100 dark:border-slate-800 text-xs leading-snug text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-[28vh] overflow-y-auto">
                            {roleOverview || 'No detailed description provided for this role.'}
                        </div>
                    </div>

                    {/* Pipeline — compact row */}
                    {(req.pipelineStages || req.workflow) && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-1 h-4 bg-slate-800 rounded-full shrink-0" />
                                <h3 className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-widest">Acquisition Pipeline</h3>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                                {pipelineDisplayStages.map((stage, i, arr) => (
                                        <React.Fragment key={i}>
                                            <div className={`px-2.5 py-1 rounded-none font-bold text-[9px] uppercase tracking-wide border ${stage.stageName === 'Applied' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                stage.stageName === 'Finalized' ? 'bg-slate-900 text-white border-slate-900' :
                                                    stage.stageName === 'Rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                        'bg-white dark:bg-slate-900 text-indigo-900 border-indigo-100 dark:border-indigo-900 font-bold'
                                                }`}>
                                                {stage.stageName}
                                                {stage.assignees.length > 0 && (
                                                    <span className="mt-1 block normal-case tracking-normal text-[9px] font-semibold opacity-80">
                                                        {stage.assignees.join(', ')}
                                                    </span>
                                                )}
                                            </div>
                                            {i < arr.length - 1 && (
                                                <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 shrink-0" />
                                            )}
                                        </React.Fragment>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* Salary & experience — single compact row on md+ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div>
                            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Financial Bandwidth</h4>
                            <div className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                {salaryMin != null && salaryMax != null ? `₹${Number(salaryMin).toLocaleString()} - ₹${Number(salaryMax).toLocaleString()}` : 'Confidential'}
                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Annual CTC Range</span>
                            </div>
                        </div>
                        <div>
                            <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Experience Prerequisite</h4>
                            <div className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                {experienceLabel}
                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Industrial Exposure</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="px-4 py-3 sm:px-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 flex justify-end shrink-0">
                    <button type="button" onClick={onClose} className="px-5 py-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-none font-bold text-[10px] uppercase tracking-widest border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all active:scale-95">
                        Dismiss View
                    </button>
                </div>
            </div>
        </div>
    );
}
