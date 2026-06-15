import React, { useState, useEffect } from 'react';
import {
    CheckCircle, XCircle, Clock, User, MessageSquare,
    Search, Loader2, AlertCircle, RefreshCcw
} from 'lucide-react';
import api, { API_ROOT as HRMS_API_ROOT } from '../../utils/api';
import { Can } from '../../components/rbac/PermissionGate';

const API_ROOT = String(
    HRMS_API_ROOT || (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/+$/, '');
const getProfilePicUrl = (profilePic) => {
    const value = String(profilePic || '').trim();
    if (!value) return '';
    return value.startsWith('http') ? value : `${API_ROOT}${value.startsWith('/') ? '' : '/'}${value}`;
};

const getEmployeeDisplayName = (request) => {
    const firstName = String(request?.employee?.firstName || '').trim();
    const lastName = String(request?.employee?.lastName || '').trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
    return fullName || 'Unknown Employee';
};

const getEmployeeDisplayCode = (request) => {
    return String(request?.employee?.employeeId || '').trim() || 'Employee record not linked';
};

const getEmployeeInitials = (request) => {
    const name = getEmployeeDisplayName(request);
    const initials = name
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0]?.toUpperCase())
        .join('')
        .slice(0, 2);

    return initials || 'NA';
};

const normalizeRequestStatus = (status) => String(status || '').trim().toLowerCase();

