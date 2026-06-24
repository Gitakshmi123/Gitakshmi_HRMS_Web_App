const mongoose = require('mongoose');

const RequirementSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, required: true },
  jobOpeningId: { type: String, index: true, unique: true }, // JOB-0001
  positionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Position', index: true },
  gradeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade', default: null, index: true },
  grade: { type: String, trim: true, index: true },
  department: { type: String, trim: true, required: true },

  // STEP 2: Basic Details
  jobTitle: { type: String, trim: true, required: true },
  jobDetails: {
    salaryMin: Number,
    salaryMax: Number,
    experienceMin: Number,
    experienceMax: Number,
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Urgent'], default: 'Medium' },
    visibility: { type: String, enum: ['Internal', 'External', 'Both'], default: 'External' },
    hiringManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    interviewPanel: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    workMode: { type: String, default: 'On-site' },
    jobType: { type: String, default: 'Full-Time' },
    grade: { type: mongoose.Schema.Types.ObjectId, ref: 'Grade' }
  },

  // STEP 3: Description & Matching
  jobDescription: {
    roleOverview: { type: String, required: true },
    responsibilities: [String],
    keywords: [String],
    education: String,
    certifications: [String]
  },

  requiredSkills: [{
    name: { type: String, required: true },
    weight: { type: Number, default: 40 } // Default weight for matching
  }],

  preferredSkills: [{
    name: String,
    weight: { type: Number, default: 10 }
  }],

  matchingConfig: {
    skillWeight: { type: Number, default: 40 },
    experienceWeight: { type: Number, default: 20 },
    educationWeight: { type: Number, default: 10 },
    similarityWeight: { type: Number, default: 20 },
    preferredBonus: { type: Number, default: 10 }
  },

  // STEP 4: Pipeline
  pipelineStages: [{
    stageId: { type: String, required: true }, // e.g., 'screening', 'tech1', 'hr'
    stageName: { type: String, required: true },
    stageType: { type: String, enum: ['Screening', 'Interview', 'Assessment', 'HR', 'Offer', 'Custom', 'Finalized', 'Round', 'Technical', 'Management', 'System'], default: 'Interview' },

    assignedInterviewers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }], // Multiple interviewers per stage
    externalInterviewers: [{ name: String, email: String }], // External interviewers
    
    mode: { type: String, enum: ['Online', 'Offline', 'Telephonic', 'Virtual', 'In-person'], default: 'Online' },
    meetingLink: { type: String }, // For online mode meeting links
    durationMinutes: { type: Number, default: 30 },

    feedbackFormId: { type: mongoose.Schema.Types.ObjectId, ref: 'StageFeedbackForm' }, // Custom form per stage
    evaluationCriteria: [String], // Array of criteria strings for simple feedback
    orderIndex: { type: Number, required: true }, // For ordering
    isSystemStage: { type: Boolean, default: false }, // Cannot be deleted

    instructions: { type: String }, // For interviewer
    emailTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' } // Auto-email on stage entry
  }],
  
  // STEP 5: BGV & Onboarding
  bgvConfig: {
    isEnabled: { type: Boolean, default: false },
    triggerStage: { type: String, enum: ['POST_OFFER', 'POST_JOINING'], default: 'POST_OFFER' },
    checks: [String]
  },
  onboardingConfig: {
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingTemplate' }
  },
  
  // STATUS & TRACKING
  vacancy: { type: Number, required: true, min: 1 },
  status: { type: String, enum: ['Draft', 'Open', 'Closed', 'Paused'], default: 'Open' },

  candidateFlowTracking: {
    totalApplied: { type: Number, default: 0 },
    totalShortlisted: { type: Number, default: 0 },
    totalInterviewed: { type: Number, default: 0 },
    totalHired: { type: Number, default: 0 },
    totalRejected: { type: Number, default: 0 }
  },

  // Legacy / Direct access fields
  visibility: { type: String, enum: ['Internal', 'External', 'Both'], default: 'External' },
  isInternal: { type: Boolean, default: false },
  position: { type: String, trim: true },
  publicFields: { type: [String], default: [] },
  workflow: { type: [String], default: ['Applied', 'Shortlisted', 'Interview', 'Finalized'] },
  isReplacement: { type: Boolean, default: false },
  replacementId: { type: mongoose.Schema.Types.ObjectId, ref: 'ReplacementRequest' },
  approvalStatus: { type: String, default: 'Pending' }, // For requisition approval
  hiringStatus: { type: String, default: 'Open' } // Open, Closed, etc.
}, { strict: false, collection: 'requirements', timestamps: true });

module.exports = RequirementSchema;
