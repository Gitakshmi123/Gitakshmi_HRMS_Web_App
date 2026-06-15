const mongoose = require('mongoose');

const StageFeedbackFormSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    stageId: { type: String, required: true, index: true }, // Linked to pipeline stage ID
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', index: true }, // Optional: If specific to a job

    title: { type: String, required: true, default: 'Interview Feedback' },
    instructions: { type: String },

    formFields: [{
        id: { type: String, required: true }, // Unique key for the field
        label: { type: String, required: true },
        type: {
            type: String,
            enum: ['rating', 'text', 'textarea', 'select', 'yesNo', 'score'],
            required: true
        },
        required: { type: Boolean, default: false },
        options: [String], // For select type
        weightage: { type: Number, default: 0 }, // For score calculation
        min: { type: Number }, // For rating/score
        max: { type: Number }  // For rating/score
    }],

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('StageFeedbackForm', StageFeedbackFormSchema);
