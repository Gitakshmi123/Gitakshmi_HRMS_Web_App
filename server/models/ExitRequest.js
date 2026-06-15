const mongoose = require('mongoose');

/**
 * ExitRequest — Professional HRMS Offboarding Lifecycle (Employee + HR roles)
 *
 * Stage lifecycle:
 *   Requested → HR Review → Notice Period → Clearance → FNF → Letters Generated → Deactivated
 *
 * Status:
 *   Pending  → (Requested / HR Review)
 *   Approved → (Notice Period / Clearance / FNF / Letters Generated)
 *   Rejected → (any non-completed stage)
 *   Completed→ (Deactivated)
 */

// ── Asset Checklist Item ──────────────────────────────────────────────────
const AssetItemSchema = new mongoose.Schema({
  item:       { type: String, required: true },
  returned:   { type: Boolean, default: false },
  returnedAt: { type: Date }
}, { _id: false });

// ── Department Exit Task (assigned department + status pending/completed) ───
const DeptTaskSchema = new mongoose.Schema({
  department: { type: String, trim: true, required: true },
  task:       { type: String, trim: true, required: true },
  status:     { type: String, enum: ['Pending', 'Completed', 'NA'], default: 'Pending' },
  completedAt:{ type: Date },
  remarks:    { type: String, trim: true }
});

// ── Clearance / Handover Form — Knowledge Transfer (employee fills) ────────
const ClearanceFormSchema = new mongoose.Schema({
  handoverTo:             { type: String, trim: true },
  pendingTasks:           { type: String, trim: true },
  projectsStatus:         { type: String, trim: true },
  knowledgeTransferNotes: { type: String, trim: true },
  systemCredentials:      { type: String, trim: true },
  otherNotes:             { type: String, trim: true },
  submittedAt:            { type: Date }
}, { _id: false });

// ── Exit Interview (employee feedback before leaving) ──────────────────────
const ExitInterviewSchema = new mongoose.Schema({
  reasonForLeaving:   { type: String, trim: true },
  companyFeedback:    { type: String, trim: true },
  managementFeedback: { type: String, trim: true },
  suggestions:        { type: String, trim: true },
  jobSatisfaction:    { type: Number, min: 1, max: 5 },
  wouldRecommend:     { type: Boolean },
  submittedAt:        { type: Date }
}, { _id: false });

// ── FNF Settlement ────────────────────────────────────────────────────────
const FNFSchema = new mongoose.Schema({
  annualCTC:            { type: Number, default: 0 },
  monthlyCTC:           { type: Number, default: 0 },
  basicSalary:          { type: Number, default: 0 },
  allowances:           { type: Number, default: 0 },
  workedDays:           { type: Number, default: 0 },
  totalWorkingDays:     { type: Number, default: 26 },
  dailyRate:            { type: Number, default: 0 },
  serviceYears:         { type: Number, default: 0 },
  gratuityEligible:     { type: Boolean, default: false },
  basicSalaryPayable:   { type: Number, default: 0 },
  leaveEncashmentDays:  { type: Number, default: 0 },
  leaveEncashmentAmount:{ type: Number, default: 0 },
  gratuityAmount:       { type: Number, default: 0 },
  bonusAmount:          { type: Number, default: 0 },
  reimbursementAmount:  { type: Number, default: 0 },
  noticeShortfallDays:  { type: Number, default: 0 },
  noticeRecovery:       { type: Number, default: 0 },
  salaryStructureSource:{ type: String, trim: true, default: '' },
  deductions: [{
    label:  { type: String },
    amount: { type: Number, default: 0 }
  }],
  grossPayable:     { type: Number, default: 0 },
  totalDeductions:  { type: Number, default: 0 },
  netPayable:       { type: Number, default: 0 },
  payrollInputBatchId:    { type: mongoose.Schema.Types.ObjectId, ref: 'PayrollInputBatch', default: null },
  payrollInputBatchCode:  { type: String, trim: true, default: '' },
  payrollInputBatchStatus:{ type: String, trim: true, default: '' },
  remarks:          { type: String, trim: true },
  processedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  processedAt:      { type: Date }
}, { _id: false });

