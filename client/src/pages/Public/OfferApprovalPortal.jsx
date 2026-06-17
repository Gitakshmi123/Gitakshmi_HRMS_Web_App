// Offer approval portal
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Briefcase,
    Building,
    CalendarDays,
    CheckCircle,
    FileText,
    IndianRupee,
    Loader2,
    Mail,
    MapPin,
    Phone,
    User,
    XCircle
} from 'lucide-react';
import { notification } from 'antd';
import APP_CONFIG from '../../utils/appConfig';

const API_URL = `${APP_CONFIG.HRMS_API_ROOT}/api`;

const formatValue = (value) => {
    if (value === undefined || value === null || value === '') return 'N/A';
    return value;
};

const formatMoney = (value) => {
    if (value === undefined || value === null || value === '') return 'N/A';
    const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
    if (Number.isFinite(numeric) && String(value).replace(/[^0-9]/g, '').length >= 4) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(numeric);
    }
    return String(value);
};

const formatDate = (value) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
};

const DetailRow = ({ icon: Icon, label, value }) => (
    <div className="flex gap-4">
        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 shrink-0">
            <Icon size={18} />
        </div>
        <div className="min-w-0">
            <p className="text-xs text-slate-500 font-medium mb-0.5">{label}</p>
            <p className="font-bold text-slate-900 break-words">{formatValue(value)}</p>
        </div>
    </div>
);

