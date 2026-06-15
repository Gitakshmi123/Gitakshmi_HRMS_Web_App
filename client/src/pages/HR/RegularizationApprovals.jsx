import React, { useState, useEffect } from 'react';
import { Pagination } from 'antd';
import api from '../../utils/api';
import { Eye, CheckSquare, XSquare, Clock, ArrowRight, X, AlertCircle } from 'lucide-react';
import { formatDateDDMMYYYY } from '../../utils/dateUtils';
import { Can } from '../../components/rbac/PermissionGate';

export default function RegularizationApprovals({
    isManagerView = false,
    category = 'Attendance', // 'Attendance' | 'Leave'
    endpoint = '/hr/regularization',
    actionEndpoint = '/hr/regularization'
}) {
    const [requests, setRequests] = useState([]);
    const [actionModal, setActionModal] = useState(null); // { id, action: 'approve' | 'reject' }
    const [viewData, setViewData] = useState(null);
    const [remark, setRemark] = useState('');
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // RBAC Context for dynamic module selection
    const rbacModule = category === 'Leave' ? 'leave.requests' : 'attendance.dashboard';

    useEffect(() => {
        fetchData();
    }, [endpoint, category]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Append category filter to endpoint
            const url = endpoint.includes('?')
                ? `${endpoint}&category=${category}`
                : `${endpoint}?category=${category}`;
            const res = await api.get(url);
            setRequests(res.data.data || res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async () => {
        if (!remark.trim()) return alert("Admin remark is mandatory.");
        try {
            await api.post(`${actionEndpoint}/${actionModal.id}/${actionModal.action}`, { remark });
            setActionModal(null);
            setRemark('');
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || "Action Failed");
        }
    };

    const getStatusStyle = (status) => {
        switch (status) {
            case 'Approved': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
            case 'Rejected': return 'bg-red-100 dark:bg-rose-900/30 text-red-800 dark:text-rose-400 border-red-200 dark:border-rose-800';
            default: return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 border-amber-200 dark:border-amber-800';
        }
    };

    return (
        <div className="p-2.5 space-y-6 text-slate-900 dark:text-white">
            {!isManagerView && (
                <div className="relative glass-morphism p-6 sm:p-8 rounded-[32px] border border-white/10 dark:border-white/5 shadow-3xl overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 group">
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500/50 via-indigo-500/50 to-rose-500/50 pointer-events-none"></div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-1.5 h-6 bg-indigo-500 rounded-full animate-pulse"></div>
                            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-[0.1em] sm:tracking-[0.2em] uppercase glow-text-indigo">
                                {category === 'Attendance' ? 'Attendance_Correction' : 'Balance_Adjustment'}
                            </h1>
                        </div>
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4.5 opacity-80">
                            {category === 'Attendance' ? 'Protocol Monitoring: Punch Overrides' : 'Operational Audit: Leave Balancing'}
                        </p>
                    </div>
                    <div className="absolute inset-0 hud-scanline opacity-[0.03] pointer-events-none"></div>
                </div>
            )}

            <div className="glass-morphism rounded-[32px] border border-white/10 dark:border-white/5 shadow-3xl overflow-hidden relative">
                <div className="absolute inset-0 hud-scanline opacity-[0.02] pointer-events-none"></div>
                <div className="overflow-x-auto hidden lg:block">
                    <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-950 text-slate-400 uppercase font-black text-[10px] tracking-widest">
                            <tr>
                                <th className="px-6 py-6 text-left text-[9px] font-black uppercase tracking-[0.3em] opacity-60">Log_Subject</th>
                                <th className="px-6 py-6 text-left text-[9px] font-black uppercase tracking-[0.3em] opacity-60">Temporal_ID</th>
                                <th className="px-6 py-6 text-left text-[9px] font-black uppercase tracking-[0.3em] opacity-60">Incident_Type</th>
                                <th className="px-6 py-6 text-center text-[9px] font-black uppercase tracking-[0.3em] opacity-60">Status</th>
                                <th className="px-6 py-6 text-right text-[9px] font-black uppercase tracking-[0.3em] opacity-60">Operations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800 bg-white dark:bg-slate-900">
                            {loading ? (
                                <tr><td colSpan="5" className="text-center py-20 text-slate-300 dark:text-slate-600 font-black uppercase tracking-widest text-[10px]">Loading pending requests...</td></tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 opacity-20 dark:opacity-40">
                                            <Clock size={48} />
                                            <p className="font-black uppercase tracking-widest text-xs">No pending {category} approvals</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                requests.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(req => (
                                    <tr key={req._id} className="hover:bg-indigo-500/[0.02] transition-all duration-300 whitespace-nowrap group">
                                        <td className="px-6 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-[14px] bg-slate-100 dark:bg-white/5 text-indigo-500 flex items-center justify-center text-xs font-black border border-slate-200 dark:border-white/10 shadow-sm group-hover:scale-110 transition-transform">
                                                    {req.employee?.firstName?.[0]}{req.employee?.lastName?.[0]}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.1em] group-hover:text-indigo-500 transition-colors">
                                                        {req.employee?.firstName} {req.employee?.lastName}
                                                    </span>
                                                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1 opacity-60">
                                                        ID: {req.employee?.employeeId}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-[0.1em]">
                                                {formatDateDDMMYYYY(req.startDate)}
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                                <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                                                {req.issueType}
                                            </div>
                                            <div className="text-[9px] text-slate-400 font-black mt-2 italic tracking-tight opacity-60 max-w-[180px] truncate" title={req.reason}>"{req.reason}"</div>
                                        </td>
                                        <td className="px-6 py-6 text-center">
                                            <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] border shadow-sm backdrop-blur-md ${
                                                req.status === 'Approved' ? 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' :
                                                req.status === 'Rejected' ? 'text-rose-500 bg-rose-500/10 border-rose-500/20' :
                                                'text-amber-500 bg-amber-500/10 border-amber-500/20'
                                            }`}>
                                                {req.status === 'Approved' ? 'VALIDATED' : req.status === 'Rejected' ? 'RESTRICTED' : 'IN_PROCESS'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6 text-right">
                                            <div className="flex justify-end gap-2 pr-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                                <Can module={rbacModule} action="view">
                                                    <button onClick={() => setViewData(req)} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-indigo-500 border border-slate-200 dark:border-white/10 hover:border-indigo-500/30 transition-all shadow-md active:scale-90" title="Inspect_Source">
                                                        <Eye size={16} />
                                                    </button>
                                                </Can>
                                                {req.status === 'Pending' && (
                                                    <>
                                                        <Can module={rbacModule} action="edit">
                                                            <button onClick={() => setActionModal({ id: req._id, action: 'approve' })} className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500 hover:text-white border border-indigo-500/20 transition-all shadow-md active:scale-90" title="Commit_Approval">
                                                                <CheckSquare size={16} />
                                                            </button>
                                                        </Can>
                                                        <Can module={rbacModule} action="edit">
                                                            <button onClick={() => setActionModal({ id: req._id, action: 'reject' })} className="w-9 h-9 flex items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-100 transition-all shadow-md active:scale-90" title="Nullify_Request">
                                                                <XSquare size={16} />
                                                            </button>
                                                        </Can>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Grid */}
                <div className="lg:hidden p-4 space-y-4">
                    {loading ? (
                        <div className="text-center py-10 text-slate-300 dark:text-slate-600 font-black uppercase tracking-widest text-[10px]">Loading...</div>
                    ) : requests.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-10 opacity-20 dark:opacity-40">
                            <Clock size={32} />
                            <p className="font-black uppercase tracking-widest text-[10px]">No pending approvals</p>
                        </div>
                    ) : (
                        requests.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(req => (
                            <div key={req._id} className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-white/5 p-5 space-y-4 shadow-sm">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-white/5 text-indigo-500 flex items-center justify-center text-[10px] font-black border border-slate-100 dark:border-white/10">
                                            {req.employee?.firstName?.[0]}{req.employee?.lastName?.[0]}
                                        </div>
                                        <div>
                                            <div className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-wider">{req.employee?.firstName} {req.employee?.lastName}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{req.issueType}</div>
                                        </div>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                        req.status === 'Approved' ? 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' :
                                        req.status === 'Rejected' ? 'text-rose-500 bg-rose-500/10 border-rose-500/20' :
                                        'text-amber-500 bg-amber-500/10 border-amber-500/20'
                                    }`}>
                                        {req.status === 'Approved' ? 'VALIDATED' : req.status === 'Rejected' ? 'RESTRICTED' : 'IN_PROCESS'}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50 dark:border-white/5">
                                    <div>
                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Date</div>
                                        <div className="text-[10px] font-black text-slate-700 dark:text-slate-300">{formatDateDDMMYYYY(req.startDate)}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Source</div>
                                        <button onClick={() => setViewData(req)} className="text-[10px] font-black text-indigo-500 hover:underline uppercase">View Reason</button>
                                    </div>
                                </div>
                                {req.status === 'Pending' && (
                                    <div className="flex gap-2 pt-1">
                                        <Can module={rbacModule} action="edit">
                                            <button onClick={() => setActionModal({ id: req._id, action: 'approve' })} className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">Approve</button>
                                        </Can>
                                        <Can module={rbacModule} action="edit">
                                            <button onClick={() => setActionModal({ id: req._id, action: 'reject' })} className="flex-1 py-2.5 bg-white dark:bg-slate-800 text-rose-500 border border-rose-100 dark:border-rose-900/30 rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Reject</button>
                                        </Can>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
                {requests.length > pageSize && (
                    <div className="px-8 py-5 border-t border-slate-50 dark:border-slate-800 flex justify-end">
                        <Pagination
                            current={currentPage}
                            pageSize={pageSize}
                            total={requests.length}
                            onChange={(page) => setCurrentPage(page)}
                            showSizeChanger={false}
                        />
                    </div>
                )}
            </div>

            {/* View Details Modal */}
            {viewData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl max-w-2xl w-full p-10 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-start mb-10">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${viewData.category === 'Attendance' ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'}`}>
                                        {viewData.category} Request
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#{String(viewData._id || '').slice(-6)}</span>
                                </div>
                                <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Request Details</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Submitted on {new Date(viewData.createdAt).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => setViewData(null)} className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-2xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition border border-slate-100">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="space-y-8">
                            <div className="flex items-start gap-4 p-6 bg-white dark:bg-slate-950 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-inner">
                                <AlertCircle className="text-blue-500 shrink-0 mt-1" size={24} />
                                <div>
                                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Employee Justification</h3>
                                    <p className="text-slate-700 dark:text-slate-300 text-base font-bold leading-relaxed italic">"{viewData.reason}"</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-sm">
                                    <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Original Snapshot</h3>
                                    {viewData.originalData ? (
                                        <div className="space-y-3">
                                            {viewData.category === 'Attendance' ? (
                                                <>
                                                    <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/50">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Status</span>
                                                        <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">{viewData.originalData.attendance?.status || 'N/A'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/50">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Clock In</span>
                                                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{viewData.originalData.attendance?.checkIn ? new Date(viewData.originalData.attendance.checkIn).toLocaleTimeString() : '-'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-slate-800/50">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Clock Out</span>
                                                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{viewData.originalData.attendance?.checkOut ? new Date(viewData.originalData.attendance.checkOut).toLocaleTimeString() : '-'}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="text-xs font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                                                    Original Leave Type: {viewData.requestedData?.originalLeaveType || 'Missed Application'}
                                                </div>
                                            )}
                                        </div>
                                    ) : <div className="text-xs text-slate-400 italic">No snapshot recorded</div>}
                                </div>

                                <div className="p-6 bg-blue-50/30 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/30 rounded-[2.5rem] shadow-sm relative overflow-hidden">
                                    <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none transform rotate-12">
                                        <ArrowRight size={120} />
                                    </div>
                                    <h3 className="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        Requested Correction <ArrowRight size={12} />
                                    </h3>
                                    <div className="space-y-3">
                                        {viewData.category === 'Attendance' ? (
                                            <>
                                                <div className="flex justify-between items-center py-2 border-b border-blue-100/30 dark:border-blue-800/20">
                                                    <span className="text-[10px] font-black text-blue-400 uppercase">Corrected In</span>
                                                    <span className="text-xs font-black text-blue-700 dark:text-blue-300">{viewData.requestedData?.checkIn ? viewData.requestedData.checkIn.split('T')[1].slice(0, 5) : '-'}</span>
                                                </div>
                                                <div className="flex justify-between items-center py-2 border-b border-blue-100/30 dark:border-blue-800/20">
                                                    <span className="text-[10px] font-black text-blue-400 uppercase">Corrected Out</span>
                                                    <span className="text-xs font-black text-blue-700 dark:text-blue-300">{viewData.requestedData?.checkOut ? viewData.requestedData.checkOut.split('T')[1].slice(0, 5) : '-'}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="p-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-blue-100 dark:border-blue-900/50">
                                                <div className="text-[9px] font-black text-blue-400 uppercase tracking-widest mb-1">Target Leave Type</div>
                                                <div className="text-xl font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter">
                                                    {viewData.requestedData?.requestedLeaveType || 'N/A'}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 flex justify-end gap-x-4">
                            <button onClick={() => setViewData(null)} className="px-10 py-4 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition shadow-xl shadow-slate-200/50 dark:shadow-none active:scale-95">Close View</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Modal */}
            {actionModal && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[110] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl max-w-md w-full p-10 animate-in fade-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800">
                        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-xl ${actionModal.action === 'approve' ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-rose-500 text-white shadow-rose-500/20'}`}>
                            {actionModal.action === 'approve' ? <CheckSquare size={32} /> : <XSquare size={32} />}
                        </div>
                        <h3 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-2">{actionModal.action} Request?</h3>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed mb-8">This action will modify {category.toLowerCase()} records in the database. A professional remark is mandatory for audit trails.</p>

                        <textarea
                            className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none min-h-[140px] dark:text-white transition-all placeholder:text-slate-300"
                            placeholder="Enter administrative remark for audit..."
                            value={remark}
                            onChange={(e) => setRemark(e.target.value)}
                            autoFocus
                        ></textarea>

                        <div className="flex gap-4 mt-8">
                            <button onClick={() => setActionModal(null)} className="flex-1 py-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-50 transition active:scale-95">Cancel</button>
                            <button onClick={handleAction} className={`flex-1 py-4 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition shadow-xl active:scale-95 ${actionModal.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'}`}>
                                Confirm {actionModal.action}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
