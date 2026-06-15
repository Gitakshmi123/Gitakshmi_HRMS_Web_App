const mongoose = require('mongoose');

const InterviewEvaluationSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },

    stageId: { type: String, required: true }, // ID of the pipeline stage
    interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    feedbackFormId: { type: mongoose.Schema.Types.ObjectId, ref: 'StageFeedbackForm' },

    responses: { type: Object, default: {} }, // Key-value pairs of fieldId: response

    overallRating: { type: Number, min: 0, max: 10 },
    decision: {
        type: String,
        enum: ['Strong Hire', 'Hire', 'Hold', 'No Hire', 'Strong No Hire'],
        required: true
    },
    recommendation: { type: String }, // Additional notes

    submittedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Prevent duplicate evaluations by same interviewer for same stage
InterviewEvaluationSchema.index({ applicationId: 1, stageId: 1, interviewerId: 1 }, { unique: true });

module.exports = mongoose.model('InterviewEvaluation', InterviewEvaluationSchema);
