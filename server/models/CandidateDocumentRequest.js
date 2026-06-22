const mongoose = require('mongoose');

const CandidateDocumentRequestSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  applicantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', required: true, index: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true, index: true },
  token: { type: String, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['Pending', 'Submitted', 'Approved', 'Rejected'],
    default: 'Pending',
    index: true
  },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  sentAt: { type: Date, default: Date.now },
  submittedAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
  rejectedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: true },
  remarks: { type: String, trim: true, default: '' }
}, { timestamps: true });

CandidateDocumentRequestSchema.index({ tenant: 1, applicantId: 1, status: 1 });
CandidateDocumentRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

module.exports = CandidateDocumentRequestSchema;
