import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Check, X, Eye, TrendingUp, RefreshCw, ArrowUpCircle, Calendar, User, AlertCircle } from 'lucide-react';

/**
 * Revision Approval Component
 * 
 * HR Dashboard for approving/rejecting salary revisions
 */
export default function RevisionApproval() {
    const [revisions, setRevisions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRevision, setSelectedRevision] = useState(null);
    const [showDetails, setShowDetails] = useState(false);
    const [filterType, setFilterType] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(null);

    useEffect(() => {
        loadPendingRevisions();
    }, [filterType]);

    const loadPendingRevisions = async () => {
        try {
            setLoading(true);
            const params = filterType ? `?type=${filterType}` : '';
            const response = await api.get(`/hr/salary-revisions/pending${params}`);
            if (response.data.success) {
                setRevisions(response.data.data || []);
            }
        } catch (error) {
            console.error('Error loading pending revisions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (revisionId) => {
        if (!confirm('Are you sure you want to approve this salary revision?')) {
            return;
        }

        try {
            setActionLoading(true);
            const response = await api.post(`/hr/salary-revisions/${revisionId}/approve`);
            if (response.data.success) {
                alert('Salary revision approved successfully!');
                loadPendingRevisions();
                setShowDetails(false);
            }
        } catch (error) {
            console.error('Error approving revision:', error);
            alert(error.response?.data?.message || 'Failed to approve revision');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async (revisionId) => {
        if (!rejectionReason.trim()) {
            alert('Please provide a reason for rejection');
            return;
        }

        try {
            setActionLoading(true);
            const response = await api.post(`/hr/salary-revisions/${revisionId}/reject`, {
                reason: rejectionReason
            });
            if (response.data.success) {
                alert('Salary revision rejected');
                loadPendingRevisions();
                setShowRejectModal(null);
                setRejectionReason('');
                setShowDetails(false);
            }
        } catch (error) {
            console.error('Error rejecting revision:', error);
            alert(error.response?.data?.message || 'Failed to reject revision');
        } finally {
            setActionLoading(false);
        }
    };

    const viewDetails = async (revisionId) => {
        try {
            const response = await api.get(`/hr/salary-revisions/${revisionId}`);
            if (response.data.success) {
                setSelectedRevision(response.data.data);
                setShowDetails(true);
            }
        } catch (error) {
            console.error('Error loading revision details:', error);
            alert('Failed to load revision details');
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'INCREMENT':
                return <TrendingUp className="h-5 w-5" />;
            case 'REVISION':
                return <RefreshCw className="h-5 w-5" />;
            case 'PROMOTION':
                return <ArrowUpCircle className="h-5 w-5" />;
            default:
                return null;
        }
    };

    const getTypeColor = (type) => {
        switch (type) {
            case 'INCREMENT':
                return 'green';
            case 'REVISION':
                return 'blue';
            case 'PROMOTION':
                return 'purple';
            default:
                return 'slate';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Salary Revision Approvals</h1>
                    <p className="text-slate-600 mt-1">Review and approve pending salary changes</p>
                </div>

                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                    <option value="">All Types</option>
                    <option value="INCREMENT">Increments</option>
                    <option value="REVISION">Revisions</option>
                    <option value="PROMOTION">Promotions</option>
                </select>
            </div>

            {/* Pending Count */}
            {revisions.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-600" />
                        <span className="font-semibold text-amber-900">
                            {revisions.length} pending {revisions.length === 1 ? 'revision' : 'revisions'} awaiting approval
                        </span>
                    </div>
                </div>
            )}

            {/* Revisions List */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : revisions.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <div className="text-6xl mb-4">✓</div>
                        <div className="text-lg font-semibold">No pending revisions</div>
                        <div className="text-sm mt-1">All salary changes have been reviewed</div>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200">
                        {revisions.map((revision) => {
                            const color = getTypeColor(revision.type);
                            const employee = revision.employeeId;

                            return (
                                <div
                                    key={revision._id}
                                    className="p-6 hover:bg-slate-50 transition"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-4 flex-1">
                                            <div className={`p-3 rounded-lg bg-${color}-100`}>
                                                {getTypeIcon(revision.type)}
                                            </div>

                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-${color}-100 text-${color}-800`}>
                                                        {revision.type}
                                                    </span>
                                                    <span className="text-sm text-slate-500">
                                                        {new Date(revision.effectiveFrom).toLocaleDateString('en-IN')}
                                                    </span>
                                                </div>

                                                <div className="font-semibold text-slate-900 text-lg mb-1">
                                                    {employee?.firstName} {employee?.lastName}
                                                </div>
                                                <div className="text-sm text-slate-600 mb-3">
                                                    {employee?.employeeId} • {employee?.designation} • {employee?.department}
                                                </div>

                                                <div className="grid md:grid-cols-3 gap-4 mb-3">
                                                    <div>
                                                        <div className="text-xs text-slate-500 mb-1">Current CTC</div>
                                                        <div className="font-semibold text-slate-700">
                                                            ₹{revision.changeSummary?.oldCTC?.toLocaleString('en-IN')}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-slate-500 mb-1">New CTC</div>
                                                        <div className="font-semibold text-green-600">
                                                            ₹{revision.changeSummary?.newCTC?.toLocaleString('en-IN')}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-slate-500 mb-1">Change</div>
                                                        <div className="font-semibold text-green-600">
                                                            +₹{revision.changeSummary?.absoluteChange?.toLocaleString('en-IN')}
                                                            <span className="text-xs ml-1">
                                                                (+{revision.changeSummary?.percentageChange}%)
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {revision.changeSummary?.reason && (
                                                    <div className="text-sm text-slate-600 italic">
                                                        "{revision.changeSummary.reason}"
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <button
                                                onClick={() => viewDetails(revision._id)}
                                                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition text-sm"
                                            >
                                                <Eye className="h-4 w-4" />
                                                Details
                                            </button>
                                            <button
                                                onClick={() => handleApprove(revision._id)}
                                                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm"
                                                disabled={actionLoading}
                                            >
                                                <Check className="h-4 w-4" />
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => setShowRejectModal(revision._id)}
                                                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm"
                                                disabled={actionLoading}
                                            >
                                                <X className="h-4 w-4" />
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {showDetails && selectedRevision && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
                        <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
                            <h2 className="text-xl font-bold">Revision Details</h2>
                            <button
                                onClick={() => setShowDetails(false)}
                                className="p-1 hover:bg-white/20 rounded-full transition"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Employee Info */}
                            <div className="bg-slate-50 rounded-lg p-4">
                                <h3 className="font-semibold text-slate-900 mb-3">Employee Information</h3>
                                <div className="grid md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-slate-600">Name: </span>
                                        <span className="font-semibold">
                                            {selectedRevision.employeeId?.firstName} {selectedRevision.employeeId?.lastName}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-600">Employee ID: </span>
                                        <span className="font-semibold">{selectedRevision.employeeId?.employeeId}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-600">Designation: </span>
                                        <span className="font-semibold">{selectedRevision.employeeId?.designation}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-600">Department: </span>
                                        <span className="font-semibold">{selectedRevision.employeeId?.department}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Salary Comparison */}
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="border border-slate-200 rounded-lg p-4">
                                    <h4 className="font-semibold text-slate-700 mb-3">Current Salary</h4>
                                    <div className="text-2xl font-bold text-slate-900 mb-2">
                                        ₹{selectedRevision.oldSnapshot?.ctc?.toLocaleString('en-IN')}
                                    </div>
                                    <div className="text-sm text-slate-600">
                                        ₹{selectedRevision.oldSnapshot?.monthlyCTC?.toLocaleString('en-IN')}/month
                                    </div>
                                </div>

                                <div className="border border-green-200 rounded-lg p-4 bg-green-50">
                                    <h4 className="font-semibold text-green-900 mb-3">New Salary</h4>
                                    <div className="text-2xl font-bold text-green-700 mb-2">
                                        ₹{selectedRevision.newSnapshot?.ctc?.toLocaleString('en-IN')}
                                    </div>
                                    <div className="text-sm text-green-700">
                                        ₹{selectedRevision.newSnapshot?.monthlyCTC?.toLocaleString('en-IN')}/month
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-slate-200">
                                <button
                                    onClick={() => setShowDetails(false)}
                                    className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => handleApprove(selectedRevision._id)}
                                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                                    disabled={actionLoading}
                                >
                                    Approve
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl">
                        <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl">
                            <h2 className="text-xl font-bold">Reject Revision</h2>
                            <button
                                onClick={() => {
                                    setShowRejectModal(null);
                                    setRejectionReason('');
                                }}
                                className="p-1 hover:bg-white/20 rounded-full transition"
                            >
                                <X className="h-6 w-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Reason for Rejection *
                                </label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                    rows="4"
                                    placeholder="Please provide a reason for rejecting this revision..."
                                    required
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setShowRejectModal(null);
                                        setRejectionReason('');
                                    }}
                                    className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleReject(showRejectModal)}
                                    className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                                    disabled={actionLoading || !rejectionReason.trim()}
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
}
