const mongoose = require('mongoose');

const onboardingActivitySchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
  actorName: { type: String, trim: true, default: '' },
  actorRole: { type: String, trim: true, default: '' },
  action: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const onboardingInstanceSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingTemplate', required: true, index: true },
  templateSnapshot: { type: mongoose.Schema.Types.Mixed, required: true },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', default: null, index: true },
  applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'Applicant', default: null, index: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  hrOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  managerOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  status: {
    type: String,
    enum: [
      'not_started',
      'invited',
      'in_progress',
      'form_submitted',
      'docs_pending',
      'verification',
      'verified',
      'completed',
      'blocked',
      'cancelled',
    ],
    default: 'invited',
    index: true,
  },
  onboardingTokenHash: { type: String, trim: true, default: '', index: true },
  onboardingTokenExpiresAt: { type: Date, default: null, index: true },
  invitedAt: { type: Date, default: null },
  formSubmittedAt: { type: Date, default: null },
  verifiedAt: { type: Date, default: null },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  activatedAt: { type: Date, default: null },
  activationBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  stepsCompleted: [{ type: String, trim: true }],
  progressPercent: { type: Number, default: 0 },
  currentStepOrder: { type: Number, default: 1 },
  startDate: { type: Date, default: Date.now, index: true },
  dueDate: { type: Date, default: null, index: true },
  completedAt: { type: Date, default: null },
  offerAcceptedAt: { type: Date, default: null },
  personalDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  jobDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  bankDetails: { type: mongoose.Schema.Types.Mixed, default: {} },
  policyAcceptance: { type: mongoose.Schema.Types.Mixed, default: {} },
  roleAssignment: { type: mongoose.Schema.Types.Mixed, default: {} },
  assetAllocation: { type: mongoose.Schema.Types.Mixed, default: {} },
  payrollSetup: { type: mongoose.Schema.Types.Mixed, default: {} },
  verification: {
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    remarks: { type: String, trim: true, default: '' },
    rejectedFields: [{ type: String, trim: true }],
  },
  documentSummary: {
    total: { type: Number, default: 0 },
    approved: { type: Number, default: 0 },
    rejected: { type: Number, default: 0 },
    pending: { type: Number, default: 0 },
  },
  slaBreached: { type: Boolean, default: false, index: true },
  lastReminderAt: { type: Date, default: null },
  activity: [onboardingActivitySchema],
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

onboardingInstanceSchema.index({ tenant: 1, status: 1, startDate: -1 });
onboardingInstanceSchema.index({ tenant: 1, employee: 1, createdAt: -1 });

module.exports = onboardingInstanceSchema;
