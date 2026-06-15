const mongoose = require('mongoose');

const InterviewSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true },
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },

    roundNumber: { type: Number, required: true },
    roundName: { type: String, enum: ['HR', 'Technical', 'Managerial', 'Final'], required: true },

    scheduledDate: { type: Date, required: true },
    scheduledTime: { type: String, required: true }, // e.g., "14:00"

    interviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // Optional for external
    isExternalInterviewer: { type: Boolean, default: false },
    interviewerName: { type: String, trim: true }, // For external
    interviewerEmail: { type: String, trim: true }, // For external
    mode: { type: String, enum: ['Online', 'Offline', 'Telephonic'], default: 'Online' },
    meetingLink: { type: String, trim: true },
    location: { type: String, trim: true }, // For offline

    feedback: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 10 },

    result: {
        type: String,
        enum: ['Pending', 'Pass', 'Fail', 'Hold'],
        default: 'Pending'
    },

    status: {
        type: String,
        enum: ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled', 'NoShow'],
        default: 'Scheduled'
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
    timestamps: true
});

InterviewSchema.index({ tenant: 1, applicationId: 1 });
InterviewSchema.index({ interviewerId: 1, scheduledDate: 1 });

module.exports = InterviewSchema;
