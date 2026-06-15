const mongoose = require('mongoose');

const StageFeedbackSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, required: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true, index: true },

    // The specific stage in the pipeline
    stageId: { type: String, required: true }, // Not just name, but the unique ID in the pipeline array
    stageName: { type: String },

    // The template used
    feedbackTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'FeedbackTemplate' },

    // Evaluator
    evaluator: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },

    responses: [{
        label: { type: String, required: true },
        type: { type: String, required: true },
        value: { type: mongoose.Schema.Types.Mixed }, // Number for rating, String for text
        comment: String
    }],

    overallRating: { type: Number }, // Calculated average
    recommendation: { type: String, enum: ['Proceed', 'Hold', 'Reject'], default: 'Proceed' },

    comments: String // General comments

}, { timestamps: true });

// Prevent duplicate feedback for same stage/candidate/evaluator? Maybe allow multiple rounds?
StageFeedbackSchema.index({ candidate: 1, stageId: 1, evaluator: 1 }, { unique: true });

module.exports = mongoose.model('StageFeedback', StageFeedbackSchema);
