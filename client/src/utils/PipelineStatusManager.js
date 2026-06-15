/**
 * PipelineStatusManager.js
 * Handles state management and transitions for dynamic recruitment pipeline
 */

// Get default pipeline stages for a requirement
export const getDefaultPipelineStages = () => {
  return ['Applied', 'Shortlisted', 'Interview', 'HR Round', 'Finalized'];
};

// Initialize candidate with starting round
export const initializeCandidateInPipeline = (applicant, startingRound = 'Applied') => {
  return {
    ...applicant,
    currentRound: startingRound,
    roundHistory: [{
      round: startingRound,
      enteredAt: new Date(),
      actions: []
    }],
    isRejected: false,
    isFinalized: false,
    customRounds: [] // Candidate-specific custom rounds
  };
};

// Move candidate to next round
export const moveCandidateToRound = (applicant, nextRound, action = null) => {
  const updatedRoundHistory = [...(applicant.roundHistory || [])];
  
  // Add action to current round if provided
  if (action && updatedRoundHistory.length > 0) {
    updatedRoundHistory[updatedRoundHistory.length - 1].actions.push({
      type: action,
      timestamp: new Date()
    });
  }
  
  // Add new round to history
  updatedRoundHistory.push({
    round: nextRound,
    enteredAt: new Date(),
    actions: []
  });

  return {
    ...applicant,
    currentRound: nextRound,
    roundHistory: updatedRoundHistory,
    status: getStatusForRound(nextRound)
  };
};

// Get status label based on round
export const getStatusForRound = (roundName) => {
  const statusMap = {
    'Applied': 'Applied',
    'Shortlisted': 'Shortlisted',
    'Interview': 'Interview',
    'HR Round': 'Selected',
    'Finalized': 'Finalized'
  };
  
  return statusMap[roundName] || roundName;
};

// Mark candidate as rejected
export const rejectCandidateInRound = (applicant, round) => {
  return {
    ...applicant,
    isRejected: true,
    status: 'Rejected',
    rejectedAt: new Date(),
    rejectedFromRound: round,
    roundHistory: [...(applicant.roundHistory || []), {
      round: 'Rejected',
      enteredAt: new Date(),
      reason: 'Rejected by HR'
    }]
  };
};

// Mark candidate as finalized
export const finalizeCandidateInRound = (applicant) => {
  return {
    ...applicant,
    isFinalized: true,
    status: 'Finalized',
    finalizedAt: new Date(),
    currentRound: 'Finalized'
  };
};

// Get all rounds for a requirement (static + custom)
export const getAllRoundsForRequirement = (requirement, applicants = []) => {
  const staticRounds = requirement?.workflow || getDefaultPipelineStages();
  
  // Collect all custom rounds from all applicants in this requirement
  const customRounds = new Set();
  applicants.forEach(app => {
    if (app.customRounds && Array.isArray(app.customRounds)) {
      app.customRounds.forEach(round => customRounds.add(round));
    }
  });
  
  return [...staticRounds, ...Array.from(customRounds)];
};

// Get candidates by round
export const getCandidatesByRound = (applicants, round) => {
  return applicants.filter(app => app.currentRound === round);
};

// Check if round should be displayed (has candidates or is core round)
export const shouldDisplayRound = (round, applicants, coreRounds = getDefaultPipelineStages()) => {
  const coreSet = new Set(coreRounds);
  const hasCandidates = applicants.some(app => app.currentRound === round);
  return coreSet.has(round) || hasCandidates;
};

// Get next available round for candidate
export const getNextRoundForCandidate = (applicant, allRounds) => {
  const currentIndex = allRounds.indexOf(applicant.currentRound);
  if (currentIndex === -1 || currentIndex === allRounds.length - 1) {
    return 'Finalized';
  }
  return allRounds[currentIndex + 1];
};

// Validate round transition
export const isValidRoundTransition = (currentRound, targetRound, allRounds) => {
  const currentIndex = allRounds.indexOf(currentRound);
  const targetIndex = allRounds.indexOf(targetRound);
  
  // Can move to any round (not just next)
  return currentIndex !== -1 && targetIndex !== -1 && currentIndex !== targetIndex;
};

// Add custom round to candidate
export const addCustomRoundToCandidate = (applicant, customRound) => {
  const customRounds = applicant.customRounds || [];
  if (!customRounds.includes(customRound)) {
    customRounds.push(customRound);
  }
  return {
    ...applicant,
    customRounds
  };
};

// Schedule interview for candidate
export const scheduleInterviewForCandidate = (applicant, interviewDetails) => {
  return {
    ...applicant,
    interview: {
      ...interviewDetails,
      scheduledAt: new Date()
    },
    interviewHistory: [...(applicant.interviewHistory || []), {
      ...interviewDetails,
      round: applicant.currentRound,
      scheduledAt: new Date()
    }]
  };
};

// Get interview history for candidate
export const getInterviewHistoryForCandidate = (applicant) => {
  return applicant.interviewHistory || [];
};

// Get last interview details
export const getLastInterviewDetails = (applicant) => {
  const history = getInterviewHistoryForCandidate(applicant);
  return history.length > 0 ? history[history.length - 1] : null;
};

// Get round-specific actions
export const getRoundActions = (roundName) => {
  const actions = {
    'Applied': ['Shortlist', 'Reject'],
    'Shortlisted': ['ScheduleInterview', 'Reject'],
    'Interview': ['ProceedToNextRound', 'Reject', 'AddOtherRound'],
    'HR Round': ['Finalize', 'Reject', 'AddOtherRound'],
    'Finalized': []
  };
  
  return actions[roundName] || [];
};
