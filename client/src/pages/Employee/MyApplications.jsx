import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleRoute } from '../../utils/navigation';
import api from '../../utils/api';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { 
    Briefcase, Calendar, Building2, ChevronRight, Layers, 
    X, AlertTriangle, RefreshCw, Eye, Trash2, History, ArrowLeft, XCircle
} from 'lucide-react';
import clsx from 'clsx';
import { showToast } from '../../utils/uiNotifications';
import { useRBAC } from '../../context/RBACContext';

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

const WITHDRAWABLE_STATUSES = ['Applied', 'Shortlisted'];

function getStatusConfig(status) {
    return STATUS_CONFIG[status] || { color: 'bg-slate-100 text-slate-500 border-slate-200', dot: 'bg-slate-400', label: status || 'Pending' };
}

export default function MyApplications() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { hasPermission, loading: permissionLoading } = useRBAC();
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('All');
    const [withdrawModal, setWithdrawModal] = useState(null); 
    const [withdrawReason, setWithdrawReason] = useState('');
    const [withdrawing, setWithdrawing] = useState(false);
    const isTenant = location.pathname.startsWith('/tenant');
    const isHr = location.pathname.startsWith('/hr');
    const pathPrefix = isTenant ? '/tenant' : (isHr ? '/hr' : '/employee');

    // Define permission variables based on RBAC context
    const canViewApplications = hasPermission('employee.jobs', 'any') || user?.roleName?.toLowerCase()?.includes('admin') || user?.roleName?.toLowerCase()?.includes('manager');
    const canWithdrawApplications = hasPermission('employee.jobs', 'any') || user?.roleName?.toLowerCase()?.includes('admin') || user?.roleName?.toLowerCase()?.includes('manager');
    const canAccessApplications = canViewApplications || canWithdrawApplications;

    useEffect(() => {
        if (permissionLoading || (!canViewApplications && !canWithdrawApplications)) {
            setApps([]);
            setLoading(false);
            return;
        }
        fetchMyApplications();
    }, [permissionLoading, canViewApplications, canWithdrawApplications]);

    async function fetchMyApplications() {
        if (!canViewApplications && !canWithdrawApplications) return;
        try {
            setLoading(true);
            const res = await api.get('/requirements/my-applications');
            setApps(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to load applications", error);
            showToast('error', 'Sync Error', 'Could not load your applications.');
        } finally {
            setLoading(false);
        }
    }

    async function handleWithdraw() {
        if (!canWithdrawApplications) return;
        if (!withdrawModal) return;
        setWithdrawing(true);
        try {
            await api.delete(`/requirements/my-applications/${withdrawModal._id}/withdraw`, {
                data: { reason: withdrawReason }
            });
            showToast('success', 'Application Withdrawn', 'Your application has been successfully recalled.');
            setWithdrawModal(null);
            setWithdrawReason('');
            setApps(prev => prev.map(a => a._id === withdrawModal._id ? { ...a, status: 'Withdrawn' } : a));
        } catch (error) {
            const msg = error.response?.data?.message || 'Could not withdraw application.';
            showToast('error', 'Withdrawal Failed', msg);
        } finally {
            setWithdrawing(false);
        }
    }

    const stats = useMemo(() => {
        const counts = { 'All': apps.length };
        apps.forEach(a => {
            counts[a.status] = (counts[a.status] || 0) + 1;
        });
        return counts;
    }, [apps]);

    // Define tabs to show based on available statuses or a fixed set
    const activeStatuses = useMemo(() => {
        const statuses = ['All', 'Applied', 'Joining Letter Issued']; // Bases on screenshot
        // Add others if they have counts and aren't in the list? 
        // For now, let's stick to the screenshot's primary tabs but filter dynamically if needed.
        return statuses;
    }, []);

    const filtered = useMemo(() => 
        filterStatus === 'All' ? apps : apps.filter(a => a.status === filterStatus)
    , [apps, filterStatus]);

    if (permissionLoading) return null;

    if (!canAccessApplications) {
        return (
            <div className="flex min-h-[320px] items-center justify-center bg-white p-6">
                <div className="w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
                        <AlertTriangle size={28} />
                    </div>
                    <h3 className="text-[20px] font-semibold text-[#334155]">Applications Access Restricted</h3>
                    <p className="mt-2 text-sm font-medium text-[#64748B]">
                        You do not currently have permission to open internal application history.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center bg-white">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2563EB] mb-4"></div>
            <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-widest">Retrieving applications...</p>
        </div>
    );

    return (
        <div className="h-full min-h-0 w-full overflow-y-auto bg-white p-[20px] font-inter animate-in fade-in duration-500 scroll-smooth">
            <div className="max-w-[1400px] mx-auto space-y-6">

                {/* 1. Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => navigate(-1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#64748B] transition-all hover:text-[#2563EB] hover:border-[#2563EB]/30 shadow-sm"
                        >
                            <ArrowLeft size={16} />
                        </button>
                        <h1 className="text-[22px] font-bold text-[#1E293B] tracking-tight">Internal Applications</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="px-3 h-[36px] bg-white border border-[#E2E8F0] rounded-xl shadow-sm flex items-center gap-2">
                            <Layers size={14} className="text-[#2563EB]" />
                            <span className="text-[11px] font-bold text-[#334155] uppercase tracking-wider">{apps.length} Total</span>
                        </div>
                        <button 
                            onClick={fetchMyApplications}
                            className="w-9 h-9 flex items-center justify-center bg-white border border-[#E2E8F0] rounded-xl text-[#64748B] hover:text-[#2563EB] transition-all shadow-sm"
                        >
                            <RefreshCw size={14} />
                        </button>
                    </div>
                </div>

                {/* 2. Filter Tabs */}
                <div className="flex items-center gap-3">
                    {activeStatuses.map(status => (
                        <button
                            key={status}
                            onClick={() => setFilterStatus(status)}
                            className={clsx(
                                "px-5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all border",
                                filterStatus === status 
                                    ? "bg-[#1E293B] text-white border-[#1E293B] shadow-lg shadow-slate-200" 
                                    : "bg-white text-[#64748B] border-[#E2E8F0] hover:border-[#CBD5E1]"
                            )}
                        >
                            {status} ({stats[status] || 0})
                        </button>
                    ))}
                </div>

                {/* 3. Content Table */}
                <div className="w-full">
                    {/* Table Headers */}
                    <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] px-6 py-3">
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest px-14">Opportunity</span>
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest text-center">Department</span>
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest text-center">Date</span>
                        <span className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-widest text-right pr-14">Status</span>
                    </div>

                    {/* Table Body */}
                    {filtered.length === 0 ? (
                        <div className="bg-white border border-dashed border-[#E2E8F0] rounded-2xl py-20 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-200 mb-4 border border-[#E2E8F0] shadow-inner">
                                <Briefcase size={32} />
                            </div>
                            <h3 className="text-[16px] font-semibold text-[#334155]">
                                {filterStatus === 'All' ? 'No Applications Yet' : `No "${filterStatus}" Applications`}
                            </h3>
                            <p className="text-[13px] text-[#64748B] font-medium mt-1">
                                {filterStatus === 'All' 
                                    ? 'Start applying for internal openings.'
                                    : 'Try selecting a different status filter.'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filtered.map(app => {
                                const cfg = getStatusConfig(app.status);
                                return (
                                    <button
                                        key={app._id}
                                        type="button"
                                        onClick={() => canViewApplications && navigate(getRoleRoute(`my-applications/${app.applicationId}`, user?.role, pathPrefix))}
                                        className="w-full bg-white rounded-2xl border border-[#E2E8F0] p-4 text-left transition-all duration-200 group hover:border-[#CBD5E1] hover:shadow-lg hover:shadow-slate-100"
                                    >
                                        <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center">
                                            {/* Opportunity */}
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] text-[#3B82F6] flex items-center justify-center border border-[#DBEAFE] shrink-0 group-hover:bg-[#3B82F6] group-hover:text-white transition-colors">
                                                    <Briefcase size={22} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="text-[14px] font-bold text-[#1E293B] truncate group-hover:text-[#2563EB] transition-colors">
                                                        {app.requirementId?.jobTitle || 'Internal Opportunity'}
                                                    </h3>
                                                    <p className="text-[11px] font-medium text-[#64748B] uppercase tracking-wider mt-0.5">
                                                        {app.applicationId || `APP-${String(app._id || '').slice(-6).toUpperCase()}`}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Department */}
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100">
                                                    <Building2 size={14} className="text-[#64748B]" />
                                                </div>
                                                <span className="text-[13px] font-bold text-[#475569]">
                                                    {app.requirementId?.department || 'IT'}
                                                </span>
                                            </div>

                                            {/* Date */}
                                            <div className="text-center">
                                                <span className="text-[12px] font-bold text-[#64748B] uppercase tracking-wider bg-slate-50 px-3 py-1 rounded-md border border-slate-100">
                                                    {app.status === 'Applied' ? 'APPLIED' : formatDateDDMMYYYY(app.createdAt)}
                                                </span>
                                            </div>

                                            {/* Status */}
                                            <div className="flex items-center justify-end gap-6">
                                                <span className={clsx(
                                                    "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.05em] border inline-flex items-center gap-2",
                                                    cfg.color
                                                )}>
                                                    <div className={clsx("w-2 h-2 rounded-full", cfg.dot)}></div>
                                                    {cfg.label}
                                                </span>
                                                <ChevronRight size={18} className="text-[#CBD5E1] group-hover:text-[#1E293B] group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Withdraw Modal */}
            {withdrawModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[#E2E8F0]">
                        <div className="px-6 py-5 border-b border-[#E2E8F0] flex items-center justify-between bg-rose-50/50">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 bg-rose-100 rounded-lg flex items-center justify-center text-rose-600">
                                    <AlertTriangle size={18} />
                                </div>
                                <h3 className="text-[16px] font-bold text-[#334155]">Withdraw Application</h3>
                            </div>
                            <button onClick={() => setWithdrawModal(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition-all">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            <p className="text-[13px] text-[#64748B] font-medium leading-relaxed">
                                You are about to withdraw your application for <span className="font-bold text-[#334155]">{withdrawModal.requirementId?.jobTitle}</span>.
                            </p>
                            <textarea
                                value={withdrawReason}
                                onChange={e => setWithdrawReason(e.target.value)}
                                placeholder="Reason for withdrawal..."
                                className="w-full px-4 py-3 bg-white border border-[#E2E8F0] rounded-xl text-[13px] outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-300 transition-all resize-none"
                                rows={3}
                            />
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setWithdrawModal(null)} className="flex-1 h-11 bg-white border border-[#E2E8F0] text-[#64748B] rounded-xl text-[12px] font-bold uppercase transition-all hover:bg-slate-50">Cancel</button>
                                <button onClick={handleWithdraw} disabled={withdrawing} className="flex-1 h-11 bg-rose-600 text-white rounded-xl text-[12px] font-bold uppercase transition-all hover:bg-rose-700 disabled:opacity-50">
                                    {withdrawing ? 'Withdrawing...' : 'Confirm Withdraw'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