const FaceUpdateRequests = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [rejectionModal, setRejectionModal] = useState({ show: false, requestId: null, reason: '' });

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const res = await api.get('/attendance/face/requests');
            setRequests(Array.isArray(res?.data?.data) ? res.data.data : []);
        } catch (err) {
            console.error('Error fetching requests:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (requestId, status, rejectionReason = '') => {
        try {
            if (status === 'rejected' && !String(rejectionReason || '').trim()) {
                alert('Rejection reason is required.');
                return;
            }
            const res = await api.post('/attendance/face/action-request', {
                requestId,
                status,
                rejectionReason: String(rejectionReason || '').trim()
            });
            if (res.data.success) {
                fetchRequests();
                setRejectionModal({ show: false, requestId: null, reason: '' });
            }
        } catch (err) {
            console.error('Error actioning request:', err);
            alert(err.response?.data?.message || 'Failed to update request status.');
        }
    };

    const filteredRequests = requests.filter(req =>
        getEmployeeDisplayName(req).toLowerCase().includes(searchTerm.toLowerCase()) ||
        getEmployeeDisplayCode(req).toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusStyle = (status) => {
        switch (normalizeRequestStatus(status)) {
            case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200/50 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
            case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-200/50 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
            case 'rejected': return 'bg-rose-50 text-rose-700 border-rose-200/50 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
            case 'used': return 'bg-blue-50 text-blue-700 border-blue-200/50 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
            default: return 'bg-slate-50 text-slate-700 border-slate-200/50 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
        }
    };

    if (loading && requests.length === 0) {
        return (
            <div className="p-4 sm:p-6 w-full mx-auto space-y-4">
                <div className="flex items-center justify-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
            </div>
        );
    }

    return (
        <div className="p-[10px] w-full mx-auto space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 max-w-md">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search by name or employee ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-sm"
                        />
                    </div>
                </div>
                <button
                    onClick={fetchRequests}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition font-black text-[10px] tracking-widest uppercase shadow-sm"
                >
                    <RefreshCcw size={14} />
                    Refresh
                </button>
            </div>

            <div className="flex flex-col">
                <div className="hidden lg:grid grid-cols-[1.5fr_1fr_2fr_1fr_0.5fr] items-center px-4 py-2 mb-2">
                    <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Employee</div>
                    <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Request Date</div>
                    <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-4">Reason</div>
                    <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">Status</div>
                    <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Actions</div>
                </div>

                <div className="space-y-2">
                    {filteredRequests.map((req) => (
                        <div key={req._id} className="bg-white dark:bg-slate-900 lg:grid lg:grid-cols-[1.5fr_1fr_2fr_1fr_0.5fr] flex flex-col items-center px-4 py-3 rounded-xl border border-slate-100 dark:border-slate-800/60 shadow-sm hover:shadow-md hover:border-blue-500/20 transition-all group gap-2 lg:gap-0">
                            {/* Employee */}
                            <div className="w-full flex items-center gap-3">
                                {getProfilePicUrl(req.employee?.profilePic) ? (
                                    <img
                                        src={getProfilePicUrl(req.employee?.profilePic)}
                                        alt={getEmployeeDisplayName(req)}
                                        className="w-9 h-9 rounded-full object-cover ring-2 ring-white dark:ring-slate-900 shadow-sm"
                                    />
                                ) : (
                                    <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs ring-2 ring-white dark:ring-slate-900 shadow-sm">
                                        {getEmployeeInitials(req)}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-xs text-slate-800 dark:text-white truncate">{getEmployeeDisplayName(req)}</div>
                                    <div className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">{getEmployeeDisplayCode(req)}</div>
                                </div>
                            </div>
                            {/* Date */}
                            <div className="w-full flex lg:flex-col items-center lg:justify-center justify-between lg:text-center px-1 lg:px-0">
                                <div className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-tight">{new Date(req.requestedAt).toLocaleDateString()}</div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{new Date(req.requestedAt).toLocaleTimeString()}</div>
                            </div>
                            {/* Reason */}
                            <div className="w-full lg:pl-4 bg-slate-50/50 dark:bg-slate-800/20 lg:bg-transparent rounded-lg p-2 lg:p-0">
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 line-clamp-2 uppercase tracking-tight relative pl-2 border-l-2 border-blue-200 dark:border-blue-800 lg:border-none lg:pl-0">
                                    {req.reason || '--'}
                                </div>
                            </div>
                            {/* Status */}
                            <div className="w-full flex lg:justify-center items-center justify-between px-1 lg:px-0 mt-2 lg:mt-0">
                                <span className="lg:hidden text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</span>
                                <span className={`inline-flex px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${getStatusStyle(req.status)}`}>
                                    {normalizeRequestStatus(req.status)}
                                </span>
                            </div>
                            {/* Actions */}
                            <div className="w-full flex lg:justify-end items-center justify-end gap-1.5 pt-2 lg:pt-0 border-t border-slate-100 dark:border-slate-800 lg:border-none mt-2 lg:mt-0">
                                {normalizeRequestStatus(req.status) === 'pending' ? (
                                    <div className="flex gap-1.5">
                                        <Can module="attendance.face" action="edit">
                                            <button
                                                onClick={() => handleAction(req._id, 'approved')}
                                                className="p-1.5 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-lg transition shadow-sm"
                                                title="Approve"
                                            >
                                                <CheckCircle size={16} />
                                            </button>
                                        </Can>
                                        <Can module="attendance.face" action="edit">
                                            <button
                                                onClick={() => setRejectionModal({ show: true, requestId: req._id, reason: '' })}
                                                className="p-1.5 text-rose-600 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg transition shadow-sm"
                                                title="Reject"
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        </Can>
                                    </div>
                                ) : (

                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-md">Done</span>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredRequests.length === 0 && (
                        <div className="bg-white dark:bg-slate-900 p-8 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                <AlertCircle className="text-slate-300 dark:text-slate-600" size={24} />
                            </div>
                            <span className="font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-widest">No matching requests found</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Rejection Modal */}
            {rejectionModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setRejectionModal({ show: false, requestId: null, reason: '' })}></div>
                    <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                <XCircle size={20} />
                            </div>
                            <div>
                                <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tight">Reject Request</h2>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Provide a reason below</p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <textarea
                                    value={rejectionModal.reason}
                                    onChange={(e) => setRejectionModal({ ...rejectionModal, reason: e.target.value })}
                                    placeholder="Enter reason for rejection..."
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition h-28 resize-none font-medium text-slate-700 dark:text-slate-200"
                                    autoFocus
                                ></textarea>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setRejectionModal({ show: false, requestId: null, reason: '' })}
                                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-black uppercase text-[10px] tracking-widest transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleAction(rejectionModal.requestId, 'rejected', rejectionModal.reason)}
                                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition shadow-md shadow-rose-500/20"
                                >
                                    Reject
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FaceUpdateRequests;
