import React, { useState } from 'react';
import { CheckCircle, XCircle, ChevronDown, Check } from 'lucide-react';
import MoveToRoundDropdown from '../CandidateStatusTracker/MoveToRoundDropdown';

const StatusActionRow = ({
    applicant,
    activeTab,
    onSelected,
    onRejected,
    onMoveToRound,
    availableRounds = ['HR Round', 'Tech Round', 'Final Round'],
    actionCompleted = false,
    onAddCustomRound
}) => {
    const [showRoundDropdown, setShowRoundDropdown] = useState(false);
    const [selectedRound, setSelectedRound] = useState('');

    // Only show this row in INTERVIEW tab
    if (activeTab !== 'Interview') return null;

    // Only show if interview is scheduled
    if (!applicant.interview || !applicant.interview.date) return null;

    // Check if candidate is already Selected or Rejected
    const isSelected = applicant.status === 'Selected';
    const isRejected = applicant.status === 'Rejected';

    // If candidate is Selected or Rejected, show message instead of buttons
    if (isSelected || isRejected || actionCompleted) {
        const messageType = isSelected ? 'selected' : isRejected ? 'rejected' : 'completed';
        const bgColor = isSelected
            ? 'from-emerald-50/40 to-green-50/40 border-emerald-100/60'
            : isRejected
                ? 'from-rose-50/40 to-red-50/40 border-rose-100/60'
                : 'from-emerald-50/40 to-green-50/40 border-emerald-100/60';
        const iconBg = isSelected
            ? 'bg-emerald-500'
            : isRejected
                ? 'bg-rose-500'
                : 'bg-emerald-500';
        const textColor = isSelected
            ? 'text-emerald-700'
            : isRejected
                ? 'text-rose-700'
                : 'text-emerald-700';
        const subTextColor = isSelected
            ? 'text-emerald-600'
            : isRejected
                ? 'text-rose-600'
                : 'text-emerald-600';
        const message = isSelected
            ? 'Candidate has been selected. Status updated successfully.'
            : isRejected
                ? 'Candidate has been rejected. Status updated successfully.'
                : 'Candidate status has been updated and page will refresh';

        return (
            <div className={`mt-4 bg-gradient-to-r ${bgColor} border rounded-xl p-4 animate-in fade-in slide-in-from-top-2`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 ${iconBg} rounded-full text-white`}>
                        <Check size={18} strokeWidth={3} />
                    </div>
                    <div>
                        <div className={`text-[11px] font-black ${textColor} uppercase tracking-widest`}>
                            Status Updated Successfully
                        </div>
                        <div className={`text-[9px] ${subTextColor} mt-0.5`}>
                            {message}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleMoveToRoundClick = (round) => {
        setSelectedRound(round);
        setShowRoundDropdown(false);
        onMoveToRound(applicant, round);
    };

    return (
        <div className="mt-4 bg-gradient-to-r from-indigo-50/40 to-purple-50/40 border border-indigo-100/60 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
            {/* Section Header */}
            <div className="mb-4 pb-3 border-b border-indigo-100/60">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700">
                    Interview Actions
                </span>
            </div>

            {/* Three Action Buttons */}
            <div className="grid grid-cols-3 gap-3">
                {/* SELECTED Button */}
                <button
                    onClick={() => onSelected(applicant)}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 hover:shadow-lg shadow-emerald-200 transition-all active:scale-95 border border-emerald-600"
                >
                    <CheckCircle size={14} strokeWidth={2.5} />
                    <span className="hidden sm:inline">Selected</span>
                    <span className="sm:hidden">✓</span>
                </button>

                {/* REJECTED Button */}
                <button
                    onClick={() => onRejected(applicant)}
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 hover:shadow-lg shadow-rose-200 transition-all active:scale-95 border border-rose-600"
                >
                    <XCircle size={14} strokeWidth={2.5} />
                    <span className="hidden sm:inline">Rejected</span>
                    <span className="sm:hidden">✕</span>
                </button>

                {/* MOVE TO ANOTHER ROUND (Dropdown Button) */}
                <div className="relative">
                    <button
                        onClick={() => setShowRoundDropdown(!showRoundDropdown)}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:shadow-lg shadow-indigo-200 transition-all active:scale-95 border border-indigo-600"
                    >
                        <span className="hidden sm:inline">Move Round</span>
                        <span className="sm:hidden">→</span>
                        <ChevronDown
                            size={14}
                            className={`transition-transform ${showRoundDropdown ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {/* Dropdown Menu */}
                    {showRoundDropdown && (
                        <MoveToRoundDropdown
                            rounds={availableRounds}
                            onSelectRound={handleMoveToRoundClick}
                            onClose={() => setShowRoundDropdown(false)}
                            onAddCustomRound={onAddCustomRound}
                        />
                    )}
                </div>
            </div>

            {/* Optional: Show selected round info */}
            {selectedRound && (
                <div className="mt-3 pt-3 border-t border-indigo-100/60 text-[9px] font-bold text-indigo-600 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    Processing move to: {selectedRound}
                </div>
            )}
        </div>
    );
};

export default StatusActionRow;
