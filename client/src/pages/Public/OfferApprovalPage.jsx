import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import APP_CONFIG from '../../utils/appConfig';

export default function OfferApprovalPage() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const tenantId = searchParams.get('tenantId');

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [details, setDetails] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);

    // Rejection state
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');

    // Approve confirmation state
    const [showApproveModal, setShowApproveModal] = useState(false);

    const API_BASE = `${APP_CONFIG.HRMS_API_ROOT}/api`;

    useEffect(() => {
        if (!id || !tenantId) {
            setError("Invalid link. Missing letter identification or tenant information.");
            setLoading(false);
            return;
        }

        const fetchDetails = async () => {
            try {
                const res = await axios.get(`${API_BASE}/public/letters/${id}/details`, {
                    params: { tenantId }
                });
                if (res.data.success) {
                    setDetails(res.data);
                } else {
                    setError(res.data.message || "Failed to load offer letter details.");
                }
            } catch (err) {
                console.error(err);
                setError(err.response?.data?.message || err.message || "Error loading page.");
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [id, tenantId]);

    const handleApprove = async () => {
        setSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE}/public/letters/${id}/approve`, {
                tenantId
            });
            if (res.data.success) {
                const completed = res.data?.data?.completed !== false;
                setSuccessMessage(res.data.message || (completed
                    ? "Offer letter approved successfully! The candidate has been notified and sent the final offer."
                    : "Approval recorded successfully. The offer has moved to the next approver."));
                if (details?.letter) {
                    setDetails({
                        ...details,
                        letter: { ...details.letter, status: completed ? 'approved' : 'pending' }
                    });
                }
                setShowApproveModal(false);
            } else {
                alert(res.data.message || "Failed to approve offer.");
            }
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || err.message || "Error approving offer.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!rejectionReason.trim()) {
            alert("Please provide a reason for rejection.");
            return;
        }
        setSubmitting(true);
        try {
            const res = await axios.post(`${API_BASE}/public/letters/${id}/reject`, {
                tenantId,
                rejectionReason
            });
            if (res.data.success) {
                setSuccessMessage("Offer letter has been rejected. HR has been notified with your feedback.");
                if (details?.letter) {
                    setDetails({
                        ...details,
                        letter: { ...details.letter, status: 'rejected' }
                    });
                }
                setShowRejectModal(false);
            } else {
                alert(res.data.message || "Failed to reject offer.");
            }
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || err.message || "Error rejecting offer.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-medium animate-pulse">Loading Offer Details...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-white">
                <div className="bg-slate-800 border border-slate-700/60 p-8 rounded-2xl max-w-md w-full shadow-2xl text-center space-y-4">
                    <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                        ⚠️
                    </div>
                    <h2 className="text-xl font-bold text-slate-100">Access Error</h2>
                    <p className="text-slate-400 text-sm leading-relaxed">{error}</p>
                </div>
            </div>
        );
    }

    const { candidateName, jobTitle, companyName, letter } = details;
    const isPending = letter.status === 'pending' || letter.status === 'Pending';
    const pdfUrl = `${API_BASE}/public/letters/${id}/view-pdf?tenantId=${tenantId}`;

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
            {/* Top Navigation / Header */}
            <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-6 py-4">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-black shadow-lg shadow-indigo-500/20">
                            GT
                        </div>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight text-white">{companyName}</h1>
                            <p className="text-xs text-slate-400">Offer Review Portal</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status:</span>
                        {isPending ? (
                            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full text-xs font-semibold shadow-inner">
                                Pending Approval
                            </span>
                        ) : letter.status === 'approved' ? (
                            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-semibold shadow-inner">
                                Approved
                            </span>
                        ) : (
                            <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full text-xs font-semibold shadow-inner">
                                Rejected
                            </span>
                        )}
                    </div>
                </div>
            </header>

            {/* Success Message Cover */}
            {successMessage ? (
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-slate-900 border border-slate-800/80 p-8 rounded-2xl max-w-lg w-full shadow-2xl text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto text-4xl shadow-lg ${
                            letter.status === 'approved' 
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-emerald-500/10' 
                            : 'bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-rose-500/10'
                        }`}>
                            {letter.status === 'approved' ? '✓' : '✕'}
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold tracking-tight text-white">
                                {letter.status === 'approved' ? 'Offer Approved' : 'Offer Rejected'}
                            </h2>
                            <p className="text-slate-400 text-sm leading-relaxed">{successMessage}</p>
                        </div>
                        <div className="pt-2">
                            <p className="text-xs text-slate-500">You may now close this tab.</p>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex flex-col lg:flex-row gap-8">
                    {/* Main Document Content */}
                    <div className="flex-1 bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[75vh] min-h-[500px]">
                        <div className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                            <h3 className="font-bold text-slate-200">Offer Letter Document</h3>
                            <a 
                                href={`${pdfUrl}&download=true`} 
                                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition"
                                download
                            >
                                Download PDF
                            </a>
                        </div>
                        <iframe
                            src={pdfUrl}
                            className="flex-1 w-full border-none bg-white"
                            title="Offer Letter PDF"
                        />
                    </div>

                    {/* Candidate Details & Actions Sidebar */}
                    <div className="w-full lg:w-96 flex flex-col gap-6">
                        {/* Summary Card */}
                        <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl shadow-xl space-y-6">
                            <h3 className="text-md font-bold text-slate-200 uppercase tracking-wider border-b border-slate-800 pb-3">
                                Candidate Summary
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <span className="text-xs text-slate-500 uppercase block font-bold tracking-wider">Candidate Name</span>
                                    <span className="text-white font-medium text-lg">{candidateName}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 uppercase block font-bold tracking-wider">Job Role</span>
                                    <span className="text-indigo-400 font-medium">{jobTitle}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 uppercase block font-bold tracking-wider">Requested By</span>
                                    <span className="text-slate-300 font-medium">{letter.approverEmail}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 uppercase block font-bold tracking-wider">Generated Date</span>
                                    <span className="text-slate-300 font-medium">
                                        {new Date(letter.createdAt).toLocaleDateString(undefined, {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Actions Card */}
                        {isPending && (
                            <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-2xl shadow-xl space-y-4">
                                <h3 className="text-md font-bold text-slate-200 uppercase tracking-wider border-b border-slate-800 pb-3">
                                    Review Actions
                                </h3>

                                <div className="flex flex-col gap-3">
                                    <button
                                        onClick={() => setShowApproveModal(true)}
                                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all"
                                    >
                                        Approve Offer
                                    </button>
                                    <button
                                        onClick={() => setShowRejectModal(true)}
                                        className="w-full py-3 bg-rose-600/10 border border-rose-500/20 hover:bg-rose-600 text-rose-400 hover:text-white font-bold rounded-xl active:scale-[0.98] transition-all"
                                    >
                                        Reject Offer
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Approve Confirmation Modal */}
            {showApproveModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 p-6 space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white">Approve Offer Letter?</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                This will mark the offer as approved. An email with the final offer document will be automatically sent to the candidate <strong className="text-indigo-400">{candidateName}</strong>.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setShowApproveModal(false)}
                                className="px-5 py-2 text-slate-400 hover:text-white font-semibold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={submitting}
                                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-lg disabled:opacity-50 transition"
                            >
                                {submitting ? 'Approving...' : 'Confirm Approval'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200 p-6 space-y-4">
                        <div className="space-y-2">
                            <h3 className="text-xl font-bold text-white">Reject Offer Letter</h3>
                            <p className="text-sm text-slate-400 leading-relaxed">
                                Please specify the reason or comments for rejecting this offer. The HR team will receive this feedback.
                            </p>
                        </div>

                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Provide your feedback here (e.g., Salary needs revision, incorrect candidate address, etc.)..."
                            rows={4}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                        />

                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectionReason('');
                                }}
                                className="px-5 py-2 text-slate-400 hover:text-white font-semibold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={submitting}
                                className="px-6 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg shadow-lg disabled:opacity-50 transition"
                            >
                                {submitting ? 'Rejecting...' : 'Reject Offer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
