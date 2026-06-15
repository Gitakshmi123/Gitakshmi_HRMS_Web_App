const mongoose = require('mongoose');

const models = [
    'Notification', 'LeaveRequest', 'Regularization', 'Applicant', 'Requirement', 'Position',
    'Candidate', 'Interview', 'TrackerCandidate', 'CandidateStatusLog', 'PayrollAdjustment',
    'SalaryStructure', 'BGVCase', 'BGVCheck', 'BGVDocument', 'BGVTimeline', 'BGVReport',
    'ReplacementRequest'
];

models.forEach(m => {
    try {
        const exported = require(`./models/${m}`);
        const isSchema = exported instanceof mongoose.Schema;
        const isModel = exported && exported.modelName;

        if (!isSchema) {
            console.log(`❌ FAIL: ${m} | Type: ${typeof exported} | IsModel: ${!!isModel} | IsSchema: ${isSchema}`);
        }
    } catch (e) {
        console.log(`❌ ERROR: ${m}: ${e.message}`);
    }
});
