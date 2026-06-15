import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { X, TrendingUp, RefreshCw, ArrowUpCircle, Briefcase, Calendar, IndianRupee } from 'lucide-react';

/**
 * Salary History Component
 * 
 * Displays complete salary history including:
 * - Joining salary
 * - All increments
 * - All revisions
 * - All promotions
 */
export default function SalaryHistory({ employee, onClose }) {
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        loadHistory();
    }, [employee]);

    const loadHistory = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/hr/employees/${employee._id}/salary-history`);
            if (response.data.success) {
                setHistory(response.data.data);
            } else {
                setError('Failed to load salary history');
            }
        } catch (error) {
            console.error('Error loading salary history:', error);
            setError(error.response?.data?.message || 'Failed to load salary history');
        } finally {
            setLoading(false);
        }
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'INCREMENT':
                return <TrendingUp className="h-5 w-5 text-green-600" />;
            case 'REVISION':
                return <RefreshCw className="h-5 w-5 text-blue-600" />;
            case 'PROMOTION':
                return <ArrowUpCircle className="h-5 w-5 text-purple-600" />;
            case 'JOINING':
                return <Briefcase className="h-5 w-5 text-slate-600" />;
            default:
                return <IndianRupee className="h-5 w-5 text-slate-600" />;
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
            case 'JOINING':
                return 'slate';
            default:
                return 'slate';
        }
    };

    const getTypeBadge = (type) => {
        const color = getTypeColor(type);
        return (
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-${color}-100 text-${color}-800`}>
                {getTypeIcon(type)}
                {type}
            </span>
        );
    };

    const getStatusBadge = (status) => {
        const colors = {
            DRAFT: 'bg-slate-100 text-slate-800',
            PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
            APPROVED: 'bg-green-100 text-green-800',
            APPLIED: 'bg-blue-100 text-blue-800',
            REJECTED: 'bg-red-100 text-red-800'
        };

        return (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || colors.DRAFT}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between rounded-t-2xl sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold">Salary History</h2>
                        <p className="text-sm text-blue-100 mt-1">
                            {employee.firstName} {employee.lastName} ({employee.employeeId})
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-white/20 rounded-full transition"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : error ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
                            {error}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Current CTC Summary */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-sm text-slate-600 mb-1">Current Annual CTC</div>
                                        <div className="text-4xl font-bold text-slate-900">
                                            ₹{history?.currentCTC?.toLocaleString('en-IN') || 0}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm text-slate-600 mb-1">Position</div>
                                        <div className="font-semibold text-slate-900">
                                            {history?.employee?.designation || 'N/A'}
                                        </div>
                                        <div className="text-sm text-slate-500">
                                            {history?.employee?.department || 'N/A'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Timeline */}
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Timeline</h3>

                                {history?.timeline && history.timeline.length > 0 ? (
                                    <div className="space-y-4">
                                        {history.timeline.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="bg-white border border-slate-200 rounded-lg p-5 hover:shadow-md transition"
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex items-start gap-4 flex-1">
                                                        <div className="mt-1">
                                                            {getTypeIcon(item.type)}
                                                        </div>

                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-3 mb-2">
                                                                {getTypeBadge(item.type)}
                                                                {item.status && getStatusBadge(item.status)}
                                                            </div>

                                                            <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                                                                <Calendar className="h-4 w-4" />
                                                                <span>
                                                                    {new Date(item.date).toLocaleDateString('en-IN', {
                                                                        year: 'numeric',
                                                                        month: 'long',
                                                                        day: 'numeric'
                                                                    })}
                                                                </span>
                                                            </div>

                                                            {item.type === 'JOINING' ? (
                                                                <div className="space-y-1">
                                                                    <div className="font-semibold text-slate-900">
                                                                        Joining CTC: ₹{item.ctc?.toLocaleString('en-IN')}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="grid md:grid-cols-3 gap-4">
                                                                    <div>
                                                                        <div className="text-xs text-slate-500 mb-1">Previous CTC</div>
                                                                        <div className="font-semibold text-slate-700">
                                                                            ₹{item.oldCTC?.toLocaleString('en-IN')}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-slate-500 mb-1">New CTC</div>
                                                                        <div className="font-semibold text-green-600">
                                                                            ₹{item.newCTC?.toLocaleString('en-IN')}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs text-slate-500 mb-1">Change</div>
                                                                        <div className={`font-semibold ${item.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                            {item.change >= 0 ? '+' : ''}₹{Math.abs(item.change || 0).toLocaleString('en-IN')}
                                                                            <span className="text-xs ml-1">
                                                                                ({item.percentageChange >= 0 ? '+' : ''}{item.percentageChange}%)
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Promotion Details */}
                                                            {item.type === 'PROMOTION' && item.revision?.promotionDetails && (
                                                                <div className="mt-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                                                                    <div className="text-xs font-semibold text-purple-900 mb-2">Promotion Details</div>
                                                                    <div className="grid md:grid-cols-2 gap-2 text-sm">
                                                                        {item.revision.promotionDetails.oldDesignation && (
                                                                            <div>
                                                                                <span className="text-slate-600">Designation: </span>
                                                                                <span className="line-through text-slate-500">
                                                                                    {item.revision.promotionDetails.oldDesignation}
                                                                                </span>
                                                                                <span className="mx-1">→</span>
                                                                                <span className="font-semibold text-purple-700">
                                                                                    {item.revision.promotionDetails.newDesignation}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                        {item.revision.promotionDetails.newGrade && (
                                                                            <div>
                                                                                <span className="text-slate-600">Grade: </span>
                                                                                <span className="font-semibold text-purple-700">
                                                                                    {item.revision.promotionDetails.newGrade}
                                                                                </span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* Reason */}
                                                            {item.revision?.changeSummary?.reason && (
                                                                <div className="mt-3 text-sm text-slate-600 italic">
                                                                    "{item.revision.changeSummary.reason}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center text-slate-500 py-8">
                                        No salary history available
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
