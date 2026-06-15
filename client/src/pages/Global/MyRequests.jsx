import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { 
    Calendar, Clock, CheckCircle, XCircle, AlertCircle, 
    ChevronRight, ArrowUpRight, History, Layers, Info
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import clsx from 'clsx';

export default function MyRequests() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [requests, setRequests] = useState({ leaves: [], regularizations: [], notifications: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMyRequests = async () => {
            try {
                setLoading(true);
                const res = await api.get('/notifications/my-requests');
                setRequests(res.data);
            } catch (error) {
                console.error("Failed to fetch my requests", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMyRequests();
    }, []);


    const handleItemClick = (type, id) => {
        const basePath = user?.role === 'hr' ? '/hr' : '/employee';
        navigate(`${basePath}/details/${type}/${id}`);
    };

    if (loading) return (
        <div className="flex h-screen items-center justify-center p-6 bg-[#F8FAFC]">
            <div className="flex flex-col items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2563EB] mb-4"></div>
                <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-widest">Retrieving applications...</p>
            </div>
        </div>
    );

    return (
        <div className="w-full bg-[#F8FAFC] min-h-screen p-6 lg:p-10 font-inter space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Header */}
            <header className="p-8 bg-white rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-[300px] h-full bg-slate-50/50 skew-x-12 translate-x-32 pointer-events-none"></div>
                <div className="relative z-10">
                    <h1 className="text-[24px] font-bold text-[#334155] tracking-tight">Request Tracker</h1>
                    <p className="text-[14px] text-[#64748B] font-medium opacity-80 mt-1">Lifecycle monitoring for all your active and historical applications.</p>
                </div>
                <button 
                   onClick={() => navigate(user?.role === 'hr' ? '/hr' : '/employee')}
                   className="relative z-10 px-6 h-[42px] bg-white border border-[#E2E8F0] text-[#334155] rounded-lg text-[12px] font-bold uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2"
                >
                    Return to Dashboard <ArrowUpRight size={14} className="text-[#64748B]" />
                </button>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Main Content Areas */}
                <div className="xl:col-span-8 space-y-8">
                    {/* Section 1: Leave History */}
                    <div className="space-y-4">
                        <h2 className="text-[14px] font-bold text-[#334155] uppercase tracking-widest flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center border border-blue-100">
                                <Calendar size={16} />
                            </span>
                            Absence Entitlements
                        </h2>
                        <div className="grid gap-3">
                            {requests.leaves.length === 0 ? (
                                <EmptySection icon={Calendar} label="No leave records detected" />
                            ) : (
                                requests.leaves.map(req => (
                                    <RequestItem 
                                        key={req._id}
                                        title={req.leaveType}
                                        subtitle={`${formatDateDDMMYYYY(req.startDate)} — ${formatDateDDMMYYYY(req.endDate)}`}
                                        status={req.status}
                                        type="LeaveRequest"
                                        id={req._id}
                                        onClick={handleItemClick}
                                        color="blue"
                                        icon={Calendar}
                                    />
                                ))
                            )}
                        </div>
                    </div>

                    {/* Section 2: Regularizations */}
                    <div className="space-y-4">
                        <h2 className="text-[14px] font-bold text-[#334155] uppercase tracking-widest flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg bg-indigo-50 text-[#6366F1] flex items-center justify-center border border-indigo-100">
                                <History size={16} />
                            </span>
                            Regularization Registry
                        </h2>
                        <div className="grid gap-3">
                            {requests.regularizations.length === 0 ? (
                                <EmptySection icon={History} label="No adjustments recorded" />
                            ) : (
                                requests.regularizations.map(req => (
                                    <RequestItem 
                                        key={req._id}
                                        title={req.category}
                                        subtitle={formatDateDDMMYYYY(req.startDate)}
                                        status={req.status}
                                        type="Regularization"
                                        id={req._id}
                                        onClick={handleItemClick}
                                        color="indigo"
                                        icon={Clock}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Notifications Sidebar */}
                <div className="xl:col-span-4 space-y-6">
                    <h2 className="text-[14px] font-bold text-[#334155] uppercase tracking-widest flex items-center gap-3">
                        <span className="w-8 h-8 rounded-lg bg-slate-100 text-[#64748B] flex items-center justify-center border border-slate-200">
                            <AlertCircle size={16} />
                        </span>
                        Activity Feed
                    </h2>
                    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                        <div className="divide-y divide-slate-50">
                            {requests.notifications.length === 0 ? (
                                <div className="p-12 text-center text-[#64748B] opacity-50 space-y-3">
                                    <Info size={32} className="mx-auto" />
                                    <p className="text-[11px] font-bold uppercase tracking-widest leading-relaxed">System standby — No recent activity noted</p>
                                </div>
                            ) : (
                                requests.notifications.map(notif => (
                                    <div
                                        key={notif._id}
                                        onClick={() => handleItemClick(notif.entityType, notif.entityId)}
                                        className={clsx(
                                            "p-5 hover:bg-slate-50 cursor-pointer transition-all border-l-4",
                                            !notif.isRead ? "border-l-[#2563EB] bg-blue-50/20" : "border-l-transparent"
                                        )}
                                    >
                                        <div className="text-[13px] font-bold text-[#334155] mb-1">{notif.title}</div>
                                        <div className="text-[12px] text-[#64748B] font-medium line-clamp-2 leading-relaxed">{notif.message}</div>
                                        <div className="text-[10px] text-slate-400 mt-3 font-bold uppercase tracking-widest flex items-center gap-2">
                                           <div className="w-1 h-1 rounded-full bg-slate-300"></div> {formatDateDDMMYYYY(notif.createdAt)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const StatusBadge = ({ status }) => {
    const styles = {
        Pending: "bg-amber-50 text-amber-600 border-amber-100",
        Approved: "bg-[#ECFDF5] text-[#16A34A] border-[#D1FAE5]",
        Rejected: "bg-rose-50 text-rose-600 border-rose-100",
    };
    return (
        <span className={clsx("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", styles[status] || styles.Pending)}>
            {status}
        </span>
    );
};

function RequestItem({ title, subtitle, status, type, id, onClick, color, icon: Icon }) {
    return (
        <div
            onClick={() => onClick(type, id)}
            className="group bg-white p-5 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 cursor-pointer hover:border-[#2563EB] hover:shadow-md transition-all active:scale-[0.99]"
        >
            <div className="flex gap-4 items-center w-full sm:w-auto">
                <div className={clsx(
                    "w-12 h-12 rounded-lg flex items-center justify-center border shrink-0 group-hover:scale-110 transition-transform",
                    color === 'blue' ? 'bg-blue-50 text-[#2563EB] border-blue-100' : 'bg-indigo-50 text-[#6366F1] border-indigo-100'
                )}>
                    <Icon size={20} />
                </div>
                <div className="min-w-0">
                    <div className="text-[15px] font-bold text-[#334155] group-hover:text-[#2563EB] transition-colors leading-tight mb-1">{title}</div>
                    <div className="text-[12px] text-[#64748B] flex items-center gap-1.5 font-bold uppercase tracking-wider opacity-60">
                        {subtitle}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-4 ml-auto sm:ml-0">
                <StatusBadge status={status} />
                <ChevronRight size={16} className="text-slate-300 group-hover:text-[#2563EB] group-hover:translate-x-1 transition-all" />
            </div>
        </div>
    );
}

function EmptySection({ icon: Icon, label }) {
    return (
        <div className="bg-white border border-dashed border-[#E2E8F0] p-10 rounded-xl text-center space-y-4">
            <div className="w-12 h-12 bg-slate-50 text-slate-200 border border-slate-100 rounded-lg flex items-center justify-center mx-auto">
                <Icon size={24} />
            </div>
            <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-[0.2em]">{label}</p>
        </div>
    );
}