// ── Generated Letter ──────────────────────────────────────────────────────
const LetterSchema = new mongoose.Schema({
  content:     { type: String },
  generatedAt: { type: Date },
  generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
}, { _id: false });

// ── Main Schema ───────────────────────────────────────────────────────────
const ExitRequestSchema = new mongoose.Schema({
  tenant:   { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant',   required: true, index: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

  // ── Resignation details ───────────────────────────────────────────────
  exitType: {
    type: String,
    enum: ['Resignation', 'Termination', 'Retirement', 'Absconding'],
    default: 'Resignation'
  },
  reason:   { type: String, required: true, trim: true },
  comments: { type: String, trim: true },

  // ── Stage & Status ────────────────────────────────────────────────────
  stage: {
    type: String,
    enum: [
      'Requested',
      'HR Review',
      'Notice Period',
      'Clearance',
      'Exit Interview',
      'FNF',
      'Letters Generated',
      'Deactivated'
    ],
    default: 'Requested',
    index: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
    default: 'Pending',
    index: true
  },

  // ── HR Review / Approval ──────────────────────────────────────────────
  hrId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  hrReviewedAt: { type: Date },
  hrApprovedAt: { type: Date },
  hrRemarks:    { type: String, trim: true },

  // ── Rejection ─────────────────────────────────────────────────────────
  rejectedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  rejectedAt:      { type: Date },
  rejectionReason: { type: String, trim: true },

  // ── Notice Period (start/end/remaining computed from these) ─────────────
  noticePeriodDays:     { type: Number, default: 30 },
  noticePeriodStartDate:{ type: Date },
  lastWorkingDate:      { type: Date },

  // ── Clearance ─────────────────────────────────────────────────────────
  clearanceForm:          { type: ClearanceFormSchema, default: () => ({}) },
  clearanceFormSubmitted: { type: Boolean, default: false },

  departmentTasks: { type: [DeptTaskSchema], default: [] },

  assetChecklist: {
    type: [AssetItemSchema],
    default: [
      { item: 'Laptop / Computer',          returned: false },
      { item: 'ID Card / Access Badge',     returned: false },
      { item: 'Company Mobile Phone',       returned: false },
      { item: 'Office Keys / Access Cards', returned: false },
      { item: 'Company Credit Card',        returned: false },
      { item: 'Parking Pass',               returned: false }
    ]
  },
  allAssetsReturned: { type: Boolean, default: false },
  assetRemarks:      { type: String, trim: true },
  assetClearedAt:    { type: Date },

  clearanceCompletedAt: { type: Date },

  // ── Exit Interview ─────────────────────────────────────────────────────
  exitInterview:           { type: ExitInterviewSchema, default: () => ({}) },
  exitInterviewCompleted:  { type: Boolean, default: false },

  // ── FNF Settlement ────────────────────────────────────────────────────
  fnfSettlement: { type: FNFSchema, default: () => ({}) },
  fnfProcessed:  { type: Boolean, default: false },

  // ── Generated Letters ─────────────────────────────────────────────────
  letters: {
    experience: { type: LetterSchema, default: () => ({}) },
    relieving:  { type: LetterSchema, default: () => ({}) }
  },
  lettersGenerated: { type: Boolean, default: false },

  // ── Deactivation ──────────────────────────────────────────────────────
  deactivatedAt: { type: Date },
  deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }

}, { timestamps: true });

ExitRequestSchema.index({ tenant: 1, employee: 1 });
ExitRequestSchema.index({ tenant: 1, stage: 1 });
ExitRequestSchema.index({ tenant: 1, status: 1 });

module.exports = ExitRequestSchema;
