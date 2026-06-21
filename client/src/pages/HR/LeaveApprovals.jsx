import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Pagination } from 'antd';
import { notification } from '../../utils/antdGlobal';
import api, { HRMS_API_ROOT } from '../../utils/api';
import {
    Check, X, Eye, AlertCircle, Clock, CheckCircle, FileText,
    RefreshCw, Briefcase, User, Calendar
} from 'lucide-react';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../utils/dateUtils';
import { Can } from '../../components/rbac/PermissionGate';

// Helper to filter balances based on eligibility (e.g. Maternity / Paternity rules)
const filterBalances = (balances, employee) => {
    if (!Array.isArray(balances)) return [];
    if (!employee) return balances;

    const gender = String(employee.gender || '').trim().toLowerCase();
    const maritalStatus = String(employee.maritalStatus || '').trim().toLowerCase();
    const isMarried = ['married', 'मेरेड', 'मेरेડ', 'विवाहित', 'vivahit'].includes(maritalStatus);

    return balances.filter(b => {
        const lt = String(b.leaveType || '').toUpperCase();
        if (lt === 'MATERNITY') {
            return gender === 'female' && isMarried;
        }
        if (lt === 'PATERNITY') {
            return gender === 'male' && isMarried;
        }
        return true;
    });
};

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, iconColor, iconBg }) {
    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
            <div className="flex items-center gap-4 relative z-10">
                <div className={`w-14 h-14 ${iconBg} ${iconColor} rounded-2xl flex items-center justify-center border border-current opacity-20 group-hover:opacity-100 group-hover:bg-current group-hover:text-white transition-all duration-300`}>
                    {icon && React.isValidElement(icon)
                        ? React.cloneElement(icon, { size: 26 })
                        : null}
                </div>
                <div>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                    <h3 className="text-3xl font-black text-slate-900 leading-none">{value}</h3>
                </div>
            </div>
        </div>
    );
}

// ─── Status Chip ───────────────────────────────────────────────────────────────
function StatusChip({ status, meta }) {
    const map = {
        Approved: 'text-emerald-600 bg-emerald-50 border-emerald-100',
        Rejected: 'text-rose-600 bg-rose-50 border-rose-100',
        Pending: 'text-amber-600 bg-amber-50 border-amber-100',
    };
    if (meta?.earlyReturnRequest?.status === 'Pending') {
        return (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border text-purple-600 bg-purple-50 border-purple-100 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-purple-500"></span>
                Return Pending
            </span>
        );
    }
    const style = map[status] || 'bg-slate-50 text-slate-500 border-slate-100';
    const label = status === 'Approved' ? 'Approved' : status === 'Pending' ? 'Pending' : 'Rejected';
    
    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style}`}>
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${status === 'Approved' ? 'bg-emerald-500' : status === 'Pending' ? 'bg-amber-500' : 'bg-rose-500'}`}></span>
            {label}
        </span>
    );
}

