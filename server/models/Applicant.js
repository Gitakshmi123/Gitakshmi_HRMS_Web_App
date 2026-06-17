const mongoose = require('mongoose');

const ApplicantSchema = new mongoose.Schema({
  applicationId: { type: String, trim: true, unique: true, index: true }, // Format: APP-2026-0001
  requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },
  gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null, index: true },
  gradeSnapshot: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null },
    name: { type: String, trim: true, default: '' },
    code: { type: String, trim: true, default: '' },
    level: { type: Number, default: null }
  },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // Link to created employee
  isOnboarded: { type: Boolean, default: false }, // Track if onboarding is complete
  onboardingInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingInstance', default: null, index: true },
  onboardingStatus: {
    type: String,
    enum: ['not_started', 'invited', 'in_progress', 'form_submitted', 'docs_pending', 'verification', 'verified', 'completed', 'blocked', 'cancelled', null],
    default: null,
    index: true
  },
  onboardingStartedAt: { type: Date, default: null },
  onboardingInvitedAt: { type: Date, default: null },
  onboardingCompletedAt: { type: Date, default: null },
  onboardingAutoStarted: { type: Boolean, default: false },

  // Personal Details
  salutation: { type: String, trim: true }, // e.g., Mr., Ms.
  name: { type: String, trim: true, required: true },
  fatherName: { type: String, trim: true },
  relationType: {
    type: String,
    trim: true,
    enum: ['S/O', 'D/O', 'W/O', 'P/O', 'G/O', ''],
    default: 'S/O'
  },
  email: { type: String, trim: true, required: true, lowercase: true },
  mobile: { type: String, trim: true, required: true },
  emergencyContact: { type: String, trim: true },
  dob: { type: Date },
  workLocation: { type: String, trim: true },
  address: { type: String, trim: true },
  jobCategory: { type: String, enum: ['Full Time', 'Intern'], default: 'Full Time' },

  // Professional Details
  department: { type: String, trim: true },
  location: { type: String, trim: true },
  intro: { type: String, trim: true },
  experience: { type: String, trim: true },
  relevantExperience: { type: String, trim: true },
  currentCompany: { type: String, trim: true },
  currentDesignation: { type: String, trim: true },
  currentlyWorking: { type: Boolean, default: false },
  noticePeriod: { type: Boolean, default: false },
  currentCTC: { type: String, trim: true },
  takeHome: { type: String, trim: true },
  expectedCTC: { type: String, trim: true },
  isOverBudget: { type: Boolean, default: false },
  isFlexible: { type: Boolean, default: false },
  hasOtherOffer: { type: Boolean, default: false },
  relocate: { type: Boolean, default: false },
  reasonForChange: { type: String, trim: true },
  linkedin: { type: String, trim: true },

  resume: { type: String, trim: true },

  // AI Parsing & Matching
  rawOCRText: { type: String }, // Raw text from Tesseract
  aiParsedData: { type: Object }, // JSON from AI (Education, Exp, etc.)
  parsedSkills: [{ type: String }],
  parsingStatus: { type: String, enum: ['Pending', 'Processing', 'Completed', 'Failed'], default: 'Pending' },

  // Matching Engine Results
  matchScore: { type: Number, default: 0 },
  matchBreakdown: {
    skills: { type: Number, default: 0 },
    experience: { type: Number, default: 0 },
    similarity: { type: Number, default: 0 },
    education: { type: Number, default: 0 },
    preferred: { type: Number, default: 0 }
  },
  matchedSkills: [{ type: String }],
  missingSkills: [{ type: String }],


  status: { type: String, default: 'Applied' },
  timeline: [
    {
      status: String,
      message: String,
      updatedBy: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],

  offerLetterPath: { type: String },
  signedOfferPath: { type: String },
  isSigned: { type: Boolean, default: false },
  offerRefCode: { type: String },
  // Offer expiry & controlled revise flow (Offer module only)
  offerExpiryAt: { type: Date, default: null, index: true },
  offerStatus: {
    type: String,
    enum: ['SENT', 'EXPIRED', 'ACCEPTED', 'SIGNED', 'REVISED', 'REQUESTED', 'REJECTED', 'PENDING_APPROVAL', null],
    default: null,
    index: true
  },
  offerVersion: { type: Number, default: 1 },
  offerRevisionRequested: { type: Boolean, default: false },
  // Candidate can request revision only once per offerVersion
  offerRevisionRequestedVersion: { type: Number, default: 0 },
  totalRevisionRequests: { type: Number, default: 0 },
  revisionRequestedAt: { type: Date, default: null },
  offerRejectedAt: { type: Date, default: null },
  revisedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', default: null },
  joiningLetterPath: { type: String },
  joiningDate: { type: Date },
  joiningLetterExpiryAt: { type: Date, default: null },
  joiningLetterStatus: {
    type: String,
    enum: ['SENT', 'EXPIRED', 'ACCEPTED', 'SIGNED', 'REJECTED', 'REQUESTED', null],
    default: null,
    index: true
  },
  joiningLetterVersion: { type: Number, default: 1 },
  joiningLetterRevisionRequested: { type: Boolean, default: false },
  // Candidate can request revision only once per joiningLetterVersion
  joiningRevisionRequestedVersion: { type: Number, default: 0 },
  totalJoiningRevisionRequests: { type: Number, default: 0 },
  joiningRevisionRequestedAt: { type: Date, default: null },

  interview: {
    date: { type: Date },
    time: { type: String },
    mode: { type: String, enum: ['Online', 'Offline'] },
    location: { type: String },
    meetingLink: { type: String },
    interviewerName: { type: String },
    notes: { type: String },
    stage: { type: String },
    completed: { type: Boolean, default: false }
  },

  salaryTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryTemplate' },
  salarySnapshot: { type: mongoose.Schema.Types.Mixed },
  salaryAssigned: { type: Boolean, default: false },
  salaryLocked: { type: Boolean, default: false },
  salarySnapshotId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmployeeSalarySnapshot', default: null },

  customDocuments: [{
    name: { type: String, required: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileSize: { type: Number },
    fileType: { type: String },
    verified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verifiedBy: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    uploadedBy: { type: String }
  }],

  reviews: [{
    stage: { type: String },
    rating: { type: Number, min: 0, max: 5 },
    feedback: { type: String, trim: true },
    scorecard: { type: Object },
    interviewerName: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],

  // ═══════════════════════════════════════════════════════════════════
  // PROFESSIONAL REFERENCES
  // ═══════════════════════════════════════════════════════════════════
  references: [{
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    designation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    company: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150
    },
    relationship: {
      type: String,
      required: true,
      enum: [
        'Reporting Manager',
        'Team Lead',
        'HR Manager',
        'Senior Colleague',
        'Mentor',
        'Professor',
        'Client',
        'Other'
      ]
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      match: /^[0-9+\-\s()]{10,15}$/
    },
    yearsKnown: {
      type: String,
      enum: ['< 1 year', '1-2 years', '2-5 years', '5+ years', null],
      default: null
    },
    consentToContact: {
      type: Boolean,
      default: true
    },
    // HR Verification Fields
    verificationStatus: {
      type: String,
      enum: ['Pending', 'Contacted', 'Verified', 'Failed'],
      default: 'Pending'
    },
    verificationNotes: {
      type: String,
      trim: true
    },
    verifiedBy: {
      type: String,
      trim: true
    },
    verifiedAt: {
      type: Date
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Fresher exemption fields
  isFresher: {
    type: Boolean,
    default: false
  },
  noReferenceReason: {
    type: String,
    enum: ['Fresher - No Work Experience', 'References disabled', 'Other', null],
    default: null
  },

  customData: { type: mongoose.Schema.Types.Mixed },

  /** Internal = employee internal job apply; External = career portal / public apply. Persisted for HR pipeline split. */
  source: {
    type: String,
    enum: ['Internal', 'External'],
    default: 'External',
    index: true,
  },

  // Referral tracking for Internal Jobs (ESS)
  referral: {
    usedCode: { type: String, trim: true, default: null, index: true }, // code entered by applicant
    myCode: { type: String, trim: true, default: null },               // applicant's own share code at time of apply
    source: { type: String, trim: true, default: null },               // e.g. 'referral_link' | 'manual' | 'direct'
    capturedAt: { type: Date, default: null },
    referrerEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    referrerName: { type: String, trim: true, default: '' }
  },

  salaryHistory: [{
    version: Number,
    effectiveFrom: Date,
    totalCTC: Number,
    grossA: Number,
    grossB: Number,
    grossC: Number,
    components: [Object],
    incrementType: String,
    reason: String,
    notes: String,
    status: String,
    isActive: Boolean,
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],

  // ═══════════════════════════════════════════════════════════════════
  // PIPELINE STAGE TRACKING (for multi-step recruitment workflow)
  // ═══════════════════════════════════════════════════════════════════
  currentStage: {
    stageId: { type: String }, // Reference to pipelineStages array index or stageName
    stageName: { type: String, default: 'Applied' },
    stageType: { type: String },
    enteredAt: { type: Date, default: Date.now },
    assignedInterviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
  },

  pipelineProgress: [{
    stageId: { type: String },
    stageName: { type: String, required: true },
    stageType: { type: String },
    status: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Skipped'], default: 'Pending' },
    result: { type: String, enum: ['Pass', 'Fail', 'On Hold', null], default: null },
    enteredAt: { type: Date },
    completedAt: { type: Date },
    assignedInterviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    feedbackSubmitted: { type: Boolean, default: false },
    feedbackId: { type: String }, // Reference to CandidateStageFeedback
    notes: { type: String }
  }],

  // Meta & Password for Onboarding Portal Credentials
  meta: { type: mongoose.Schema.Types.Mixed },
  password: { type: String },
  isDeleted: { type: Boolean, default: false },

}, { timestamps: true });

ApplicantSchema.index({ requirementId: 1, status: 1 });
ApplicantSchema.index({ email: 1 });
ApplicantSchema.index({ employeeId: 1 });
ApplicantSchema.index({ tenant: 1, requirementId: 1, employeeId: 1 }, {
  unique: true,
  partialFilterExpression: { employeeId: { $type: "objectId" } }
});

module.exports = ApplicantSchema;
