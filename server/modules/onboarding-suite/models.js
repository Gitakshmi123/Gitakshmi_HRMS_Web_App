const mongoose = require('mongoose');

const { Schema } = mongoose;

const scoped = {
  tenant: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  company: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
};

const conditionSchema = new Schema({
  roles: [{ type: String, trim: true }],
  departments: [{ type: String, trim: true }],
  locations: [{ type: String, trim: true }],
  employeeTypes: [{ type: String, trim: true }],
}, { _id: false });

const dependencySchema = new Schema({
  stepKey: { type: String, required: true, trim: true },
  status: { type: String, enum: ['completed', 'approved'], default: 'completed' },
}, { _id: false });

const workflowStepSchema = new Schema({
  key: { type: String, required: true, trim: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  phase: { type: String, enum: ['pre_onboarding', 'day_1', 'post_onboarding'], default: 'pre_onboarding', index: true },
  type: { type: String, enum: ['form', 'document', 'approval', 'training', 'api_trigger', 'face_registration'], required: true },
  order: { type: Number, required: true },
  executionMode: { type: String, enum: ['parallel', 'sequential'], default: 'sequential' },
  assignedRole: { type: String, enum: ['employee', 'hr', 'manager', 'it', 'finance', 'admin'], default: 'employee', index: true },
  assignedUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  conditions: { type: conditionSchema, default: {} },
  dependencies: { type: [dependencySchema], default: [] },
  config: { type: Schema.Types.Mixed, default: {} },
  isRequired: { type: Boolean, default: true },
  isBlocking: { type: Boolean, default: true },
  slaHours: { type: Number, default: 48, min: 1 },
  retryPolicy: {
    maxRetries: { type: Number, default: 3, min: 0 },
    retryDelayMinutes: { type: Number, default: 10, min: 0 },
  },
}, { _id: true });

const workflowTemplateSchema = new Schema({
  ...scoped,
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  description: { type: String, trim: true, default: '' },
  targetRoles: [{ type: String, trim: true, index: true }],
  targetDepartments: [{ type: String, trim: true, index: true }],
  targetLocations: [{ type: String, trim: true }],
  employeeTypes: [{ type: String, trim: true }],
  version: { type: Number, default: 1 },
  status: { type: String, enum: ['draft', 'active', 'archived'], default: 'draft', index: true },
  steps: { type: [workflowStepSchema], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

workflowTemplateSchema.index({ tenant: 1, code: 1, version: 1 }, { unique: true });
workflowTemplateSchema.index({ tenant: 1, status: 1, updatedAt: -1 });

const assignmentSchema = new Schema({
  ...scoped,
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  candidate: { type: Schema.Types.ObjectId, ref: 'Candidate', default: null, index: true },
  applicant: { type: Schema.Types.ObjectId, ref: 'Applicant', default: null, index: true },
  template: { type: Schema.Types.ObjectId, ref: 'OnboardingSuiteTemplate', required: true, index: true },
  templateSnapshot: { type: Schema.Types.Mixed, required: true },
  status: { type: String, enum: ['pending', 'in_progress', 'blocked', 'completed', 'cancelled'], default: 'pending', index: true },
  phase: { type: String, enum: ['pre_onboarding', 'day_1', 'post_onboarding'], default: 'pre_onboarding', index: true },
  progressPercent: { type: Number, default: 0 },
  hrOwner: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  managerOwner: { type: Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  joiningDate: { type: Date, default: null, index: true },
  employeeSnapshot: { type: Schema.Types.Mixed, default: {} },
  meta: { type: Schema.Types.Mixed, default: {} },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

assignmentSchema.index({ tenant: 1, employee: 1, status: 1 });
assignmentSchema.index({ tenant: 1, status: 1, updatedAt: -1 });

const stepProgressSchema = new Schema({
  ...scoped,
  assignment: { type: Schema.Types.ObjectId, ref: 'OnboardingSuiteAssignment', required: true, index: true },
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  template: { type: Schema.Types.ObjectId, ref: 'OnboardingSuiteTemplate', required: true, index: true },
  stepId: { type: Schema.Types.ObjectId, required: true },
  stepKey: { type: String, required: true, trim: true, index: true },
  title: { type: String, required: true, trim: true },
  phase: { type: String, enum: ['pre_onboarding', 'day_1', 'post_onboarding'], required: true, index: true },
  type: { type: String, enum: ['form', 'document', 'approval', 'training', 'api_trigger', 'face_registration'], required: true },
  assignedRole: { type: String, required: true, index: true },
  assignedUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  status: { type: String, enum: ['locked', 'pending', 'in_progress', 'completed', 'rejected', 'failed', 'skipped'], default: 'locked', index: true },
  dependencies: { type: [dependencySchema], default: [] },
  configSnapshot: { type: Schema.Types.Mixed, default: {} },
  isRequired: { type: Boolean, default: true },
  isBlocking: { type: Boolean, default: true },
  input: { type: Schema.Types.Mixed, default: {} },
  output: { type: Schema.Types.Mixed, default: {} },
  attemptCount: { type: Number, default: 0 },
  lastError: { type: Schema.Types.Mixed, default: null },
  rejectionReason: { type: String, trim: true, default: '' },
  dueAt: { type: Date, default: null, index: true },
  unlockedAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  completedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

stepProgressSchema.index({ tenant: 1, assignment: 1, stepKey: 1 }, { unique: true });
stepProgressSchema.index({ tenant: 1, assignedRole: 1, status: 1, dueAt: 1 });

const approvalSchema = new Schema({
  ...scoped,
  assignment: { type: Schema.Types.ObjectId, ref: 'OnboardingSuiteAssignment', required: true, index: true },
  stepProgress: { type: Schema.Types.ObjectId, ref: 'OnboardingSuiteStepProgress', required: true, index: true },
  approvalLevel: { type: Number, default: 1 },
  approverRole: { type: String, required: true, trim: true, index: true },
  approverUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  status: { type: String, enum: ['locked', 'pending', 'approved', 'rejected'], default: 'pending', index: true },
  remarks: { type: String, trim: true, default: '' },
  actedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  actedAt: { type: Date, default: null },
}, { timestamps: true });

approvalSchema.index({ tenant: 1, approverRole: 1, status: 1 });

const documentSchema = new Schema({
  ...scoped,
  assignment: { type: Schema.Types.ObjectId, ref: 'OnboardingSuiteAssignment', required: true, index: true },
  stepProgress: { type: Schema.Types.ObjectId, ref: 'OnboardingSuiteStepProgress', default: null, index: true },
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  folderPath: { type: String, required: true, trim: true },
  category: { type: String, required: true, trim: true, index: true },
  documentType: { type: String, required: true, trim: true, index: true },
  title: { type: String, required: true, trim: true },
  currentVersion: { type: Number, default: 1 },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'archived'], default: 'pending', index: true },
  accessLevel: { type: String, enum: ['employee_hr', 'hr_only', 'employee_only', 'finance_only'], default: 'employee_hr' },
  rejectionReason: { type: String, trim: true, default: '' },
  tags: [{ type: String, trim: true }],
}, { timestamps: true });

documentSchema.index({ tenant: 1, employee: 1, assignment: 1 });
documentSchema.index({ tenant: 1, category: 1, documentType: 1 });

const documentVersionSchema = new Schema({
  ...scoped,
  document: { type: Schema.Types.ObjectId, ref: 'OnboardingSuiteDocument', required: true, index: true },
  version: { type: Number, required: true },
  originalName: { type: String, required: true, trim: true },
  mimeType: { type: String, required: true, trim: true },
  size: { type: Number, default: 0 },
  storageProvider: { type: String, enum: ['local', 's3', 'cloudinary'], default: 'local' },
  storageKey: { type: String, required: true, trim: true },
  secureUrl: { type: String, trim: true, default: '' },
  checksum: { type: String, required: true, trim: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  uploadedByRole: { type: String, trim: true, default: '' },
  extractedFields: { type: Schema.Types.Mixed, default: {} },
  classificationConfidence: { type: Number, default: 0 },
}, { timestamps: true });

documentVersionSchema.index({ tenant: 1, document: 1, version: -1 }, { unique: true });

const faceProfileSchema = new Schema({
  ...scoped,
  assignment: { type: Schema.Types.ObjectId, ref: 'OnboardingSuiteAssignment', required: true, index: true },
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected', 'revoked'], default: 'pending', index: true },
  encryptedDescriptor: { type: String, required: true },
  descriptorHash: { type: String, required: true, index: true },
  encryptionKeyVersion: { type: String, default: 'v1' },
  livenessScore: { type: Number, default: 0 },
  registeredGeo: {
    lat: Number,
    lng: Number,
    accuracy: Number,
  },
  deviceId: { type: String, trim: true, default: '' },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, trim: true, default: '' },
}, { timestamps: true });

faceProfileSchema.index({ tenant: 1, employee: 1, status: 1 });

const attendanceProfileSchema = new Schema({
  ...scoped,
  assignment: { type: Schema.Types.ObjectId, ref: 'OnboardingSuiteAssignment', required: true, index: true },
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  attendanceEnabled: { type: Boolean, default: false, index: true },
  activationStatus: { type: String, enum: ['locked', 'pending_face', 'active', 'suspended'], default: 'locked', index: true },
  allowedModes: [{ type: String, enum: ['face_gps', 'manual_hr', 'otp_gps'] }],
  assignedShift: { type: Schema.Types.ObjectId, ref: 'Shift', default: null },
  attendancePolicy: { type: Schema.Types.ObjectId, ref: 'AttendancePolicy', default: null },
  allowedGeoFences: [{ type: Schema.Types.ObjectId, ref: 'OnboardingSuiteGeoFence' }],
  activatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  activatedAt: { type: Date, default: null },
}, { timestamps: true });

attendanceProfileSchema.index({ tenant: 1, employee: 1 }, { unique: true });

const punchSchema = new Schema({
  ...scoped,
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  type: { type: String, enum: ['punch_in', 'punch_out'], required: true, index: true },
  punchTime: { type: Date, default: Date.now, index: true },
  verification: { type: Schema.Types.Mixed, default: {} },
  geo: { type: Schema.Types.Mixed, default: {} },
  device: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['valid', 'flagged', 'rejected'], default: 'valid', index: true },
  reason: { type: String, trim: true, default: '' },
}, { timestamps: true });

punchSchema.index({ tenant: 1, employee: 1, punchTime: -1 });

const notificationTemplateSchema = new Schema({
  ...scoped,
  code: { type: String, required: true, trim: true, uppercase: true },
  channel: { type: String, enum: ['email', 'sms', 'whatsapp', 'in_app'], required: true },
  subject: { type: String, trim: true, default: '' },
  bodyText: { type: String, required: true },
  bodyHtml: { type: String, default: '' },
  variables: [{ type: String, trim: true }],
  isActive: { type: Boolean, default: true, index: true },
}, { timestamps: true });

notificationTemplateSchema.index({ tenant: 1, code: 1, channel: 1 }, { unique: true });

const eventSchema = new Schema({
  ...scoped,
  eventId: { type: String, required: true, unique: true },
  type: { type: String, required: true, trim: true, index: true },
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  assignment: { type: Schema.Types.ObjectId, ref: 'OnboardingSuiteAssignment', default: null, index: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  priority: { type: String, enum: ['normal', 'high', 'critical'], default: 'normal' },
  payload: { type: Schema.Types.Mixed, default: {} },
  processedAt: { type: Date, default: null },
}, { timestamps: true });

eventSchema.index({ tenant: 1, type: 1, createdAt: -1 });

const deliverySchema = new Schema({
  ...scoped,
  eventId: { type: String, required: true, trim: true },
  channel: { type: String, enum: ['email', 'sms', 'whatsapp', 'in_app'], required: true },
  recipient: { type: Schema.Types.Mixed, required: true },
  templateCode: { type: String, trim: true, default: '' },
  status: { type: String, enum: ['queued', 'sent', 'failed', 'skipped'], default: 'queued', index: true },
  attempts: { type: Number, default: 0 },
  providerMessageId: { type: String, trim: true, default: '' },
  errorCode: { type: String, trim: true, default: '' },
  errorMessage: { type: String, trim: true, default: '' },
  sentAt: { type: Date, default: null },
}, { timestamps: true });

deliverySchema.index({ tenant: 1, eventId: 1, channel: 1, 'recipient.value': 1 }, { unique: true });

function model(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema);
}

function getOnboardingSuiteModels() {
  return {
    Template: model('OnboardingSuiteTemplate', workflowTemplateSchema),
    Assignment: model('OnboardingSuiteAssignment', assignmentSchema),
    StepProgress: model('OnboardingSuiteStepProgress', stepProgressSchema),
    Approval: model('OnboardingSuiteApproval', approvalSchema),
    Document: model('OnboardingSuiteDocument', documentSchema),
    DocumentVersion: model('OnboardingSuiteDocumentVersion', documentVersionSchema),
    FaceProfile: model('OnboardingSuiteFaceProfile', faceProfileSchema),
    AttendanceProfile: model('OnboardingSuiteAttendanceProfile', attendanceProfileSchema),
    AttendancePunch: model('OnboardingSuiteAttendancePunch', punchSchema),
    NotificationTemplate: model('OnboardingSuiteNotificationTemplate', notificationTemplateSchema),
    Event: model('OnboardingSuiteEvent', eventSchema),
    Delivery: model('OnboardingSuiteNotificationDelivery', deliverySchema),
  };
}

module.exports = { getOnboardingSuiteModels };
