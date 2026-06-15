import React from 'react';
import { User, Mail, Phone, MapPin, Calendar, Clock, Video, FileText, CheckCircle, XCircle } from 'lucide-react';
import ActionButtons from './ActionButtons';
import dayjs from 'dayjs';
import { STAGE_COLORS, normalizeStatus } from '../PipelineStatusManager';

export default function CandidateCard({
    applicant,
    stage,
    onShortlist,
    onReject,
    onScheduleInterview,
    onProceed,
    onMoveToRound,
    availableRounds,
    onAddCustomRound,
    viewResume
}) {
    const isRejected = applicant.status === 'Rejected' || String(applicant.status || '').includes('Rejected');
    const normalizedStatus = String(applicant.status || '').includes('Interview') ? 'Interview' : (applicant.status || '');
    const statusColorClass = STAGE_COLORS[normalizedStatus] || STAGE_COLORS['default'];

    return (
        <div className={`
            bg-white rounded-[1.5rem] border transition-all duration-300 relative group overflow-hidden
            ${isRejected ? 'border-rose-100 shadow-sm opacity-80' : 'border-slate-100 shadow-xl shadow-slate-200/50 hover:border-indigo-100 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1'}
        `}>
            {/* Status Badge Overlay */}
            <div className={`absolute top-0 right-0 py-1 px-4 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest z-10 border-l border-b ${isRejected ? 'bg-rose-500 text-white border-rose-600' : statusColorClass}`}>
                {applicant.status === 'Selected' ? 'Finalized' : applicant.status}
            </div>

            {/* Card Header */}
            <div className="p-6 pb-4 flex items-start gap-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-sm shrink-0 border
                    ${isRejected ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 border-slate-50'}
                `}>
                    {(applicant.name || '?').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-black text-slate-800 tracking-tight truncate" title={applicant.name}>
                        {applicant.name || 'Candidate'}
                    </h3>
                    <div className="flex flex-col gap-1 mt-1">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 truncate">
                            <Mail size={12} /> {applicant.email}
                        </div>
                        {applicant.mobile && (
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 truncate">
                                <Phone size={12} /> {applicant.mobile}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Resume & Role Info */}
            <div className="px-6 py-2">
                <div className="flex flex-wrap gap-2 mb-4">
                    <span className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {applicant.requirementId?.jobTitle || 'Role N/A'}
                    </span>
                    {applicant.resume && stage?.toLowerCase() !== 'finalized' && (
                        <button
                            onClick={() => viewResume(applicant)}
                            className="px-3 py-1 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-colors flex items-center gap-1"
                        >
                            <FileText size={10} /> View Resume
                        </button>
                    )}
                </div>
            </div>

            {/* Divider */}
            <div className="h-px w-full bg-slate-50"></div>

            {/* Current Stage Actions or Info */}
            <div className="p-6 pt-4">
                {/* Interview Info Block (Shows in Shortlisted if scheduled, or Interview tabs) */}
                {applicant.interview?.date && stage !== 'Applied' && (
                    <div className="mb-5 p-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                        <div className="flex items-center gap-2 mb-3 text-[10px] font-black uppercase tracking-widest text-indigo-400">
                            <Clock size={12} /> Interview Details
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <span className="p-1.5 bg-white rounded-lg text-indigo-600 shadow-sm"><Calendar size={14} /></span>
                                <span className="text-xs font-bold text-indigo-900">{dayjs(applicant.interview.date).format('DD MMM YYYY')}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="p-1.5 bg-white rounded-lg text-indigo-600 shadow-sm"><Clock size={14} /></span>
                                <span className="text-xs font-bold text-indigo-900">{applicant.interview.time}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="p-1.5 bg-white rounded-lg text-indigo-600 shadow-sm"><Video size={14} /></span>
                                <span className="text-xs font-bold text-indigo-900">{applicant.interview.mode || 'Video Call'}</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Dynamic Actions based on Stage */}
                {!isRejected && (
                    <ActionButtons
                        stage={stage}
                        applicant={applicant}
                        onShortlist={onShortlist}
                        onReject={onReject}
                        onScheduleInterview={onScheduleInterview}
                        onProceed={onProceed}
                        onMoveToRound={onMoveToRound}
                        availableRounds={availableRounds}
                        onAddCustomRound={onAddCustomRound}
                    />
                )}

                {isRejected && (
                    <div className="text-center p-3 bg-rose-50 rounded-xl border border-rose-100">
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest">
                            Process Ended
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
