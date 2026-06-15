import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getTenantId } from '../../utils/auth';
import { useJobPortalAuth } from '../../context/JobPortalAuthContext';
import {
    Briefcase, MapPin, Clock, Search, Filter,
    ArrowRight, Star, AlertCircle, Building2, Globe,
    X, Users, DollarSign, GraduationCap, CheckCircle,
    Layers, Zap, Eye, Calendar, Award, ChevronRight,
    ChevronLeft, Network
} from 'lucide-react';

export default function CandidateOpenPositions() {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState(null);
    const { candidate } = useJobPortalAuth();
    const [tenantId, setTenantIdState] = useState(getTenantId() || candidate?.tenantId);

    const inputRef = useRef(null);
    const [isFocused, setIsFocused] = useState(false);

    // Keyboard shortcut to focus search input (press '/' or 'Ctrl/Cmd + K')
    useEffect(() => {
        const handleKeyDown = (e) => {
            const active = document.activeElement;
            const isTyping = active && (
                active.tagName === 'INPUT' || 
                active.tagName === 'TEXTAREA' || 
                active.isContentEditable
            );
            
            if (!isTyping) {
                if (e.key === '/') {
                    e.preventDefault();
                    inputRef.current?.focus();
                }
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key?.toLowerCase() === 'k') {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Detail modal state
    const [detailModal, setDetailModal] = useState(false);
    const [detailJob, setDetailJob] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const jobsPerPage = 5;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    useEffect(() => {
        if (detailModal) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
            document.documentElement.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
            document.documentElement.style.overflow = 'unset';
        };
    }, [detailModal]);

    useEffect(() => {
        const fetchJobs = async () => {
            const companyCode = (localStorage.getItem('companyCode') || '').trim();
            const tid = tenantId || getTenantId() || candidate?.tenantId || candidate?.companyCode || companyCode;
            console.log('🔍 [CANDIDATE_OPEN_POSITIONS] Fetching jobs for tenant:', tid);

            if (!tid) {
                console.warn('⚠️ [CANDIDATE_OPEN_POSITIONS] No tenantId found');
                setLoading(false);
                return;
            }

            try {
                const res = await api.get(`/public/jobs?tenantId=${encodeURIComponent(String(tid))}`);
                let jobList = [];
                if (Array.isArray(res.data)) {
                    jobList = res.data;
                } else if (res.data?.success && res.data?.data?.jobs) {
                    jobList = res.data.data.jobs;
                } else if (res.data?.jobs) {
                    jobList = res.data.jobs;
                }

                console.log(`✅ [CANDIDATE_OPEN_POSITIONS] Found ${jobList.length} jobs`);
                setJobs(jobList);
            } catch (err) {
                console.error("Failed to fetch jobs:", err);
                setError("Failed to load positions. Please try refreshing.");
            } finally {
                setLoading(false);
            }
        };
        fetchJobs();
    }, [tenantId, candidate]);

    const handleViewDetail = async (job) => {
        setDetailModal(true);
        setDetailJob(null);
        setDetailLoading(true);
        try {
            const tid = tenantId || getTenantId();
            const res = await api.get(`/public/job/${job._id}?tenantId=${encodeURIComponent(String(tid))}`);
            setDetailJob(res.data || job);
        } catch (err) {
            console.error('Failed to fetch job detail:', err);
            setDetailJob(job); // fallback to list data
        } finally {
            setDetailLoading(false);
        }
    };

    // Safely convert a skill/responsibility item to string (handles objects like {name, weight, _id})
    const toStr = (item) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        if (typeof item === 'object') return item.name || item.label || item.value || item.skill || JSON.stringify(item);
        return String(item);
    };

    const closeDetail = () => {
        setDetailModal(false);
        setDetailJob(null);
    };

    const filteredJobs = Array.isArray(jobs) ? jobs.filter(job =>
        job?.jobTitle?.toLowerCase()?.includes(searchTerm.toLowerCase()) ||
        job?.department?.toLowerCase()?.includes(searchTerm.toLowerCase())
    ) : [];

    const indexOfLastJob = currentPage * jobsPerPage;
    const indexOfFirstJob = indexOfLastJob - jobsPerPage;
    const currentJobs = filteredJobs.slice(indexOfFirstJob, indexOfLastJob);
    const totalPages = Math.ceil(filteredJobs.length / jobsPerPage);

    if (loading) return (
        <div className="h-[60vh] flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Scanning Positions...</p>
            </div>
        </div>
    );

    if (error) {
        return (
            <div className="bg-white p-10 rounded-[2rem] border border-rose-100 text-center shadow-sm">
                <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-rose-50 flex items-center justify-center">
                    <AlertCircle className="text-rose-600" />
                </div>
                <div className="text-slate-900 font-bold">Unable to load positions</div>
                <div className="mt-1 text-slate-500 text-sm font-medium">{error}</div>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-blue-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header / Search */}
            <div className="relative overflow-hidden py-4">
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-6">
                    <div className="max-w-xl">
                        <div className="inline-flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg mb-4">
                            <Globe size={12} className="text-blue-600" />
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Active Opportunities</span>
                        </div>
                    </div>
                    <div className="relative w-full lg:w-[420px]">
                        <div className={`
                            relative flex items-center w-full transition-all duration-300 rounded-[1.25rem] border
                            ${isFocused 
                                ? 'bg-white border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.12)] ring-4 ring-blue-500/10' 
                                : 'bg-slate-50/80 border-slate-100 hover:border-slate-300 hover:bg-slate-100/50 shadow-[0_2px_8px_rgba(0,0,0,0.01)]'
                            }
                        `}>
                            {/* Search Icon */}
                            <Search 
                                className={`absolute left-4 w-4 h-4 transition-colors duration-300 pointer-events-none ${
                                    isFocused ? 'text-blue-600' : 'text-slate-400'
                                }`} 
                            />
                            
                            {/* Input Field */}
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Search by title, category..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                className="w-full bg-transparent pl-11 pr-24 py-3 text-sm font-bold text-slate-800 outline-none border-none focus:ring-0 placeholder:text-slate-400 placeholder:font-semibold"
                            />
                            
                            {/* Actions Right (Match Count, Clear, Shortcut) */}
                            <div className="absolute right-3.5 flex items-center gap-2">
                                {searchTerm && (
                                    <span className="hidden sm:inline-flex text-[9px] font-black uppercase tracking-wider px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md border border-blue-100">
                                        {filteredJobs.length} {filteredJobs.length === 1 ? 'Job' : 'Jobs'}
                                    </span>
                                )}
                                
                                {searchTerm ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSearchTerm('');
                                            inputRef.current?.focus();
                                        }}
                                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors"
                                        title="Clear search"
                                    >
                                        <X size={14} className="stroke-[2.5]" />
                                    </button>
                                ) : (
                                    <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded-md shadow-sm pointer-events-none select-none">
                                        <span className="text-[9px]">/</span>
                                    </kbd>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* List */}
            {filteredJobs.length === 0 ? (
                <div className="bg-white p-12 rounded-[2rem] border border-gray-100 text-center shadow-sm">
                    <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <Search size={26} className="text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No matching positions</h3>
                    <p className="text-slate-400 font-medium max-w-xs mx-auto">Try adjusting your filters or search terms to find what you're looking for.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {currentJobs.map((job) => (
                        <div
                            key={job._id}
                            onClick={() => handleViewDetail(job)}
                            className="group bg-white p-8 sm:p-10 rounded-[1.25rem] border border-slate-100 shadow-[0px_4px_16px_rgba(0,0,0,0.02)] hover:shadow-[0px_12px_28px_rgba(0,0,0,0.05)] hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                        >
                            <div>
                                <h3 className="text-2xl sm:text-[1.75rem] font-bold text-slate-800 tracking-tight mb-3 group-hover:text-blue-600 transition-colors">
                                    {job?.jobTitle}
                                </h3>
                                <p className="text-slate-500 text-sm leading-relaxed mb-6 font-normal line-clamp-3">
                                    {job?.jobDescription?.roleOverview || job?.description || `We are looking for a talented ${job?.jobTitle} to join our growing team.`}
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 text-slate-500 text-sm font-medium pt-1">
                                {job?.location && (
                                    <div className="flex items-center gap-2.5">
                                        <MapPin size={16} className="text-slate-400" />
                                        <span className="text-slate-600">{job.location}</span>
                                    </div>
                                )}
                                {job?.department && (
                                    <div className="flex items-center gap-2.5">
                                        <Network size={16} className="text-slate-400" />
                                        <span className="text-slate-600">{job.department}</span>
                                    </div>
                                )}
                                {(job?.jobType || job?.type || job?.employmentType) && (
                                    <div className="flex items-center gap-2.5">
                                        <Briefcase size={16} className="text-slate-400" />
                                        <span className="text-slate-600">{job?.jobType || job?.type || job?.employmentType}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-8 pt-4">
                            <button
                                onClick={(e) => { e.stopPropagation(); setCurrentPage((prev) => Math.max(prev - 1, 1)); }}
                                disabled={currentPage === 1}
                                className="h-10 w-10 rounded-full flex items-center justify-center border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    onClick={(e) => { e.stopPropagation(); setCurrentPage(page); }}
                                    className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                                        currentPage === page
                                            ? 'bg-[#51435E] text-white'
                                            : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                onClick={(e) => { e.stopPropagation(); setCurrentPage((prev) => Math.min(prev + 1, totalPages)); }}
                                disabled={currentPage === totalPages}
                                className="h-10 w-10 rounded-full flex items-center justify-center border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Job Detail Modal ── */}
            {detailModal && createPortal(
                <div className="fixed inset-0 z-[999] flex items-start justify-center pt-[36px] sm:pt-[44px] px-4 pb-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
                    <div
                        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-[96vw] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
                        style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                    {/* ── Top Header Bar ── */}
                    <div className="flex items-center justify-between px-8 py-4 border-b border-slate-100 bg-white shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                                <Building2 size={20} />
                            </div>
                            <div>
                                {detailLoading
                                    ? <div className="h-5 w-44 bg-slate-100 rounded-lg animate-pulse" />
                                    : <h2 className="text-xl font-black text-slate-900 leading-tight">{detailJob?.jobTitle || '—'}</h2>
                                }
                                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400 mt-0.5">
                                    {detailJob?.department || '—'}
                                </p>
                            </div>
                        </div>

                        {/* Pills + Close */}
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                            {detailJob?.location && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-600">
                                    <MapPin size={11} className="text-blue-500" /> {detailJob.location}
                                </span>
                            )}
                            {(detailJob?.jobDetails?.jobType || detailJob?.jobType || detailJob?.type) && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-600">
                                    <Briefcase size={11} className="text-purple-500" /> {detailJob?.jobDetails?.jobType || detailJob?.jobType || detailJob?.type}
                                </span>
                            )}
                            {(detailJob?.jobDetails?.workMode || detailJob?.workMode) && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-xs font-bold text-slate-600">
                                    <Globe size={11} className="text-emerald-500" /> {detailJob?.jobDetails?.workMode || detailJob?.workMode}
                                </span>
                            )}
                            {(detailJob?.jobDetails?.priority || detailJob?.priority) && (
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                                    (detailJob?.jobDetails?.priority || detailJob?.priority) === 'Urgent' ? 'bg-red-50 border-red-200 text-red-600' :
                                    (detailJob?.jobDetails?.priority || detailJob?.priority) === 'High' ? 'bg-orange-50 border-orange-200 text-orange-600' :
                                    'bg-blue-50 border-blue-200 text-blue-600'
                                }`}>
                                    <Zap size={11} /> {detailJob?.jobDetails?.priority || detailJob?.priority}
                                </span>
                            )}
                            <button
                                onClick={closeDetail}
                                className="ml-3 h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-all shrink-0"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* ── Body ── */}
                    {detailLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Loading Details...</p>
                            </div>
                        </div>
                    ) : detailJob ? (
                        <div className="flex-1 overflow-y-auto">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
                                {(() => {
                                    const overview = detailJob.jobDescription?.roleOverview || detailJob.description;
                                    const responsibilities = detailJob.jobDescription?.responsibilities || detailJob.responsibilities;
                                    const education = detailJob.jobDescription?.education || detailJob.education;
                                    const certifications = detailJob.jobDescription?.certifications || detailJob.certifications;
                                    const keywords = detailJob.jobDescription?.keywords || detailJob.keywords;
                                    const optionalSkills = detailJob.preferredSkills || detailJob.optionalSkills;
                                    const expMin = detailJob.jobDetails?.experienceMin !== undefined ? detailJob.jobDetails.experienceMin : (detailJob.experienceMin !== undefined ? detailJob.experienceMin : detailJob.minExperienceMonths !== undefined ? Math.floor(detailJob.minExperienceMonths / 12) : undefined);
                                    const expMax = detailJob.jobDetails?.experienceMax !== undefined ? detailJob.jobDetails.experienceMax : (detailJob.experienceMax !== undefined ? detailJob.experienceMax : detailJob.maxExperienceMonths !== undefined ? Math.ceil(detailJob.maxExperienceMonths / 12) : undefined);
                                    const salMin = detailJob.jobDetails?.salaryMin !== undefined ? detailJob.jobDetails.salaryMin : detailJob.salaryMin;
                                    const salMax = detailJob.jobDetails?.salaryMax !== undefined ? detailJob.jobDetails.salaryMax : detailJob.salaryMax;
                                    const noticePeriod = detailJob.jobDetails?.noticePeriod !== undefined ? detailJob.jobDetails.noticePeriod : detailJob.noticePeriod;
                                    const probationPeriod = detailJob.jobDetails?.probationPeriod !== undefined ? detailJob.jobDetails.probationPeriod : detailJob.probationPeriod;

                                    return (
                                    <>
                                        {/* ── LEFT COLUMN ── */}
                                        <div className="space-y-6">
                                            {/* Stats row */}
                                            <div className="grid grid-cols-2 gap-3">
                                                {detailJob.vacancy && (
                                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Vacancies</p>
                                                        <p className="text-2xl font-black text-slate-900">{detailJob.vacancy}</p>
                                                    </div>
                                                )}
                                                {(expMin !== undefined || expMax !== undefined) && (
                                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Experience</p>
                                                        <p className="text-2xl font-black text-slate-900">
                                                            {expMin !== undefined ? expMin : 0} – {expMax !== undefined ? expMax : '?'}
                                                            <span className="text-xs font-bold text-slate-400 ml-1">yrs</span>
                                                        </p>
                                                    </div>
                                                )}
                                                {(salMin || salMax) && (
                                                    <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 col-span-2">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1">Salary Range</p>
                                                        <p className="text-lg font-black text-slate-900">
                                                            ₹{Number(salMin || 0).toLocaleString()} – ₹{Number(salMax || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">LPA</span>
                                                        </p>
                                                    </div>
                                                )}
                                                {noticePeriod && (
                                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Notice Period</p>
                                                        <p className="text-lg font-black text-slate-900">{noticePeriod} <span className="text-xs font-bold text-slate-400">days</span></p>
                                                    </div>
                                                )}
                                                {probationPeriod && (
                                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Probation</p>
                                                        <p className="text-lg font-black text-slate-900">{probationPeriod} <span className="text-xs font-bold text-slate-400">months</span></p>
                                                    </div>
                                                )}
                                                {([detailJob.city, detailJob.state, detailJob.country].some(Boolean) || detailJob.location) && (
                                                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 col-span-2">
                                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Location Details</p>
                                                        <p className="text-xs font-bold text-slate-800">
                                                            {[detailJob.city, detailJob.state, detailJob.country].filter(Boolean).join(', ') || detailJob.location}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Description */}
                                            {overview && (
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                                        <Layers size={13} /> Role Overview
                                                    </h4>
                                                    <p className="text-slate-700 text-sm leading-relaxed bg-slate-50 rounded-xl p-4 border border-slate-100 whitespace-pre-line">
                                                        {overview}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Responsibilities */}
                                            {Array.isArray(responsibilities) && responsibilities.length > 0 && (
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                                        <CheckCircle size={13} /> Responsibilities
                                                    </h4>
                                                    <ul className="space-y-2">
                                                        {responsibilities.map((r, i) => (
                                                            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                                                <ChevronRight size={14} className="text-blue-500 mt-0.5 shrink-0" />
                                                                {toStr(r)}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>

                                        {/* ── RIGHT COLUMN ── */}
                                        <div className="space-y-6">
                                            {/* Required Skills */}
                                            {Array.isArray(detailJob.requiredSkills) && detailJob.requiredSkills.length > 0 && (
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                                        <Award size={13} /> Required Skills
                                                    </h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {detailJob.requiredSkills.map((s, i) => (
                                                            <span key={i} className="px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-bold">
                                                                {toStr(s)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Nice-to-Have Skills */}
                                            {Array.isArray(optionalSkills) && optionalSkills.length > 0 && (
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                                        <Star size={13} /> Nice-to-Have Skills
                                                    </h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {optionalSkills.map((s, i) => (
                                                            <span key={i} className="px-3 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-full text-xs font-bold">
                                                                {toStr(s)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Education & Certifications */}
                                            {(education || (Array.isArray(certifications) && certifications.length > 0)) && (
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                                        <GraduationCap size={13} /> Education & Certifications
                                                    </h4>
                                                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
                                                        {education && (
                                                            <div>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Education</p>
                                                                <p className="text-xs font-bold text-slate-700">{education}</p>
                                                            </div>
                                                        )}
                                                        {Array.isArray(certifications) && certifications.length > 0 && (
                                                            <div>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Certifications</p>
                                                                <div className="flex flex-wrap gap-1.5 mt-1">
                                                                    {certifications.map((c, i) => (
                                                                        <span key={i} className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-[10px] font-bold border border-amber-100">
                                                                            {toStr(c)}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Keywords */}
                                            {Array.isArray(keywords) && keywords.length > 0 && (
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                                        <Zap size={13} /> Keywords
                                                    </h4>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {keywords.map((k, i) => (
                                                            <span key={i} className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-[10px] font-bold">
                                                                #{toStr(k)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Hiring Pipeline */}
                                            {Array.isArray(detailJob.pipelineStages) && detailJob.pipelineStages.filter(s => !s.isSystemStage).length > 0 && (
                                                <div>
                                                    <h4 className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">
                                                        <Layers size={13} /> Hiring Process
                                                    </h4>
                                                    <div className="space-y-2">
                                                        {detailJob.pipelineStages.filter(s => !s.isSystemStage).map((stage, i) => (
                                                            <div key={i} className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl px-4 py-3">
                                                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-black shrink-0">
                                                                    {i + 1}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-bold text-slate-800">{stage.stageName}</p>
                                                                    {(stage.stageType || stage.mode) && (
                                                                        <p className="text-[11px] text-slate-400 font-medium">
                                                                            {[stage.stageType, stage.mode].filter(Boolean).join(' · ')}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                {stage.durationMinutes && (
                                                                    <span className="text-[11px] font-bold text-slate-400 shrink-0 bg-white border border-slate-200 rounded-full px-2 py-0.5">
                                                                        {stage.durationMinutes} min
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                );
                            })()}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Could not load details.</div>
                    )}

                    {/* ── Bottom Footer Bar ── */}
                    <div className="px-8 py-4 border-t border-slate-100 bg-white shrink-0 flex gap-3">
                        <button
                            onClick={closeDetail}
                            className="flex-1 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-slate-50 transition-all"
                        >
                            Close
                        </button>
                        <button
                            onClick={() => {
                                closeDetail();
                                navigate(`/apply-job/${detailJob?._id || detailJob?.id}?tenantId=${tenantId || getTenantId()}`);
                            }}
                            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-100 active:scale-95"
                        >
                            Apply Position <ArrowRight size={15} />
                        </button>
                    </div>
                </div>
            </div>,
            document.body
            )}
        </div>
    );
}
