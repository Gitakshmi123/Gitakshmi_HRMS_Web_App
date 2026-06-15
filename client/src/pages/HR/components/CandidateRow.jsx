import React from 'react';
import { Calendar, Plus } from 'lucide-react';
import PipelineStatusBlock from './PipelineStatusBlock';
import ResumeRow from './ResumeRow';
import ActionRow from './ActionRow';
import InterviewInfoBlock from './InterviewInfoBlock';
import StatusActionRow from './StatusActionRow';

const CandidateRow = ({ 
    applicant, 
    activeTab, 
    onViewResume, 
    onShortlist, 
    onReject, 
    onScheduleInterview,
    onSelected,
    onRejected,
    onMoveToRound,
    availableRounds = ['HR Round', 'Tech Round', 'Final Round'],
    onAddCustomRound
}) => {

    // Logic to determine if we show the "Schedule Interview" row
    const showScheduleRow = activeTab === 'Shortlisted' && !applicant.interview?.date;

    // Show interview details in Shortlisted tab if interview exists
    const showInterviewInShortlisted = activeTab === 'Shortlisted' && applicant.interview?.date;

    // Logic to determine if we show status/action row
    // For Shortlisted candidates, we might want to hide the reject/shortlist buttons 
    // since they are already shortlisted.
    // However, the ActionRow logic we just built handles "Shortlisted" status by showing the READ ONLY banner.
    // So we can safely render ActionRow, and it will show "Shortlisted on [Date]" 
    // unless the status is mysteriously 'Applied' (which shouldn't happen due to filter).

    return (
        <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-lg hover:border-blue-100 transition-all duration-300 mb-4 animate-in fade-in slide-in-from-bottom-4">

            {/* ROW 1: Candidate Profile */}
            <div className="flex items-center gap-5 border-b border-slate-50 pb-5 mb-4">
                <div className="w-16 h-16 shrink-0 rounded-[22px] bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center text-xl font-black text-slate-700 border border-slate-100 shadow-sm">
                    {(applicant.name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                    <h3 className="text-lg font-black text-slate-800 tracking-tight">{applicant.name || 'Anonymous Candidate'}</h3>
                    <div className="flex flex-col gap-1 mt-1">
                        <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                            {applicant.email}
                        </p>
                        {applicant.mobile && (
                            <p className="text-[10px] font-bold text-slate-300 pl-3">
                                {applicant.mobile}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ROW 2: Target Role & Info */}
            <div className="mb-5 grid grid-cols-2 gap-4">
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-300 mb-1.5">Target Role</p>
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100">
                            {applicant.requirementId?.jobTitle || 'General Application'}
                        </span>
                    </div>
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-300 mb-1.5">Application ID</p>
                    <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase font-mono">
                        #{String(applicant.requirementId?.jobId || '').slice(-6) || String(applicant._id || '').slice(-6).toUpperCase()}
                    </span>
                </div>
            </div>

            {/* ROW 3: Pipeline Status */}
            <div className="mb-2">
                <p className="text-[9px] font-black uppercase tracking-[2px] text-slate-300 mb-2.5">Pipeline Status</p>
                <div className="w-full">
                    <PipelineStatusBlock status={applicant.status} createdAt={applicant.createdAt} />
                </div>
            </div>

            {/* ROW 4: Resume (ALWAYS VISIBLE - per requirement "shortlisted vada section ma bhi resume show nu button joye") */}
            <ResumeRow applicant={applicant} onViewResume={onViewResume} />

            {/* ROW 5: Interview Details in Shortlisted Tab (NEW - PART 1) */}
            {showInterviewInShortlisted && (
                <InterviewInfoBlock 
                    interview={applicant.interview} 
                    showStatus="Shortlisted"
                />
            )}

            {/* ROW 5.5: Schedule Interview (ONLY FOR SHORTLISTED TAB when NO interview scheduled) */}
            {showScheduleRow && (
                <div className="mt-3">
                    <button
                        onClick={() => onScheduleInterview(applicant)}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white border border-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 hover:shadow-lg shadow-indigo-200 transition-all active:scale-95"
                    >
                        <Calendar size={14} />
                        Schedule Interview
                    </button>
                </div>
            )}

            {/* ROW 5.6: Interview Details in Interview/HR Round tabs */}
            {(activeTab === 'Interview' || activeTab === 'HR Round') && (
                <InterviewInfoBlock interview={applicant.interview} />
            )}

            {/* ROW 5.7: Status Action Row (Interview Tab Actions - NEW - PART 2) */}
            {activeTab === 'Interview' && (
                <StatusActionRow
                    applicant={applicant}
                    activeTab={activeTab}
                    onSelected={onSelected}
                    onRejected={onRejected}
                    onMoveToRound={onMoveToRound}
                    availableRounds={availableRounds}
                    onAddCustomRound={onAddCustomRound}
                />
            )}

            {/* ROW 6: Actions (Shortlist/Reject OR History Status) */}
            {/* If scheduled, the row above handles the 'forward' action. 
                But we still show the status history via ActionRow.
                If in Applied tab, this shows buttons. 
                If in Shortlisted tab, this shows "Shortlisted on..." banner.
            */}
            <ActionRow
                status={applicant.status}
                updatedAt={applicant.updatedAt}
                onShortlist={() => onShortlist(applicant)}
                onReject={() => onReject(applicant)}
            />

        </div>
    )
}

export default CandidateRow;
