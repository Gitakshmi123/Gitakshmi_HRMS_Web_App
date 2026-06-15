const mongoose = require('mongoose');

const OnboardingSubmissionSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Candidate',
    required: true,
    index: true
  },
  templateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'OnboardingTemplate',
    required: true
  },
  templateVersion: {
    type: Number,
    required: true
  },
  inviteToken: {
    type: String,
    unique: true,
    sparse: true
  },
  expiresAt: Date,
  status: {
    type: String,
    enum: ['INVITED', 'IN_PROGRESS', 'DOCS_PENDING', 'VERIFICATION', 'COMPLETED', 'REJECTED'],
    default: 'INVITED',
    index: true
  },
  // Dynamic responses stored in a map
  // Key: sectionId_fieldId, Value: user input
  responses: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Specialized tracking for uploaded documents
  documents: [{
    fieldId: { type: String, required: true },
    fieldName: String,
    fileName: String,
    path: String,
    status: { 
      type: String, 
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING' 
    },
    remarks: String,
    uploadedAt: { type: Date, default: Date.now },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    verifiedAt: Date
  }],
  logs: [{
    action: { type: String, required: true },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedByModel: { type: String, enum: ['User', 'Candidate'], default: 'User' },
    timestamp: { type: Date, default: Date.now },
    metadata: Object
  }],
  submittedAt: Date,
  completedAt: Date,
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  collection: 'onboarding_submissions'
});

// Ensure only one active submission per candidate per tenant
OnboardingSubmissionSchema.index({ tenant: 1, candidateId: 1 }, { unique: true });

module.exports = OnboardingSubmissionSchema;