const OfferApprovalPortal = () => {
    const { token } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [actioning, setActioning] = useState(false);
    const [data, setData] = useState(null);
    const [remark, setRemark] = useState('');
    const [actionModal, setActionModal] = useState({ open: false, type: null }); // 'APPROVED' or 'REJECTED'

    useEffect(() => {
        const fetchOfferDetails = async () => {
            try {
                // Since this is public, we don't have interceptors with auth token
                const response = await axios.get(`${API_URL}/public/offer/${token}`);
                
                if (response.data.success) {
                    setData(response.data);
                } else {
                    notification.error({ message: 'Error', description: response.data.message });
                }
            } catch (err) {
                console.error(err);
                notification.error({ 
                    message: 'Access Denied', 
                    description: err.response?.data?.message || 'Invalid or expired magic link.' 
                });
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchOfferDetails();
    }, [token]);

    const handleAction = async () => {
        if (actionModal.type === 'REJECTED' && !remark.trim()) {
            notification.warning({ message: 'Remark Required', description: 'Please provide a reason for rejection.' });
            return;
        }

        setActioning(true);
        try {
            const response = await axios.post(`${API_URL}/public/offer/${token}/action`, {
                action: actionModal.type,
                remark: remark
            });

            if (response.data.success) {
                notification.success({ message: 'Success', description: response.data.message });
                // Update local state to hide buttons
                setData(prev => ({
                    ...prev,
                    assignment: { ...prev.assignment, status: actionModal.type }
                }));
                setActionModal({ open: false, type: null });
            }
        } catch (err) {
            console.error(err);
            notification.error({ 
                message: 'Action Failed', 
                description: err.response?.data?.message || 'Something went wrong.' 
            });
        } finally {
            setActioning(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                    <p className="text-slate-500 font-medium">Verifying Secure Link...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-slate-100">
                    <XCircle className="mx-auto text-rose-500 mb-4" size={56} />
                    <h2 className="text-2xl font-black text-slate-800 mb-2">Link Invalid or Expired</h2>
                    <p className="text-slate-500 mb-6">The approval link you clicked is no longer valid, has expired, or the offer was already actioned.</p>
                </div>
            </div>
        );
    }

    const { candidate, offer, assignment } = data;
    const isPending = assignment.status === 'PENDING';
    const documentUrl = offer?.documentUrl ? offer.documentUrl : `${API_URL}/public/offer/${token}/document`;
    const documentUrlWithToolbar = documentUrl.includes('?') ? `${documentUrl}&toolbar=0` : `${documentUrl}#toolbar=0`;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-500/30">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/20">
                            <CheckCircle size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight leading-none text-slate-900">Offer Approval</h1>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">Secure Portal</p>
                        </div>
                    </div>
                    {isPending ? (
                        <div className="flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full border border-amber-200">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider">Action Required</span>
                        </div>
                    ) : (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${assignment.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            <span className="text-xs font-black uppercase tracking-wider">{assignment.status}</span>
                        </div>
                    )}
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8">
                
                {/* Sidebar Info */}
                <aside className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Workflow Details</h2>
                        
                        <div className="space-y-5">
                            <DetailRow icon={User} label="Candidate" value={candidate?.name} />
                            <DetailRow icon={Building} label="Role" value={candidate?.role} />
                            <DetailRow icon={CheckCircle} label="Your Role" value={assignment.stepName} />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Candidate Information</h2>

                        <div className="space-y-5">
                            <DetailRow icon={Briefcase} label="Designation" value={candidate?.designation || candidate?.role} />
                            <DetailRow icon={Building} label="Department" value={candidate?.department} />
                            <DetailRow icon={IndianRupee} label="Offered CTC" value={formatMoney(candidate?.offeredCtc)} />
                            <DetailRow icon={IndianRupee} label="Monthly Take Home" value={formatMoney(candidate?.takeHomeMonthly)} />
                            <DetailRow icon={CalendarDays} label="Joining Date" value={formatDate(candidate?.joiningDate)} />
                            <DetailRow icon={MapPin} label="Work Location" value={candidate?.workLocation || candidate?.workMode} />
                            <DetailRow icon={Mail} label="Email" value={candidate?.email} />
                            <DetailRow icon={Phone} label="Mobile" value={candidate?.mobile} />
                        </div>
                    </div>

                    {isPending && (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-3">
                            <button 
                                onClick={() => setActionModal({ open: true, type: 'APPROVED' })}
                                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                            >
                                <CheckCircle size={18} />
                                Approve Offer
                            </button>
                            <button 
                                onClick={() => setActionModal({ open: true, type: 'REJECTED' })}
                                className="w-full h-12 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 hover:border-rose-300 rounded-xl font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2"
                            >
                                <XCircle size={18} />
                                Reject
                            </button>
                        </div>
                    )}
                </aside>

                {/* PDF Viewer */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[800px]">
                    <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50/50">
                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                            <FileText size={18} className="text-blue-500" />
                            Offer Document Preview
                        </div>
                        <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-800 underline">
                            Open in new tab
                        </a>
                    </div>
                    <div className="flex-1 bg-slate-100/50 p-4">
                        {offer?.documentAvailable === false ? (
                            <div className="w-full h-full rounded-xl border border-dashed border-slate-300 bg-white shadow-sm flex flex-col items-center justify-center text-center p-8">
                                <FileText size={40} className="text-slate-300 mb-3" />
                                <p className="font-bold text-slate-700">Offer document file is missing</p>
                                <p className="text-sm text-slate-500 mt-1">Please ask HR to regenerate the offer letter.</p>
                            </div>
                        ) : (
                            <iframe
                                src={documentUrlWithToolbar}
                                className="w-full h-full rounded-xl border border-slate-200 bg-white shadow-sm"
                                title="Offer Letter PDF"
                            />
                        )}
                    </div>
                </div>
            </main>

            {/* Action Modal */}
            {actionModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 transform transition-all">
                        <div className={`h-2 w-full ${actionModal.type === 'APPROVED' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        <div className="p-6">
                            <h3 className="text-xl font-black text-slate-800 mb-2">
                                {actionModal.type === 'APPROVED' ? 'Approve Offer' : 'Reject Offer'}
                            </h3>
                            <p className="text-slate-500 text-sm mb-6">
                                {actionModal.type === 'APPROVED' 
                                    ? `You are about to approve the offer for ${candidate?.name}. The document will be forwarded to the next approver in the chain.`
                                    : `You are rejecting the offer for ${candidate?.name}. Please provide a reason below.`}
                            </p>

                            {(actionModal.type === 'REJECTED' || actionModal.type === 'APPROVED') && (
                                <div className="mb-6">
                                    <label className="block text-xs font-bold text-slate-700 mb-2">
                                        Remarks {actionModal.type === 'REJECTED' && <span className="text-rose-500">*</span>}
                                    </label>
                                    <textarea 
                                        className="w-full border border-slate-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                        rows="3"
                                        placeholder={actionModal.type === 'REJECTED' ? "Explain why this offer is rejected..." : "Any additional remarks? (Optional)"}
                                        value={remark}
                                        onChange={(e) => setRemark(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button 
                                    onClick={() => setActionModal({ open: false, type: null })}
                                    className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                                    disabled={actioning}
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleAction}
                                    disabled={actioning}
                                    className={`flex-1 h-11 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-colors
                                        ${actionModal.type === 'APPROVED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                                >
                                    {actioning ? <Loader2 className="animate-spin" size={18} /> : (
                                        actionModal.type === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OfferApprovalPortal;
