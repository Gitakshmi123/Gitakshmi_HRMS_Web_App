import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import CommentSection from '../../components/common/CommentSection';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { ChevronLeft, Calendar, User, Info, AlertTriangle } from 'lucide-react';

export default function EntityDetail() {
    const { entityType, entityId } = useParams();
    const navigate = useNavigate();
    const [entity, setEntity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                setLoading(true);
                const res = await api.get(`/entities/${entityType}/${entityId}`);
                setEntity(res.data);
            } catch (err) {
                console.error("Failed to fetch entity details", err);
                setError(err.response?.status === 403 ? 'FORBIDDEN' : 'NOT_FOUND');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [entityType, entityId]);

    if (loading) return (
        <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
    );

    if (error === 'FORBIDDEN') return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-900 p-6 text-center">
            <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-6">
                <AlertTriangle size={40} />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">403 - Access Denied</h1>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
                You do not have permission to view this {entityType}.
                Strict role-based isolation is enforced for this entity.
            </p>
            <button
                onClick={() => navigate(-1)}
                className="mt-8 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
                Go Back
            </button>
        </div>
    );

    if (error || !entity) return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Entity Not Found</h1>
            <button onClick={() => navigate(-1)} className="mt-4 text-blue-600 hover:underline">Go Back</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8">
            <div className="max-w-[1600px] mx-auto space-y-8">
                {/* 1. PREMIUM HEADER BANNER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-emerald-600 p-10 rounded-3xl shadow-sm relative overflow-hidden mb-8">
                    <div className="relative z-10 flex items-center gap-6">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-all border border-white/20 shadow-lg group"
                        >
                            <ChevronLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <div>
                            <h1 className="text-4xl font-black text-white tracking-tight capitalize mb-1">
                                {entityType} Details
                            </h1>
                            <p className="text-emerald-100 font-bold uppercase tracking-[0.3em] text-[10px]">
                                ID: {entityId}
                            </p>
                        </div>
                    </div>
                    {/* Decorative BG element */}
                    <div className="absolute top-0 right-0 w-64 h-full bg-white/10 blur-3xl rounded-full pointer-events-none -mr-16 -mt-10"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Details Panel */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 border-blue-50 shadow-sm transition-all hover:shadow-md relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-blue-100 transition-all duration-700"></div>

                            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-3 relative z-10">
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                    <Info size={20} />
                                </div>
                                Information
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                                {entity.employee && (
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                            <User size={24} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</label>
                                            <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
                                                {entity.employee.firstName} {entity.employee.lastName}
                                            </div>
                                            <div className="text-xs text-slate-500 font-bold">{entity.employee.email}</div>
                                        </div>
                                    </div>
                                )}

                                {entity.startDate && (
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                                            <Calendar size={24} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Event Date</label>
                                            <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
                                                {formatDateDDMMYYYY(entity.startDate)}
                                            </div>
                                            <div className="text-xs text-slate-500 font-bold">Correction applied for this day</div>
                                        </div>
                                    </div>
                                )}

                                {/* Regularization Specific Fields */}
                                {entityType === 'Regularization' && (
                                    <>
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                                                <Info size={20} className="text-slate-400" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Workflow Category</label>
                                                <div className={`text-xs font-black uppercase tracking-[0.1em] mt-1.5 px-3 py-1 rounded-lg inline-block ${entity.category === 'Attendance' ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
                                                    {entity.category} Correction
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl">
                                                <AlertTriangle size={20} className="text-slate-400" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exception Type</label>
                                                <div className="text-slate-900 dark:text-slate-100 font-black text-sm mt-1.5 uppercase tracking-tight">
                                                    {entity.issueType}
                                                </div>
                                            </div>
                                        </div>

                                        {entity.requestedData && (
                                            <div className="md:col-span-2 p-8 bg-blue-50/30 dark:bg-blue-900/10 rounded-[2rem] border-2 border-dashed border-blue-100/50 dark:border-blue-900/20">
                                                <h4 className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                                                    Requested Correction Details
                                                </h4>
                                                <div className="grid grid-cols-2 gap-12">
                                                    {entity.category === 'Attendance' ? (
                                                        <>
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modified Check In</label>
                                                                <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                                                                    {entity.requestedData.checkIn ? new Date(entity.requestedData.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                                </div>
                                                            </div>
                                                            <div className="space-y-2">
                                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Modified Check Out</label>
                                                                <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                                                                    {entity.requestedData.checkOut ? new Date(entity.requestedData.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Leave Type</label>
                                                            <div className="text-2xl font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                                                                {entity.requestedData.requestedLeaveType || 'N/A'}
                                                            </div>
                                                            <div className="text-[11px] font-bold text-slate-400 italic">Changed from: {entity.requestedData.originalLeaveType || 'None'}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}

                                <div className="md:col-span-2 border-t border-slate-100 dark:border-slate-800 pt-8">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee Reason / Justification</label>
                                    <div className="mt-4 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-3xl text-slate-700 dark:text-slate-300 text-base font-bold leading-relaxed border border-slate-100 dark:border-slate-800 italic">
                                        "{entity.reason || entity.message || "No description provided."}"
                                    </div>
                                </div>

                                {entity.status && (
                                    <div className="md:col-span-2 flex items-center justify-between mt-6 bg-white dark:bg-slate-800/50 p-6 rounded-3xl border-2 border-slate-50 dark:border-slate-800 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-3 h-3 rounded-full ${entity.status === 'Approved' ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]' : entity.status === 'Rejected' ? 'bg-red-500' : 'bg-amber-500 animate-pulse'}`}></div>
                                            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Current Status</label>
                                        </div>
                                        <span className={`px-6 py-2 rounded-xl text-[11px] font-black uppercase tracking-[0.1em] border shadow-sm ${entity.status === 'Approved' ? 'bg-green-50 text-green-700 border-green-100' :
                                            entity.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                                                'bg-amber-50 text-amber-600 border-amber-100'
                                            }`}>
                                            {entity.status}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Chat / Comment Panel */}
                    <div className="lg:col-span-1">
                        <CommentSection entityType={entityType} entityId={entityId} />
                    </div>
                </div>
            </div>
        </div>
    );
}