// ─── Leave Card (Unified for Desktop and Mobile) ────────────────────────────────
function LeaveCard({ req, onViewReason, onAction, formatDateDDMMYYYY, formatDateTimeDDMMYYYY }) {
    return (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 group flex flex-col space-y-3">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 text-blue-600 flex items-center justify-center text-sm font-black border border-slate-100 group-hover:bg-blue-50 transition-colors">
                        {req.employee?.firstName?.[0]}{req.employee?.lastName?.[0]}
                    </div>
                    <div>
                        <div className="font-bold text-slate-800 text-sm uppercase tracking-tight group-hover:text-blue-600 transition-colors">
                            {req.employee?.firstName} {req.employee?.lastName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">{req.leaveType}</div>
                    </div>
                </div>
                <StatusChip status={req.status} meta={req.meta} />
            </div>

            <div className="grid grid-cols-2 gap-3 py-3 border-y border-slate-100">
                <div>
                    <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Duration</div>
                    <div className="text-xs font-bold text-slate-700 flex flex-col gap-0.5">
                        <span className="flex items-center gap-1.5"><Calendar size={12} className="text-slate-400" />{formatDateDDMMYYYY(req.startDate)}</span>
                        <span className="flex items-center gap-1.5"><Calendar size={12} className="text-slate-400 opacity-0" />{formatDateDDMMYYYY(req.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[11px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            {req.daysCount} {req.daysCount === 1 ? 'day' : 'days'}
                        </span>
                        {Array.isArray(req.employeeBalances) && filterBalances(req.employeeBalances, req.employee).map(b => (
                            <span key={b.leaveType} className="text-[9px] font-black text-slate-505 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-150">
                                {b.leaveType}: {b.available}
                            </span>
                        ))}
                        {req.isHalfDay && (() => {
                            const custom = req.meta?.customHalfDays;
                            if (custom && req.startDate !== req.endDate) {
                                if (custom.firstDayHalf && custom.lastDayHalf) {
                                    return (
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100" title={`First Day: ${custom.firstDaySession}, Last Day: ${custom.lastDaySession}`}>
                                            Half (Both Days)
                                        </span>
                                    );
                                }
                                if (custom.firstDayHalf) {
                                    return (
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100" title={`First Day: ${custom.firstDaySession}`}>
                                            Half (First)
                                        </span>
                                    );
                                }
                                if (custom.lastDayHalf) {
                                    return (
                                        <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100" title={`Last Day: ${custom.lastDaySession}`}>
                                            Half (Last)
                                        </span>
                                    );
                                }
                            }
                            return (
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100" title={`${req.halfDaySession || 'Half Day'}${req.startDate !== req.endDate ? ` on ${req.halfDayTarget === 'End' ? 'Last Day' : 'First Day'}` : ''}`}>
                                    Half {req.startDate !== req.endDate && `(${req.halfDayTarget === 'End' ? 'Last' : 'First'})`}
                                </span>
                            );
                        })()}
                        {req.meta?.earlyReturn && (
                            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100" title={`Originally until ${req.meta.originalEndDate ? formatDateDDMMYYYY(req.meta.originalEndDate) : 'later'}`}>
                                Reduced
                            </span>
                        )}
                        {req.meta?.earlyReturnRequest?.status === 'Pending' && (
                            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 animate-pulse" title={`Requested return date: ${req.meta.earlyReturnRequest.actualReturnDate ? formatDateDDMMYYYY(req.meta.earlyReturnRequest.actualReturnDate) : 'N/A'}`}>
                                Early Return Pending
                            </span>
                        )}
                        {req.medicalCertUrl && (
                            <a
                                href={req.medicalCertUrl.startsWith('http') ? req.medicalCertUrl : `${HRMS_API_ROOT}${req.medicalCertUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 hover:bg-emerald-100 hover:text-emerald-700 transition-all"
                            >
                                <FileText size={12} /> Cert
                            </a>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end text-right">
                    <div className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mb-1">Reason</div>
                    <Can module="leave.requests" action="view">
                        <button
                            onClick={() => onViewReason(req.meta?.earlyReturnRequest?.status === 'Pending' ? `Early Return Requested\nActual Return Date: ${req.meta.earlyReturnRequest.actualReturnDate ? formatDateDDMMYYYY(req.meta.earlyReturnRequest.actualReturnDate) : ''}\nReason: ${req.meta.earlyReturnRequest.reason || ''}\nComments: ${req.meta.earlyReturnRequest.comments || ''}` : req.reason)}
                            className="text-[11px] font-bold text-blue-600 hover:text-white hover:bg-blue-600 border border-blue-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 active:scale-95"
                        >
                            <Eye size={12} /> View
                        </button>
                    </Can>
                </div>
            </div>

            {req.status === 'Pending' || req.meta?.earlyReturnRequest?.status === 'Pending' ? (
                <div className="flex gap-2 pt-1">
                    <Can module="leave.requests" action="edit">
                        <button
                            onClick={() => onAction({ id: req._id, type: 'approve', req })}
                            className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm hover:bg-emerald-600 hover:shadow-emerald-500/25 active:scale-95 transition-all"
                        >
                            <Check size={14} strokeWidth={3} /> Approve
                        </button>
                    </Can>
                    <Can module="leave.requests" action="edit">
                        <button
                            onClick={() => onAction({ id: req._id, type: 'reject', req })}
                            className="flex-1 py-2.5 bg-white text-rose-500 border border-rose-200 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-600 active:scale-95 transition-all"
                        >
                            <X size={14} strokeWidth={3} /> Reject
                        </button>
                    </Can>
                </div>
            ) : (
                <div className="text-[11px] text-slate-400 font-bold text-center py-2 bg-slate-50 rounded-xl uppercase tracking-widest">
                    Processed {req.actionDateTime && `· ${formatDateTimeDDMMYYYY(req.actionDateTime).split(' ')[0]}`}
                </div>
            )}
        </div>
    );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
export default function LeaveApprovals({
    isManagerView = false,
    endpoint = '/hr/leaves/requests',
    actionEndpoint = '/hr/leaves/requests'
}) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

    const [viewReason, setViewReason] = useState(null);
    const [actionModal, setActionModal] = useState(null);
    const [remark, setRemark] = useState('');
    const [snapshot, setSnapshot] = useState(null);
    const [snapshotLoading, setSnapshotLoading] = useState(false);
    
    // Partial Approval State
    const [approvalDates, setApprovalDates] = useState({
        startDate: '',
        endDate: '',
        isHalfDay: false,
        halfDayTarget: 'Start',
        halfDaySession: 'First Half'
    });

    useEffect(() => {
        if (!actionModal || !actionModal.req) {
            setSnapshot(null);
            return;
        }
        const fetchSnapshot = async () => {
            setSnapshotLoading(true);
            try {
                const req = actionModal.req;
                const employeeId = req.employee?._id || req.employee;
                const startDate = req.startDate ? req.startDate.split('T')[0] : '';
                const endDate = req.endDate ? req.endDate.split('T')[0] : '';
                const res = await api.get('/employee/leaves/workforce-visibility', {
                    params: {
                        employeeId,
                        startDate,
                        endDate
                    }
                });
                if (res.data?.success && res.data?.snapshot) {
                    setSnapshot(res.data.snapshot);
                }
            } catch (err) {
                console.error("Failed to fetch workforce snapshot for manager:", err);
            } finally {
                setSnapshotLoading(false);
            }
        };
        fetchSnapshot();
    }, [actionModal]);

    useEffect(() => {
        fetchRequests(pagination.page);
    }, [pagination.page, endpoint]);

    const fetchRequests = async (page = 1) => {
        setLoading(true);
        try {
            const sep = endpoint.includes('?') ? '&' : '?';
            const res = await api.get(`${endpoint}${sep}page=${page}&limit=${pagination.limit}`);
            if (res.data.data) {
                setRequests(res.data.data);
                setPagination(prev => ({ ...prev, ...res.data.meta }));
            } else {
                setRequests(res.data);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleActionSubmit = async () => {
        if (!actionModal) return;
        if (!remark.trim()) {
            notification.error({ message: 'Error', description: 'Remark is mandatory.', placement: 'topRight' });
            return;
        }
        try {
            const body = { 
                remark, 
                rejectionReason: remark,
                ... (actionModal.type === 'approve' ? approvalDates : {})
            };
            await api.post(`${actionEndpoint}/${actionModal.id}/${actionModal.type}`, body);
            notification.success({
                message: 'Success',
                description: `Request ${actionModal.type === 'approve' ? 'Approved' : 'Rejected'} Successfully`,
                placement: 'topRight'
            });
            setActionModal(null);
            setRemark('');
            fetchRequests(pagination.page);
        } catch (err) {
            notification.error({
                message: 'Action Failed',
                description: err.response?.data?.error || 'An error occurred',
                placement: 'topRight'
            });
        }
    };

    const openAction = (modal) => {
        setActionModal(modal);
        setRemark('');
        if (modal.type === 'approve' && modal.req) {
            const req = modal.req;
            setApprovalDates({
                startDate: req.startDate ? req.startDate.split('T')[0] : '',
                endDate: req.endDate ? req.endDate.split('T')[0] : '',
                isHalfDay: !!req.isHalfDay,
                halfDayTarget: req.halfDayTarget || 'Start',
                halfDaySession: req.halfDaySession || 'First Half'
            });
        }
    };

    const pending = requests.filter(r => r.status === 'Pending' || r.meta?.earlyReturnRequest?.status === 'Pending').length;
    const approved = requests.filter(r => r.status === 'Approved').length;

    return (
        <div className="space-y-6 p-2.5 animate-in fade-in duration-500">

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                        Leave Approvals
                    </h1>
                </div>
                <button
                    onClick={() => fetchRequests(pagination.page)}
                    disabled={loading}
                    className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2 group active:scale-95 disabled:opacity-50"
                >
                    <RefreshCw size={14} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    Sync Data
                </button>
            </div>

            {/* Stats */}
            {!isManagerView && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Total Requests" value={pagination.total} icon={<FileText />} iconColor="text-blue-600" iconBg="bg-blue-50" />
                    <StatCard label="Pending Action" value={pending} icon={<Clock />} iconColor="text-amber-600" iconBg="bg-amber-50" />
                    <StatCard label="Approved" value={approved} icon={<CheckCircle />} iconColor="text-emerald-600" iconBg="bg-emerald-50" />
                </div>
            )}

            {/* Request Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee & ID</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Leave Type</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Leave Balance</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Duration</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Days</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Reason</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="p-20 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Fetching requests...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-20 text-center">
                                        <div className="flex flex-col items-center justify-center gap-4">
                                            <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100">
                                                <Briefcase size={32} />
                                            </div>
                                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">No leave requests pending for process</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                requests.map(req => (
                                    <tr key={req._id} className="hover:bg-slate-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-blue-600 flex items-center justify-center text-xs font-black border border-slate-100 group-hover:bg-blue-50 transition-colors overflow-hidden">
                                                    {req.employee?.profilePic ? (
                                                        <>
                                                            <img 
                                                                src={req.employee.profilePic.startsWith('http') ? req.employee.profilePic : `${HRMS_API_ROOT}/${req.employee.profilePic}`} 
                                                                alt="" 
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    if (e.target.nextElementSibling) {
                                                                        e.target.nextElementSibling.style.display = 'flex';
                                                                    }
                                                                }}
                                                            />
                                                            <span style={{ display: 'none' }} className="w-full h-full items-center justify-center">
                                                                {req.employee?.firstName?.[0] || '?'}{req.employee?.lastName?.[0] || ''}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span>{req.employee?.firstName?.[0] || '?'}{req.employee?.lastName?.[0] || ''}</span>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-[13px] uppercase tracking-tight group-hover:text-blue-600 transition-colors leading-none mb-1">
                                                        {req.employee?.firstName} {req.employee?.lastName}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                        {req.employee?.employeeId || req.employee?.empId || req.employee?.id || (req.employee?._id ? `ID:${String(req.employee._id).substring(0,6)}` : 'EMP-N/A')}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{req.leaveType}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1 max-w-[240px]">
                                                {Array.isArray(req.employeeBalances) && filterBalances(req.employeeBalances, req.employee).length > 0 ? (
                                                    filterBalances(req.employeeBalances, req.employee).map(b => (
                                                        <span key={b.leaveType} className="px-1.5 py-0.5 bg-slate-50 border border-slate-150 rounded text-[9px] text-slate-500 font-bold whitespace-nowrap">
                                                            {b.leaveType}: <span className="font-extrabold text-slate-800">{b.available}</span>
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 font-bold">—</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-[12px] font-bold text-slate-700 tracking-tight">
                                                <Calendar size={13} className="text-slate-400" />
                                                <span>{formatDateDDMMYYYY(req.startDate)}</span>
                                                <span className="text-slate-300 text-[10px] font-black uppercase tracking-tighter mx-1">to</span>
                                                <span>{formatDateDDMMYYYY(req.endDate)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100 shadow-sm shadow-blue-500/5 min-w-[50px]">
                                                    {req.daysCount} {req.daysCount === 1 ? 'day' : 'days'}
                                                </span>
                                                {req.isHalfDay && (() => {
                                                     const custom = req.meta?.customHalfDays;
                                                     if (custom && req.startDate !== req.endDate) {
                                                         if (custom.firstDayHalf && custom.lastDayHalf) {
                                                             return (
                                                                 <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest" title={`First Day: ${custom.firstDaySession}, Last Day: ${custom.lastDaySession}`}>
                                                                     Half (Both Days)
                                                                 </span>
                                                             );
                                                         }
                                                         if (custom.firstDayHalf) {
                                                             return (
                                                                 <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest" title={`First Day: ${custom.firstDaySession}`}>
                                                                     Half (First)
                                                                 </span>
                                                             );
                                                         }
                                                         if (custom.lastDayHalf) {
                                                             return (
                                                                 <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest" title={`Last Day: ${custom.lastDaySession}`}>
                                                                     Half (Last)
                                                                 </span>
                                                             );
                                                         }
                                                     }
                                                     return (
                                                         <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest" title={`${req.halfDaySession || 'Half Day'}${req.startDate !== req.endDate ? ` on ${req.halfDayTarget === 'End' ? 'Last Day' : 'First Day'}` : ''}`}>
                                                             Half {req.startDate !== req.endDate && `(${req.halfDayTarget === 'End' ? 'Last' : 'First'})`}
                                                         </span>
                                                     );
                                                 })()}
                                                {req.medicalCertUrl && (
                                                    <a 
                                                        href={req.medicalCertUrl.startsWith('http') ? req.medicalCertUrl : `${HRMS_API_ROOT}${req.medicalCertUrl}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 mt-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100 transition-all select-none active:scale-95 shadow-sm"
                                                        title="Click to view medical certificate"
                                                    >
                                                        <FileText size={10} /> Cert
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Can module="leave.requests" action="view">
                                                <button
                                                    onClick={() => setViewReason(req.meta?.earlyReturnRequest?.status === 'Pending' ? `Early Return Requested\nActual Return Date: ${req.meta.earlyReturnRequest.actualReturnDate ? formatDateDDMMYYYY(req.meta.earlyReturnRequest.actualReturnDate) : ''}\nReason: ${req.meta.earlyReturnRequest.reason || ''}\nComments: ${req.meta.earlyReturnRequest.comments || ''}` : req.reason)}
                                                    className="w-8 h-8 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center mx-auto border border-transparent hover:border-blue-100"
                                                    title="View Reason"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </Can>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusChip status={req.status} meta={req.meta} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                {req.status === 'Pending' || req.meta?.earlyReturnRequest?.status === 'Pending' ? (
                                                    <>
                                                        <Can module="leave.requests" action="edit">
                                                            <button
                                                                onClick={() => openAction({ id: req._id, type: 'approve', req })}
                                                                className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center border border-emerald-100 hover:border-emerald-500 shadow-sm shadow-emerald-500/10 active:scale-90"
                                                                title="Approve"
                                                            >
                                                                <Check size={16} strokeWidth={3} />
                                                            </button>
                                                        </Can>
                                                        <Can module="leave.requests" action="edit">
                                                            <button
                                                                onClick={() => openAction({ id: req._id, type: 'reject', req })}
                                                                className="w-8 h-8 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center border border-rose-100 hover:border-rose-500 shadow-sm shadow-rose-500/10 active:scale-90"
                                                                title="Reject"
                                                            >
                                                                <X size={16} strokeWidth={3} />
                                                            </button>
                                                        </Can>
                                                    </>
                                                ) : (
                                                    <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                        {req.actionDateTime && formatDateTimeDDMMYYYY(req.actionDateTime).split(' ')[0]}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
                <div className="flex justify-center pt-4">
                    <Pagination
                        current={pagination.page}
                        pageSize={pagination.limit}
                        total={pagination.total}
                        onChange={(page) => setPagination(prev => ({ ...prev, page }))}
                        showSizeChanger={false}
                        size="default"
                    />
                </div>
            )}

            {/* View Reason Modal */}
            {viewReason !== null && createPortal(
                <div className="fixed inset-0 z-[29] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="absolute inset-0" onClick={() => setViewReason(null)} />
                    <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Leave Reason</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Provided by Employee</p>
                            </div>
                            <button
                                onClick={() => setViewReason(null)}
                                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="bg-white p-6 rounded-2xl text-[14px] text-slate-700 min-h-[140px] whitespace-pre-wrap border border-slate-100 font-medium leading-relaxed italic relative">
                                <span className="absolute -top-3 left-4 text-4xl text-slate-200 font-serif">&ldquo;</span>
                                {viewReason || 'No detailed reason was provided for this application.'}
                                <span className="absolute -bottom-6 right-4 text-4xl text-slate-200 font-serif">&rdquo;</span>
                            </div>
                            <div className="mt-8">
                                <button
                                    onClick={() => setViewReason(null)}
                                    className="w-full py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition shadow-lg active:scale-95"
                                >
                                    Acknowledge
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Action Confirmation Modal */}
            {actionModal && createPortal(
                <div className="fixed inset-0 z-[29] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="absolute inset-0" onClick={() => setActionModal(null)} />
                    <div className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-5 animate-in zoom-in-95 duration-200 max-h-[95vh] overflow-y-auto">

                        {/* Partial Approval Controls */}
                        {actionModal.type === 'approve' && actionModal.req?.meta?.earlyReturnRequest?.status !== 'Pending' && (
                            <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-5 mb-6 space-y-4">
                                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b border-blue-100 pb-2 mb-3 flex items-center gap-2">
                                    <Calendar size={12} /> Approved Duration Override
                                </p>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</label>
                                        <input 
                                            type="date"
                                            value={approvalDates.startDate}
                                            onChange={e => setApprovalDates({ ...approvalDates, startDate: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Date</label>
                                        <input 
                                            type="date"
                                            value={approvalDates.endDate}
                                            onChange={e => setApprovalDates({ ...approvalDates, endDate: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition"
                                        />
                                    </div>
                                    <div className="pb-2.5">
                                        <label className="flex items-center gap-2 cursor-pointer group">
                                            <input 
                                                type="checkbox"
                                                checked={approvalDates.isHalfDay}
                                                onChange={e => setApprovalDates({ ...approvalDates, isHalfDay: e.target.checked })}
                                                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight group-hover:text-blue-600 transition-colors leading-none">Half Day</span>
                                        </label>
                                    </div>
                                </div>

                                {approvalDates.isHalfDay && (
                                    <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target</label>
                                            <select 
                                                value={approvalDates.halfDayTarget}
                                                onChange={e => setApprovalDates({ ...approvalDates, halfDayTarget: e.target.value })}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition"
                                            >
                                                <option value="Start">Start Date</option>
                                                <option value="End">End Date</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Session</label>
                                            <select 
                                                value={approvalDates.halfDaySession}
                                                onChange={e => setApprovalDates({ ...approvalDates, halfDaySession: e.target.value })}
                                                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-blue-500 transition"
                                            >
                                                <option value="First Half">First Half</option>
                                                <option value="Second Half">Second Half</option>
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {actionModal.type === 'approve' && actionModal.req?.meta?.earlyReturnRequest?.status === 'Pending' && (
                            <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5 mb-6 space-y-3">
                                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest border-b border-purple-100 pb-2 mb-2 flex items-center gap-2">
                                    <Calendar size={12} /> Early Return Request Details
                                </p>
                                <div className="text-xs space-y-2">
                                    <div>
                                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">Actual Return Date</span>
                                        <span className="text-slate-800 font-bold">{formatDateDDMMYYYY(actionModal.req.meta.earlyReturnRequest.actualReturnDate)}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">Reason</span>
                                        <span className="text-slate-800 font-semibold">{actionModal.req.meta.earlyReturnRequest.reason}</span>
                                    </div>
                                    {actionModal.req.meta.earlyReturnRequest.comments && (
                                        <div>
                                            <span className="font-bold text-slate-500 uppercase tracking-wider text-[9px] block">Comments</span>
                                            <span className="text-slate-800 font-normal italic">{actionModal.req.meta.earlyReturnRequest.comments}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Workforce Availability Snapshot */}
                        {actionModal.req && (
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 space-y-4 text-left">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-105 pb-2 flex items-center justify-between">
                                    <span>Workforce Impact Details</span>
                                    {snapshotLoading ? (
                                        <span className="text-[8px] text-slate-400 animate-pulse">Analyzing...</span>
                                    ) : (
                                        <span className="text-[8px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-black">Live Info</span>
                                    )}
                                </p>

                                {snapshotLoading ? (
                                    <div className="py-4 text-center">
                                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Loading availability...</p>
                                    </div>
                                ) : snapshot ? (
                                    <div className="space-y-3">
                                        {/* Headcounts */}
                                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                                            <div className="bg-white p-2 rounded-xl border border-slate-100">
                                                <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Team Strength</span>
                                                <span className="font-semibold text-slate-700">{snapshot.teamStrength}</span>
                                            </div>
                                            <div className="bg-white p-2 rounded-xl border border-slate-105">
                                                <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Overlap Leaves</span>
                                                <span className="font-semibold text-slate-700">
                                                    {snapshot.alreadyOnLeave.length + snapshot.pendingLeaves.length}
                                                </span>
                                            </div>
                                            <div className={`p-2 rounded-xl border ${snapshot.available <= 1 ? "bg-rose-50/20 border-rose-100" : "bg-emerald-50/20 border-emerald-100"}`}>
                                                <span className="text-[8px] font-bold text-slate-400 block mb-0.5">Available Headcount</span>
                                                <span className={`font-bold ${snapshot.available <= 1 ? "text-rose-600" : "text-emerald-600"}`}>
                                                    {snapshot.available}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Critical alert */}
                                        {snapshot.isCritical && (
                                            <div className="flex items-start gap-2 bg-rose-50 p-3 rounded-xl border border-rose-100 text-left">
                                                <AlertCircle size={14} className="text-rose-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-black text-rose-700 uppercase tracking-wide leading-none">Critical Resource Alert</p>
                                                    <p className="text-[9px] text-rose-600 font-medium mt-1 leading-normal">
                                                        This employee is the only active team member with their designation in the department.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Overlap details */}
                                        {(snapshot.alreadyOnLeave.length > 0 || snapshot.pendingLeaves.length > 0) && (
                                            <div className="flex items-start gap-2 bg-amber-50 p-3 rounded-xl border border-amber-100 text-left">
                                                <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <p className="text-[10px] font-black text-amber-700 uppercase tracking-wide leading-none font-inter">Overlap Warnings</p>
                                                    <div className="text-[9px] text-amber-750 font-medium mt-2 leading-relaxed">
                                                        {snapshot.alreadyOnLeave.length > 0 && (
                                                            <div>
                                                                Approved: <span className="font-semibold">{snapshot.alreadyOnLeave.map(l => `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim()).join(', ')}</span>
                                                            </div>
                                                        )}
                                                        {snapshot.pendingLeaves.length > 0 && (
                                                            <div className="mt-1">
                                                                Pending: <span className="font-semibold">{snapshot.pendingLeaves.map(l => `${l.employee?.firstName || ''} ${l.employee?.lastName || ''}`.trim()).join(', ')}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-400 font-semibold text-center py-2">No availability data retrieved.</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-2 mb-8">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Admin Remark <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                value={remark}
                                onChange={(e) => setRemark(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[13px] font-bold text-slate-700 outline-none focus:border-blue-500 transition min-h-[100px] resize-none"
                                placeholder={actionModal.type === 'approve' ? "Approved as per discussion..." : "Reason for rejection..."}
                            />
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setActionModal(null)}
                                className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition active:scale-95"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleActionSubmit}
                                className={`flex-1 py-3 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 ${actionModal.type === 'approve' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/25' : 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/25'}`}
                            >
                                {actionModal.type === 'approve' ? 'Approve' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
