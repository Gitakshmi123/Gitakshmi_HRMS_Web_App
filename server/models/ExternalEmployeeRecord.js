const mongoose = require('mongoose');

const ExternalEmployeeRecordSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true, index: true },
  documentRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'CandidateDocumentRequest', default: null, index: true },

  personalDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  familyDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  communicationDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  educationDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  experienceDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  documentDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  bankDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  statutoryDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  salaryDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  rawEmployeePayload: { type: mongoose.Schema.Types.Mixed, default: {} },

  completionPercentage: { type: Number, min: 0, max: 100, default: 0 },
  status: {
    type: String,
    enum: ['Pending', 'Submitted', 'Approved', 'Rejected'],
    default: 'Pending',
    index: true
  },
  submittedAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  draftEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  remarks: { type: String, trim: true, default: '' }
}, { timestamps: true });

ExternalEmployeeRecordSchema.index({ tenant: 1, status: 1, updatedAt: -1 });
ExternalEmployeeRecordSchema.index({ tenant: 1, applicantId: 1 }, { unique: true });

module.exports = ExternalEmployeeRecordSchema;
