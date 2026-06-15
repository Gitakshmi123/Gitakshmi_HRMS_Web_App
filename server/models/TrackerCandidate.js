const mongoose = require('mongoose');

const TrackerCandidateSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    requirementTitle: { type: String, required: true },
    currentStatus: {
        type: String,
        default: 'Applied'
    },
    currentStage: {
        type: String,
        default: 'HR'
    },
    resume: { type: String }, // Path or URL to resume
    createdAt: { type: Date, default: Date.now }
});

module.exports = TrackerCandidateSchema;
