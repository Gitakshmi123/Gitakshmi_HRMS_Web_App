import React from 'react';
import { FileText, Calendar, MapPin, Phone, Mail, Eye } from 'lucide-react';
import ActionButtons from './ActionButtons';
import { getLastInterviewDetails } from '../../utils/PipelineStatusManager';

/**
 * CandidateCard Component
 * Individual candidate card showing profile, interview details, and round-specific actions
 */
const CandidateCard = ({
  applicant,
  currentRound,
  requirement,
  allRounds = [],
  onShortlist,
  onReject,
  onScheduleInterview,
  onProceedToNextRound,
  onAddOtherRound,
  onFinalize,
  onViewResume,
  loading = false
}) => {
  const lastInterview = getLastInterviewDetails(applicant);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Card Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="text-sm font-black text-slate-800 tracking-tight">
              {applicant.name}
            </h4>
            <p className="text-[10px] text-slate-500 mt-1">
              {applicant.email}
            </p>
          </div>
          {applicant.resume && (
            <button
              onClick={() => onViewResume(applicant)}
              className="p-2 hover:bg-white rounded-lg transition-colors text-blue-600"
              title="View Resume"
            >
              <Eye size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Card Body */}
      <div className="px-4 py-4 space-y-3">
        {/* Contact Info */}
        <div className="space-y-2 text-xs text-slate-600">
          {applicant.mobile && (
            <div className="flex items-center gap-2">
              <Phone size={14} className="text-slate-400" />
              <span>{applicant.mobile}</span>
            </div>
          )}
          {applicant.location && (
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-slate-400" />
              <span>{applicant.location}</span>
            </div>
          )}
        </div>

        {/* Target Role */}
        {requirement && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
              Target Role
            </p>
            <p className="text-sm font-bold text-slate-800">
              {requirement.jobTitle}
            </p>
          </div>
        )}

        {/* Interview Details (if exists) */}
        {lastInterview && (
          <div className="pt-2 border-t border-slate-100 bg-blue-50 p-3 rounded-lg">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-wider mb-2">
              Interview Scheduled
            </p>
            <div className="space-y-1 text-xs text-slate-700">
              {lastInterview.date && (
                <div className="flex items-center gap-2">
                  <Calendar size={12} />
                  <span>{new Date(lastInterview.date).toLocaleDateString()}</span>
                </div>
              )}
              {lastInterview.time && (
                <div className="flex items-center gap-2">
                  <span>⏰</span>
                  <span>{lastInterview.time}</span>
                </div>
              )}
              {lastInterview.location && (
                <div className="flex items-center gap-2">
                  <MapPin size={12} />
                  <span>{lastInterview.location}</span>
                </div>
              )}
              {lastInterview.interviewerName && (
                <div className="text-[10px]">
                  <span className="font-bold">Interviewer:</span> {lastInterview.interviewerName}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Round Status */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
            Current Round
          </p>
          <div className="inline-block px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-700 uppercase tracking-wider">
            {currentRound}
          </div>
        </div>

        {/* Action Buttons */}
        <ActionButtons
          applicant={applicant}
          currentRound={currentRound}
          onShortlist={onShortlist}
          onReject={onReject}
          onScheduleInterview={onScheduleInterview}
          onProceedToNextRound={onProceedToNextRound}
          onAddOtherRound={onAddOtherRound}
          onFinalize={onFinalize}
          allRounds={allRounds}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default CandidateCard;
