const mongoose = require('mongoose');

const ExternalEmployeeRecordSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },
    
    personalDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    familyDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    communicationDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    educationDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    experienceDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    documentDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    bankDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    statutoryDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    salaryDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
    
    completionPercentage: { type: Number, default: 0 },
    status: { type: String, enum: ['Pending', 'Submitted', 'Approved', 'Rejected'], default: 'Pending' },
    
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    remarks: { type: String }
}, { timestamps: true });

module.exports = ExternalEmployeeRecordSchema;
