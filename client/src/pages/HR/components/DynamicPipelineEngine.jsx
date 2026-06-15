import React, { useState, useEffect, useCallback } from 'react';
import { notification } from '../../../utils/antdGlobal';
import RoundContainer from './RoundContainer';
import InterviewScheduleModal from './InterviewScheduleModal';
import {
  getDefaultPipelineStages,
  moveCandidateToRound,
  rejectCandidateInRound,
  finalizeCandidateInRound,
  getCandidatesByRound,
  shouldDisplayRound,
  getNextRoundForCandidate,
  getAllRoundsForRequirement,
  scheduleInterviewForCandidate,
  addCustomRoundToCandidate
} from '../../utils/PipelineStatusManager';

/**
 * DynamicPipelineEngine Component
 * Main orchestrator for dynamic, round-based recruitment pipeline
 */
const DynamicPipelineEngine = ({
  requirement,
  applicants = [],
  onUpdateApplicant,
  onViewResume,
  currentTab = 'Applied'
}) => {
  const [pipelineRounds, setPipelineRounds] = useState([]);
  const [processedApplicants, setProcessedApplicants] = useState({});
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [selectedApplicantForInterview, setSelectedApplicantForInterview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [proceedModalData, setProceedModalData] = useState(null);

  // Initialize rounds
  useEffect(() => {
    const allRounds = getAllRoundsForRequirement(requirement, applicants);
    const coreRounds = requirement?.workflow || getDefaultPipelineStages();
    
    const displayRounds = allRounds.filter(round => 
      shouldDisplayRound(round, applicants, coreRounds)
    );
    
    setPipelineRounds(displayRounds);
  }, [requirement, applicants]);

  // Handle shortlist action
  const handleShortlist = useCallback((applicant) => {
    setLoading(true);
    try {
      const updated = moveCandidateToRound(
        applicant,
        'Shortlisted',
        'Shortlisted'
      );
      onUpdateApplicant(updated);
      notification.success({
        message: 'Success',
        description: `${applicant.name} has been shortlisted`,
        placement: 'topRight'
      });
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to shortlist candidate',
        placement: 'topRight'
      });
    } finally {
      setLoading(false);
    }
  }, [onUpdateApplicant]);

  // Handle reject action
  const handleReject = useCallback((applicant) => {
    setLoading(true);
    try {
      const updated = rejectCandidateInRound(applicant, applicant.currentRound);
      onUpdateApplicant(updated);
      notification.success({
        message: 'Success',
        description: `${applicant.name} has been rejected`,
        placement: 'topRight'
      });
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to reject candidate',
        placement: 'topRight'
      });
    } finally {
      setLoading(false);
    }
  }, [onUpdateApplicant]);

  // Handle schedule interview
  const handleScheduleInterview = useCallback((applicant) => {
    setSelectedApplicantForInterview(applicant);
    setScheduleModalVisible(true);
  }, []);

  // Handle interview scheduled
  const handleInterviewScheduled = useCallback((applicant, interviewDetails) => {
    setLoading(true);
    try {
      let updated = scheduleInterviewForCandidate(applicant, interviewDetails);
      updated = moveCandidateToRound(updated, 'Interview', 'InterviewScheduled');
      
      onUpdateApplicant(updated);
      setScheduleModalVisible(false);
      setSelectedApplicantForInterview(null);
      
      notification.success({
        message: 'Success',
        description: `Interview scheduled for ${applicant.name}`,
        placement: 'topRight'
      });
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to schedule interview',
        placement: 'topRight'
      });
    } finally {
      setLoading(false);
    }
  }, [onUpdateApplicant]);

  // Handle proceed to next round
  const handleProceedToNextRound = useCallback((applicant) => {
    const allRounds = getAllRoundsForRequirement(requirement, processedApplicants);
    const nextRound = getNextRoundForCandidate(applicant, allRounds);
    
    // Show modal for decision
    setProceedModalData({ applicant, allRounds, nextRound });
  }, [requirement, processedApplicants]);

  // Confirm move to next round
  const confirmMoveToNextRound = useCallback((applicant, targetRound) => {
    setLoading(true);
    try {
      const updated = moveCandidateToRound(applicant, targetRound, 'Proceeded');
      onUpdateApplicant(updated);
      setProceedModalData(null);
      
      notification.success({
        message: 'Success',
        description: `${applicant.name} moved to ${targetRound}`,
        placement: 'topRight'
      });
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to move candidate',
        placement: 'topRight'
      });
    } finally {
      setLoading(false);
    }
  }, [onUpdateApplicant]);

  // Handle add other/custom round
  const handleAddOtherRound = useCallback((applicant, roundName) => {
    setLoading(true);
    try {
      let updated = applicant;
      updated = addCustomRoundToCandidate(updated, roundName);
      updated = moveCandidateToRound(updated, roundName, 'MovedToCustomRound');
      
      onUpdateApplicant(updated);
      
      // Update pipeline rounds if needed
      const allRounds = getAllRoundsForRequirement(requirement, [updated]);
      setPipelineRounds(allRounds);
      
      notification.success({
        message: 'Success',
        description: `${applicant.name} moved to ${roundName}`,
        placement: 'topRight'
      });
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to add round',
        placement: 'topRight'
      });
    } finally {
      setLoading(false);
    }
  }, [requirement, onUpdateApplicant]);

  // Handle finalize
  const handleFinalize = useCallback((applicant) => {
    setLoading(true);
    try {
      const updated = finalizeCandidateInRound(applicant);
      onUpdateApplicant(updated);
      
      notification.success({
        message: 'Success',
        description: `${applicant.name} has been finalized`,
        placement: 'topRight'
      });
    } catch (error) {
      notification.error({
        message: 'Error',
        description: 'Failed to finalize candidate',
        placement: 'topRight'
      });
    } finally {
      setLoading(false);
    }
  }, [onUpdateApplicant]);

  // Get all possible rounds for the requirement
  const allRounds = getAllRoundsForRequirement(requirement, applicants);

  return (
    <div className="space-y-6">
      {/* Pipeline Rounds */}
      {pipelineRounds.map(round => {
        const roundCandidates = getCandidatesByRound(applicants, round);
        const coreRounds = requirement?.workflow || getDefaultPipelineStages();
        const isCoreRound = coreRounds.includes(round);
        
        return (
          <RoundContainer
            key={round}
            roundName={round}
            candidates={roundCandidates}
            requirement={requirement}
            allRounds={allRounds}
            onShortlist={handleShortlist}
            onReject={handleReject}
            onScheduleInterview={handleScheduleInterview}
            onProceedToNextRound={handleProceedToNextRound}
            onAddOtherRound={handleAddOtherRound}
            onFinalize={handleFinalize}
            onViewResume={onViewResume}
            loading={loading}
            isCoreRound={isCoreRound}
          />
        );
      })}

      {/* Schedule Interview Modal */}
      <InterviewScheduleModal
        visible={scheduleModalVisible}
        applicant={selectedApplicantForInterview}
        onSchedule={handleInterviewScheduled}
        onCancel={() => {
          setScheduleModalVisible(false);
          setSelectedApplicantForInterview(null);
        }}
        loading={loading}
      />

      {/* Proceed to Next Round Modal */}
      {proceedModalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-8 space-y-6">
              <h3 className="text-xl font-black text-slate-800">
                Next Step for {proceedModalData.applicant.name}?
              </h3>

              <div className="space-y-2">
                <button
                  onClick={() => confirmMoveToNextRound(proceedModalData.applicant, proceedModalData.nextRound)}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  Move to {proceedModalData.nextRound}
                </button>

                <button
                  onClick={() => confirmMoveToNextRound(proceedModalData.applicant, 'Finalized')}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                >
                  Finalize Selection
                </button>

                <button
                  onClick={() => setProceedModalData(null)}
                  className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {applicants.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-400 text-lg font-medium">
            No candidates to display
          </p>
        </div>
      )}
    </div>
  );
};

export default DynamicPipelineEngine;
