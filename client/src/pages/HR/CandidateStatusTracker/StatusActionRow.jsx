import React from 'react';
import { CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import MoveToRoundDropdown from './MoveToRoundDropdown';

/**
 * StatusActionRow
 * Displays action buttons for candidate status update
 * Used in INTERVIEW tab
 */
export default function StatusActionRow({
    candidateId,
    onSelected,
    onRejected,
    onMoveToRound,
    availableRounds = [],
    selectedButtonLoading = '',
    disabled = false
}) {
    const handleMoveRound = (round) => {
        onMoveToRound(round);
    };

    return (
        <div className="bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200/60 p-5">
            {/* Title */}
            <div className="mb-4">
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                    <span className="w-1 h-5 bg-blue-500 rounded-full"></span>
                    Next Step Actions
                </h4>
            </div>

            {/* Action Buttons Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* SELECTED Button */}
                <button
                    onClick={() => onSelected(candidateId)}
                    disabled={disabled || selectedButtonLoading !== ''}
                    className={`relative overflow-hidden rounded-xl font-bold text-sm py-3 px-4 transition-all flex items-center justify-center gap-2 group active:scale-95 ${
                        selectedButtonLoading === 'selected'
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'
                            : disabled
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-emerald-500 to-indigo-600 text-white hover:shadow-lg hover:shadow-emerald-200'
                    }`}
                >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative flex items-center justify-center gap-2">
                        {selectedButtonLoading === 'selected' ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle size={18} strokeWidth={2} />
                                <span>Selected</span>
                            </>
                        )}
                    </div>
                </button>

                {/* REJECTED Button */}
                <button
                    onClick={() => onRejected(candidateId)}
                    disabled={disabled || selectedButtonLoading !== ''}
                    className={`relative overflow-hidden rounded-xl font-bold text-sm py-3 px-4 transition-all flex items-center justify-center gap-2 group active:scale-95 ${
                        selectedButtonLoading === 'rejected'
                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-200'
                            : disabled
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:shadow-lg hover:shadow-rose-200'
                    }`}
                >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="relative flex items-center justify-center gap-2">
                        {selectedButtonLoading === 'rejected' ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <XCircle size={18} strokeWidth={2} />
                                <span>Rejected</span>
                            </>
                        )}
                    </div>
                </button>

                {/* MOVE TO ROUND Dropdown */}
                <div className="sm:col-span-1">
                    <MoveToRoundDropdown
                        availableRounds={availableRounds}
                        onSelect={handleMoveRound}
                        disabled={disabled || selectedButtonLoading === 'moveToRound'}
                        loading={selectedButtonLoading === 'moveToRound'}
                    />
                </div>
            </div>

            {/* Info Text */}
            <div className="mt-4 text-xs text-slate-500 font-medium px-3 py-2 bg-white/50 rounded-lg border border-slate-200/50">
                <span className="flex items-center gap-1">
                    <ArrowRight size={14} className="text-blue-500" />
                    Select an action to update the candidate's pipeline status
                </span>
            </div>
        </div>
    );
}
