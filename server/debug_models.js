const models = [
    'Notification', 'LeaveRequest', 'Regularization', 'Applicant', 'Requirement', 'Position',
    'Candidate', 'Interview', 'TrackerCandidate', 'CandidateStatusLog', 'PayrollAdjustment',
    'SalaryStructure', 'BGVCase', 'BGVCheck', 'BGVDocument', 'BGVTimeline', 'BGVReport',
    'ReplacementRequest'
];

models.forEach(m => {
    try {
        require(`./models/${m}`);
        console.log(`✅ ${m} OK`);
    } catch (e) {
        console.error(`❌ ${m} FAILED:`, e.message);
    }
});
