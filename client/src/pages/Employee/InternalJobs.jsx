import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../../utils/api';
import { 
    Briefcase, MapPin, Zap, Check, Send, Eye, X, 
    Search, Building2, ChevronRight, Layers, 
    AlertTriangle, RefreshCw, ClipboardList, LayoutGrid, Calendar,
    CheckCircle2, ArrowRight, XCircle, Link as LinkIcon, Copy as CopyIcon, Users as UsersIcon
} from 'lucide-react';
import clsx from 'clsx';
import { showToast } from '../../utils/uiNotifications';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { useRBAC } from '../../context/RBACContext';
import { useAuth } from '../../context/AuthContext';
import { getRoleRoute } from '../../utils/navigation';

const STATUS_CONFIG = {
    'Applied':              { color: 'bg-amber-50 text-amber-600 border-amber-100',   dot: 'bg-amber-400',   label: 'Applied' },
    'Shortlisted':          { color: 'bg-blue-50 text-[#2563EB] border-blue-100',     dot: 'bg-[#2563EB]',   label: 'Shortlisted' },
    'Interview':            { color: 'bg-indigo-50 text-indigo-600 border-indigo-100', dot: 'bg-indigo-500',  label: 'Interview' },
    'Selected':             { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500', label: 'Selected' },
    'Joining Letter Issued': { color: 'bg-sky-50 text-sky-600 border-sky-100',       dot: 'bg-sky-500',     label: 'Joining Letter Issued' },
    'Offer Issued':         { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500', label: 'Offer Issued' },
    'Joined':               { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', dot: 'bg-emerald-500', label: 'Joined' },
    'Rejected':             { color: 'bg-rose-50 text-rose-600 border-rose-100',      dot: 'bg-rose-500',    label: 'Rejected' },
    'Withdrawn':            { color: 'bg-slate-100 text-slate-500 border-slate-200',  dot: 'bg-slate-400',   label: 'Withdrawn' },
};

function getStatusConfig(status) {
    return STATUS_CONFIG[status] || { color: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400', label: status || 'Pending' };
}

export default function InternalJobs() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { hasPermission, loading: permissionLoading } = useRBAC();
    const [activeTab, setActiveTab ] = useState('board'); 
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myApps, setMyApps] = useState([]);
    const [myReferrals, setMyReferrals] = useState([]);
    const [points, setPoints] = useState(0);
    const [selectedJob, setSelectedJob] = useState(null);
    const [appliedJobIds, setAppliedJobIds] = useState(new Set());
    const [withdrawModal, setWithdrawModal] = useState(null);
    const [withdrawReason, setWithdrawReason] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [historyFilterStatus, setHistoryFilterStatus] = useState('All');
    const [applyJob, setApplyJob] = useState(null);
    const [submittingApply, setSubmittingApply] = useState(false);
    const [applyForm, setApplyForm] = useState({
        usedReferralCode: '',
        currentlyWorking: true,
        isFresher: false,
        experience: '',
        relevantExperience: '',
        currentCompany: '',
        currentDesignation: '',
        noticePeriod: false,
        currentCTC: '',
        expectedCTC: '',
        takeHome: '',
        reasonForChange: ''
    });
    const [tenant, setTenant] = useState(null);
    const canAccessInternalJobs = hasPermission('employee.jobs', 'any') || hasPermission('hiring.internal', 'any');
    const canViewInternalJobs = hasPermission('employee.jobs', 'view') || hasPermission('hiring.internal', 'view');
    const canApplyInternalJobs = hasPermission('employee.jobs', 'create') || hasPermission('hiring.internal', 'create');
    const canWithdrawInternalJobs = hasPermission('employee.jobs', 'delete') || hasPermission('hiring.internal', 'delete');
    const canOpenJobBoard = canViewInternalJobs || canApplyInternalJobs;
    const canOpenApplicationHistory = canViewInternalJobs || canWithdrawInternalJobs;
    const availableTabs = [
        canOpenJobBoard ? 'board' : null,
        canOpenJobBoard ? 'referral' : null,
        canOpenApplicationHistory ? 'referrals' : null
    ].filter(Boolean);

    const location = useLocation();
    const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const referredBy = useMemo(() => {
        const ref = String(query.get('ref') || '').trim();
        return ref || null;
    }, [query]);

    const referralCode = useMemo(() => {
        // Deterministic, short code: <userId-last6>-<day>
        const uid = String(user?.id || user?._id || user?.sub || '').replace(/[^a-zA-Z0-9]/g, '');
        const tail = uid ? uid.slice(-6) : 'guest';
        const day = new Date();
        const y = String(day.getFullYear()).slice(-2);
        const m = String(day.getMonth() + 1).padStart(2, '0');
        const d = String(day.getDate()).padStart(2, '0');
        return `RJ${y}${m}${d}-${tail}`.toUpperCase();
    }, [user]);

    const referralLink = useMemo(() => {
        const base = `${window.location.origin}/jobs/${tenant?.code || 'careers'}`;
        return `${base}?ref=${encodeURIComponent(referralCode)}`;
    }, [tenant?.code, referralCode]);

    const [usedReferralCode, setUsedReferralCode] = useState('');
    const [refLocked, setRefLocked] = useState(false);
    const [resolvedReferrer, setResolvedReferrer] = useState(null);

    useEffect(() => {
        // Priority: query param ref -> localStorage -> empty
        const fromQuery = String(query.get('ref') || '').trim();
        const fromStore = String(localStorage.getItem('internalJobs.usedReferralCode') || '').trim();
        const val = fromQuery || fromStore || '';
        setUsedReferralCode(val);
        setRefLocked(!!fromQuery);
        setApplyForm((prev) => ({ ...prev, usedReferralCode: val }));
    }, [query]);

    useEffect(() => {
        // Register my referral code so HR can attribute later.
        // Best-effort only.
        const isInternalJobsRoute = location.pathname.includes('/internal-jobs');
        if (permissionLoading || !canAccessInternalJobs || !isInternalJobsRoute) return;
        const code = String(referralCode || '').trim();
        if (!code) return;
        api.post('/requirements/referral/register', { code }).catch(() => {});
    }, [canAccessInternalJobs, location.pathname, permissionLoading, referralCode]);

    useEffect(() => {
        const code = String(query.get('ref') || '').trim();
        if (!code) {
            setResolvedReferrer(null);
            return;
        }
        api.get(`/requirements/referral/resolve?code=${encodeURIComponent(code)}`)
            .then((res) => {
                if (res.data?.found) setResolvedReferrer(res.data);
                else setResolvedReferrer({ found: false, code });
            })
            .catch(() => setResolvedReferrer({ found: false, code }));
    }, [query]);

    useEffect(() => {
        if (refLocked) return;
        localStorage.setItem('internalJobs.usedReferralCode', String(usedReferralCode || '').trim());
    }, [usedReferralCode, refLocked]);

    useEffect(() => {
        api.get('/tenants/me').then(res => setTenant(res.data)).catch(() => { });
    }, []);

    useEffect(() => {
        if (permissionLoading || !canAccessInternalJobs) {
            setLoading(false);
            setJobs([]);
            setMyApps([]);
            setMyReferrals([]);
            setAppliedJobIds(new Set());
            return;
        }
        loadData();
    }, [canAccessInternalJobs, canOpenJobBoard, canOpenApplicationHistory, permissionLoading]);

    const pathPrefix = location.pathname.startsWith('/tenant') ? '/tenant' : 
                      location.pathname.startsWith('/hr') ? '/hr' : '/employee';

    useEffect(() => {
        if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
            setActiveTab(availableTabs[0]);
        }
    }, [activeTab, availableTabs]);

    async function loadData() {
        if (!canAccessInternalJobs) return;
        if (!refreshing) setLoading(true);
        try {
            const [jobsRes, appsRes, refsRes] = await Promise.all([
                canOpenJobBoard ? api.get('/requirements/internal-jobs') : Promise.resolve({ data: [] }),
                canOpenApplicationHistory ? api.get('/requirements/my-applications') : Promise.resolve({ data: [] }),
                canOpenApplicationHistory ? api.get('/requirements/my-referrals') : Promise.resolve({ data: [] })
            ]);
            const jobsData = canOpenJobBoard
                ? (jobsRes.data.jobs || jobsRes.data.requirements || (Array.isArray(jobsRes.data) ? jobsRes.data : []))
                : [];
            const appsData = canOpenApplicationHistory
                ? (Array.isArray(appsRes.data) ? appsRes.data : [])
                : [];
            const refsData = canOpenApplicationHistory
                ? (refsRes.data?.referrals || (Array.isArray(refsRes.data) ? refsRes.data : []))
                : [];
            const pointsData = canOpenApplicationHistory
                ? (refsRes.data?.points || 0)
                : 0;
            setJobs(jobsData);
            setMyApps(appsData);
            setMyReferrals(refsData);
            setPoints(pointsData);
            setAppliedJobIds(new Set(appsData.map(a => a.requirementId?._id).filter(id => id)));
        } catch (e) {
            console.error(e);
            showToast('error', 'Sync Failed', 'Could not refresh data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }

    const handleApply = async (jobId) => {
        if (!canApplyInternalJobs) return;
        const job = jobs.find(j => String(j._id) === String(jobId)) || selectedJob || { _id: jobId };
        setApplyJob(job);
        setApplyForm((p) => ({ ...p, usedReferralCode: String(usedReferralCode || '').trim() }));
    }

    const submitApply = async () => {
        if (!canApplyInternalJobs) return;
        if (!applyJob?._id) return;

        try {
            setSubmittingApply(true);
            await api.post(`/requirements/internal-apply/${applyJob._id}`, {
                referral: {
                    usedCode: applyForm.usedReferralCode ? String(applyForm.usedReferralCode).trim() : null,
                    myCode: referralCode,
                    source: (referredBy || refLocked)
                        ? 'referral_link'
                        : (applyForm.usedReferralCode ? 'manual' : 'direct')
                },
                applicant: {
                    currentlyWorking: !!applyForm.currentlyWorking,
                    isFresher: !!applyForm.isFresher,
                    experience: applyForm.experience,
                    relevantExperience: applyForm.relevantExperience,
                    currentCompany: applyForm.currentCompany,
                    currentDesignation: applyForm.currentDesignation,
                    noticePeriod: !!applyForm.noticePeriod,
                    currentCTC: applyForm.currentCTC,
                    expectedCTC: applyForm.expectedCTC,
                    takeHome: applyForm.takeHome,
                    reasonForChange: applyForm.reasonForChange
                }
            });
            showToast('success', 'Applied', 'Application sent successfully.');
            await loadData();
            setSelectedJob(null);
            setApplyJob(null);
        } catch (e) {
            showToast('error', 'Failed', e.response?.data?.message || 'Error applying.');
        } finally {
            setSubmittingApply(false);
        }
    };

    const handleWithdraw = async () => {
        if (!canWithdrawInternalJobs) return;
        if (!withdrawModal) return;
        try {
            await api.delete(`/requirements/my-applications/${withdrawModal._id}/withdraw`, { data: { reason: withdrawReason } });
            showToast('success', 'Success', 'Application withdrawn.');
            setWithdrawModal(null);
            loadData();
        } catch (e) { showToast('error', 'Error', e.response?.data?.message || 'Error withdrawing.'); }
    }

    const stats = useMemo(() => {
        const counts = { 'All': myApps.length };
        myApps.forEach(a => {
            counts[a.status] = (counts[a.status] || 0) + 1;
        });
        return counts;
    }, [myApps]);

    const activeStatuses = ['All', 'Applied', 'Joining Letter Issued'];

    const filteredApps = useMemo(() => 
        historyFilterStatus === 'All' ? myApps : myApps.filter(a => a.status === historyFilterStatus)
    , [myApps, historyFilterStatus]);

    if (permissionLoading) return null;

    if (!canAccessInternalJobs) {
        return (
            <div className="flex min-h-[320px] items-center justify-center bg-white p-6">
                <div className="w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
                        <AlertTriangle size={28} />
                    </div>
                    <h3 className="text-[20px] font-semibold text-[#334155]">Internal Roles Access Restricted</h3>
                    <p className="mt-2 text-sm font-medium text-[#64748B]">
                        You do not currently have permission to browse internal hiring opportunities.
                    </p>
                </div>
            </div>
        );
    }

    if (loading && !refreshing) return (
        <div className="h-full min-h-0 flex items-center justify-center bg-white">
            <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-[#2563EB]/20 border-t-[#2563EB] rounded-full animate-spin"></div>
                <p className="mt-4 text-[11px] font-bold text-slate-400 uppercase tracking-widest">Building Portal...</p>
            </div>
        </div>
    );

    return (
        <div className="h-full min-h-0 w-full overflow-y-auto bg-white font-inter animate-in fade-in duration-500 scroll-smooth relative">
            <div className="w-full space-y-6 p-3">
                
                {/* ── HEADER ── */}
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-2">
                    <div className="flex items-center gap-3">
                        <h1 className="text-[26px] font-bold text-[#1E293B] tracking-tight">
                            {activeTab === 'board' ? 'Internal Role' : activeTab === 'referral' ? 'Referral Program' : 'My Referrals'}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-8 h-[44px] relative">
                            {canOpenJobBoard && (
                                <button 
                                    onClick={() => setActiveTab('board')}
                                    className={clsx(
                                        "h-full px-1 text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 relative group",
                                        activeTab === 'board' ? "text-[#2563EB]" : "text-[#64748B] hover:text-[#334155]"
                                    )}
                                >
                                    Job Board
                                    {activeTab === 'board' && (
                                        <motion.div 
                                            layoutId="tab-underline"
                                            className="absolute bottom-0 inset-x-0 h-0.5 bg-[#2563EB] rounded-full z-10"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                </button>
                            )}
                            {canOpenJobBoard && (
                                <button 
                                    onClick={() => setActiveTab('referral')}
                                    className={clsx(
                                        "h-full px-1 text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 relative group",
                                        activeTab === 'referral' ? "text-[#2563EB]" : "text-[#64748B] hover:text-[#334155]"
                                    )}
                                >
                                    Referral Program
                                    {activeTab === 'referral' && (
                                        <motion.div 
                                            layoutId="tab-underline"
                                            className="absolute bottom-0 inset-x-0 h-0.5 bg-[#2563EB] rounded-full z-10"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                </button>
                            )}

                            {canOpenApplicationHistory && (
                                <button 
                                    onClick={() => setActiveTab('referrals')}
                                    className={clsx(
                                        "h-full px-1 text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 relative group",
                                        activeTab === 'referrals' ? "text-[#2563EB]" : "text-[#64748B] hover:text-[#334155]"
                                    )}
                                >
                                    My Referrals
                                    {myReferrals.length > 0 && (
                                        <span className={clsx(
                                            "flex items-center justify-center text-[10px] w-5 h-5 rounded-full font-bold ml-1 transition-all",
                                            activeTab === 'referrals' ? "bg-[#2563EB] text-white shadow-md shadow-blue-500/30" : "bg-slate-200 text-slate-600"
                                        )}>
                                            {myReferrals.length}
                                        </span>
                                    )}
                                    {activeTab === 'referrals' && (
                                        <motion.div 
                                            layoutId="tab-underline"
                                            className="absolute bottom-0 inset-x-0 h-0.5 bg-[#2563EB] rounded-full z-10"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                </button>
                            )}
                        </div>
                        <button 
                            onClick={() => { setRefreshing(true); loadData(); }}
                            className="w-[44px] h-[44px] bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-[#2563EB] transition-all shadow-sm active:scale-95 group"
                        >
                            <RefreshCw size={18} className={clsx("transition-transform", refreshing && "animate-spin")} />
                        </button>
                    </div>
                </header>

                {/* ── CONTENT ── */}
                <div className="flex-1 overflow-hidden relative">
                    {activeTab === 'board' ? (
                        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Filter Section */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <h3 className="text-lg font-bold text-slate-900">Internal Job Board</h3>
                                        <p className="text-sm text-slate-500">Available opportunities within the organization for you.</p>
                                    </div>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                        <input 
                                            type="text" 
                                            placeholder="Search roles..."
                                            className="h-12 w-full lg:w-[320px] pl-12 pr-4 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/5 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Jobs Grid */}
                            {canOpenJobBoard ? (
                                jobs.length === 0 ? (
                                    <EmptyState icon={Briefcase} text="No internal roles available at the moment." sub="Check back later for new opportunities!" />
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-10">
                                        {jobs.map(j => (
                                            <JobCard 
                                                key={j._id} job={j} tenant={tenant} referralCode={referralCode}
                                                isApplied={appliedJobIds.has(j._id)} 
                                                onView={() => setSelectedJob(j)} onApply={() => handleApply(j._id)} 
                                            />
                                        ))}
                                    </div>
                                )
                            ) : (
                                <EmptyState icon={AlertTriangle} text="Job board hidden by access control." />
                            )}
                        </div>
                    ) : activeTab === 'referral' ? (
                        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
                            {/* ── CLEAN COMPACT REFERRAL CARD ── */}
                            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                                <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                                    {/* Left: Info & Stats */}
                                    <div className="flex-1 p-6 lg:p-8 space-y-8">
                                        <div className="max-w-xl">
                                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Referral Program</h2>
                                            <p className="text-sm text-slate-500 leading-relaxed">
                                                Help grow our team by referring talented people. You'll earn <span className="text-blue-600 font-bold">1,000 points</span> for every successful hire.
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {/* Points */}
                                            <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <Zap size={16} className="text-blue-600" />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Points Earned</span>
                                                </div>
                                                <span className="text-2xl font-bold text-slate-900">{points}</span>
                                            </div>

                                            {/* Code */}
                                            <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <CopyIcon size={16} className="text-slate-400" />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Referral Code</span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-lg font-mono font-bold text-slate-700 tracking-tight">{referralCode}</span>
                                                    <button 
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(referralCode);
                                                            showToast('success', 'Copied', 'Code copied');
                                                        }}
                                                        className="text-blue-600 hover:text-blue-700 transition-colors"
                                                    >
                                                        <CopyIcon size={14} />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Total Referrals */}
                                            <div className="bg-slate-50 border border-slate-100 p-5 rounded-xl">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <UsersIcon size={16} className="text-slate-400" />
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Referrals</span>
                                                </div>
                                                <span className="text-2xl font-bold text-slate-900">{myReferrals.length}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Action Links */}
                                    <div className="w-full lg:w-[320px] bg-slate-50/50 p-6 lg:p-8 space-y-6">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Share Career Link</label>
                                            <div className="flex flex-col gap-3">
                                                <div className="h-10 bg-white border border-slate-200 rounded-lg px-3 flex items-center text-xs text-slate-400 truncate">
                                                    {referralLink}
                                                </div>
                                                <button 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(referralLink);
                                                        showToast('success', 'Copied', 'Link copied');
                                                    }}
                                                    className="w-full h-11 bg-blue-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <CopyIcon size={16} /> Copy Link
                                                </button>
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-slate-200">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Redeem Code</label>
                                            <div className="flex gap-2">
                                                <input 
                                                    value={usedReferralCode}
                                                    onChange={(e) => setUsedReferralCode(e.target.value)}
                                                    disabled={refLocked}
                                                    placeholder="Enter code..."
                                                    className="flex-1 h-10 bg-white border border-slate-200 rounded-lg px-4 text-sm font-medium outline-none focus:border-blue-500 transition-all"
                                                />
                                                <button className="h-10 px-4 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 transition-all">
                                                    <ArrowRight size={18} />
                                                </button>
                                            </div>
                                            {refLocked && (
                                                <p className="mt-2 text-[11px] font-semibold text-blue-600 flex items-center gap-1.5">
                                                    <CheckCircle2 size={12} /> Referred by {resolvedReferrer?.referrerName || 'System'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Standard Info Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-6">
                                {[
                                    { icon: LinkIcon, title: "Share Link", desc: "Share your link on social media or direct message." },
                                    { icon: UsersIcon, title: "Track Progress", desc: "Watch your referrals move through the hiring stages." },
                                    { icon: Zap, title: "Earn Rewards", desc: "Get 1,000 points instantly upon every successful hire." }
                                ].map((item, i) => (
                                    <div key={i} className="bg-white p-6 rounded-2xl border border-slate-100 flex items-start gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 shrink-0">
                                            <item.icon size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-900 mb-1">{item.title}</h4>
                                            <p className="text-[12px] text-slate-500 font-medium leading-relaxed">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>





                    ) : (
                        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Referrals Section */}
                            {canOpenApplicationHistory ? (
                                <>
                                    <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-4 mb-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                                                <UsersIcon size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Candidate Referrals</h4>
                                                <p className="text-[11px] text-slate-500 font-medium">People who used your link to apply</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-0">
                                        <div className="hidden lg:grid grid-cols-[1.5fr_1.2fr_1fr_0.8fr] px-6 pt-2 pb-0">
                                            <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest px-14">Candidate</span>
                                            <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest text-center">Applied For</span>
                                            <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest text-center">Date</span>
                                            <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest text-right pr-14">Status</span>
                                        </div>

                                        {myReferrals.length === 0 ? (
                                            <EmptyState icon={UsersIcon} text="No referrals found." sub="Share your link to get started!" />
                                        ) : (
                                            <div className="space-y-3">
                                                {myReferrals.map(r => (
                                                    <ReferralRow key={r._id} refData={r} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <EmptyState icon={AlertTriangle} text="Referral history hidden by access control." />
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── MODALS ── */}
                {selectedJob && (
                    <JobDetailModal 
                        job={selectedJob} isApplied={appliedJobIds.has(selectedJob._id)} 
                        myApps={myApps} navigate={navigate}
                        onClose={() => setSelectedJob(null)} onApply={() => {}} 
                        user={user} pathPrefix={pathPrefix}
                    />
                )}


            {withdrawModal && (
                    <WithdrawModal 
                        withdrawModal={withdrawModal} reason={withdrawReason} setReason={setWithdrawReason}
                        onClose={() => setWithdrawModal(null)} onConfirm={handleWithdraw} 
                    />
                )}
        </div>
    );
}

/* ── SUBCOMPONENTS ── */

function JobCard({ job, isApplied, onView, onApply, tenant, referralCode }) {
    const handleShare = async (e) => {
        e.stopPropagation();
        const tid = tenant?._id || job.tenant;
        const shareUrl = `${window.location.origin}/apply-job/${job._id}?tenantId=${tid}&ref=${encodeURIComponent(referralCode)}`;
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast('success', 'Copied', 'Direct apply link copied!');
        } catch (err) {
            showToast('error', 'Failed', 'Could not copy link');
        }
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-lg hover:border-[#2563EB]/20 transition-all duration-500 group flex flex-col h-full relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 bg-[#EFF6FF] text-[#2563EB] rounded-lg flex items-center justify-center border border-[#DBEAFE] group-hover:bg-[#2563EB] group-hover:text-white transition-all">
                            <Briefcase size={20} />
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={handleShare}
                                className="h-10 px-3 bg-white border border-slate-200 text-slate-500 hover:text-[#2563EB] hover:border-[#2563EB]/40 rounded-lg transition-all flex items-center gap-2 shadow-sm active:scale-95"
                                title="Copy direct apply link"
                            >
                                <LinkIcon size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Refer</span>
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const tid = tenant?._id || job.tenant;
                                    const shareUrl = `${window.location.origin}/apply-job/${job._id}?tenantId=${tid}&ref=${encodeURIComponent(referralCode)}`;
                                    window.open(`https://wa.me/?text=${encodeURIComponent(`Check out this job: ${job.jobTitle} - ${shareUrl}`)}`, '_blank');
                                }}
                                className="w-10 h-10 bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-600 hover:text-white rounded-lg transition-all flex items-center justify-center shadow-sm active:scale-95"
                                title="Share on WhatsApp"
                            >
                                <svg size={18} fill="currentColor" viewBox="0 0 24 24" className="w-5 h-5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .004 5.412.001 12.048a11.827 11.827 0 001.578 5.919L0 24l6.128-1.609a11.803 11.803 0 005.917 1.583h.005c6.636 0 12.048-5.412 12.051-12.049a11.829 11.829 0 00-3.582-8.416z" /></svg>
                            </button>
                        </div>
                    </div>
                {isApplied && (
                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5">
                        <Check size={14} /> Applied
                    </span>
                )}
            </div>
            <div className="flex-1 space-y-1">
                <h3 className="text-[15px] font-bold text-[#1E293B] leading-tight group-hover:text-[#2563EB] transition-colors">{job.jobTitle}</h3>
                <p className="text-[11px] text-[#64748B] font-semibold flex items-center gap-2">
                    <Building2 size={12} className="text-[#2563EB]" /> {job.department}
                </p>
                <div className="flex gap-2 pt-4">
                    <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{job.location?.city || 'Remote'}</span>
                    {job.employmentType && (
                        <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{job.employmentType}</span>
                    )}
                </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2">
                <button onClick={onView} className="flex-1 h-9 bg-slate-50 border border-slate-200 text-[#334155] rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:border-[#2563EB]/40 transition-all">Details</button>
            </div>
        </div>
    );
}

function AppRow({ app, onClick }) {
    const cfg = getStatusConfig(app.status);
    return (
        <button 
            type="button"
            onClick={onClick}
            className="w-full bg-white rounded-2xl border border-[#E2E8F0] p-4 text-left transition-all duration-200 group hover:border-[#CBD5E1] hover:shadow-lg hover:shadow-slate-100"
        >
            <div className="flex flex-col lg:grid lg:grid-cols-[1.5fr_1fr_1fr_1fr] items-start lg:items-center gap-4 lg:gap-0">
                <div className="flex items-center gap-4 w-full">
                    <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center border border-[#DBEAFE] group-hover:bg-[#3B82F6] group-hover:text-white transition-colors shrink-0">
                        <Briefcase size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-[15px] font-bold text-[#1E293B] truncate group-hover:text-[#2563EB] transition-colors">{app.requirementId?.jobTitle || 'Role'}</h4>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{app.applicationId || 'N/A'}</span>
                            <span className="text-[11px] text-[#64748B] font-medium flex lg:hidden items-center gap-1.5"><Calendar size={12} /> {formatDateDDMMYYYY(app.createdAt)}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center lg:justify-center gap-2 w-full lg:w-auto">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 lg:hidden">
                        <Building2 size={14} className="text-[#64748B]" />
                    </div>
                    <span className="text-[13px] font-bold text-[#475569]">{app.requirementId?.department || 'IT'}</span>
                </div>

                <div className="hidden lg:block text-center">
                    <span className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
                        {app.status === 'Applied' ? 'APPLIED' : formatDateDDMMYYYY(app.createdAt)}
                    </span>
                </div>

                <div className="flex items-center justify-between lg:justify-end gap-6 w-full lg:w-auto pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-50">
                    <span className={clsx("px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.05em] border inline-flex items-center gap-2", cfg.color)}>
                        <div className={clsx("w-2 h-2 rounded-full", cfg.dot)}></div>
                        {cfg.label}
                    </span>
                    <ChevronRight size={18} className="text-[#CBD5E1] group-hover:text-[#1E293B] group-hover:translate-x-1 transition-all" />
                </div>
            </div>
        </button>
    );
}

function ReferralRow({ refData }) {
    const cfg = getStatusConfig(refData.status);
    return (
        <div className="w-full bg-white rounded-2xl border border-[#E2E8F0] p-4 text-left transition-all duration-200 group hover:border-[#CBD5E1] hover:shadow-lg hover:shadow-slate-100">
            <div className="flex flex-col lg:grid lg:grid-cols-[1.5fr_1.2fr_1fr_0.8fr] items-start lg:items-center gap-4 lg:gap-0">
                <div className="flex items-center gap-4 w-full">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center border border-slate-100 group-hover:bg-[#2563EB] group-hover:text-white transition-colors shrink-0">
                        <UsersIcon size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h4 className="text-[15px] font-bold text-[#1E293B] truncate group-hover:text-[#2563EB] transition-colors">{refData.name || 'Candidate'}</h4>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8]">{refData.applicationId || 'APP-REF'}</span>
                            <span className="text-[11px] text-[#64748B] font-medium truncate">{refData.email}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center lg:justify-center gap-2 w-full lg:w-auto">
                    <span className="text-[13px] font-bold text-[#475569] truncate max-w-[200px]">{refData.requirementId?.jobTitle || 'N/A'}</span>
                </div>

                <div className="text-center w-full lg:w-auto">
                    <span className="text-[11px] text-[#64748B] font-medium flex items-center justify-center gap-1.5">
                        <Calendar size={12} /> {formatDateDDMMYYYY(refData.createdAt || refData.referral?.capturedAt)}
                    </span>
                </div>

                <div className="flex items-center justify-end w-full lg:w-auto">
                    <div className={clsx(
                        "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-2 min-w-[120px] justify-center transition-all",
                        cfg.color
                    )}>
                        <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
                        {cfg.label}
                    </div>
                </div>
            </div>
        </div>
    );
}

function EmptyState({ icon: Icon, text, sub }) {
    return (
        <div className="py-20 flex flex-col items-center justify-center text-center w-full bg-white rounded-[32px] border border-dashed border-slate-200">
            <div className="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center text-slate-200 mb-6 border border-slate-100">
                <Icon size={40} />
            </div>
            <h3 className="text-[18px] font-bold text-[#1E293B]">{text}</h3>
            {sub && <p className="text-[14px] text-[#64748B] font-medium mt-2 max-w-xs">{sub}</p>}
        </div>
    );
}

function JobDetailModal({ job, isApplied, onClose, onApply, myApps, navigate, user, pathPrefix }) {
    return (
        <div className="absolute inset-[10px] z-[100] animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white w-full h-full rounded-xl shadow-2xl border border-[#E2E8F0] overflow-hidden flex flex-col">
                <div className="px-8 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
                    <div className="flex items-center gap-4">
                        <div>
                            <h2 className="text-[22px] font-bold text-[#1E293B] leading-tight">{job.jobTitle}</h2>
                            <p className="text-[13px] text-[#64748B] font-bold uppercase tracking-widest">{job.department} Unit</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-lg transition-colors"><X size={20} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                    <section>
                        <h4 className="text-[11px] font-bold text-[#2563EB] uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                            <div className="w-8 h-[2px] bg-[#2563EB] rounded-full"></div> Role Overview
                        </h4>
                        <div className="text-[15px] text-slate-600 leading-relaxed bg-slate-50 p-6 rounded-xl border border-slate-100">
                            {typeof job.jobDescription === 'object' ? (
                                <div className="space-y-6">
                                    {job.jobDescription.roleOverview && (
                                        <p className="whitespace-pre-wrap">{job.jobDescription.roleOverview}</p>
                                    )}
                                    {job.jobDescription.responsibilities && (
                                        <div className="pt-2">
                                            <h5 className="font-bold text-slate-800 text-[13px] uppercase tracking-wider mb-2">Key Responsibilities:</h5>
                                            <p className="whitespace-pre-wrap text-[14px]">{job.jobDescription.responsibilities}</p>
                                        </div>
                                    )}
                                    {job.jobDescription.education && (
                                        <div className="pt-2">
                                            <h5 className="font-bold text-slate-800 text-[13px] uppercase tracking-wider mb-2">Education:</h5>
                                            <p className="text-[14px]">{job.jobDescription.education}</p>
                                        </div>
                                    )}
                                    {job.jobDescription.certifications && (
                                        <div className="pt-2">
                                            <h5 className="font-bold text-slate-800 text-[13px] uppercase tracking-wider mb-2">Certifications:</h5>
                                            <p className="text-[14px]">{job.jobDescription.certifications}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="whitespace-pre-wrap">{job.jobDescription || "No detailed overview provided."}</p>
                            )}
                        </div>
                    </section>
                </div>
                <div className="px-10 py-3 border-t border-slate-100 flex items-center justify-end gap-5 bg-slate-50/50">
                    <button onClick={onClose} className="text-slate-500 text-[11px] font-bold uppercase tracking-widest hover:text-slate-700 transition-all">Close</button>
                </div>
            </div>
        </div>
    );
}

