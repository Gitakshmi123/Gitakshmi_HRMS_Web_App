const mongoose = require('mongoose');

const { Schema } = mongoose;

const baseOptions = { timestamps: true };

const roleSchema = new Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, lowercase: true },
  permissions: [{
    module: { type: String, required: true },
    actions: [{ type: String, enum: ['create', 'read', 'update', 'delete', 'approve', 'export'] }]
  }],
  system: { type: Boolean, default: false }
}, baseOptions);
roleSchema.index({ code: 1 }, { unique: true });

const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  roleCode: { type: String, required: true, default: 'employee', index: true },
  status: { type: String, enum: ['active', 'inactive', 'invited'], default: 'active' },
  employeeId: { type: Schema.Types.ObjectId, ref: 'TenantEmployee' },
  lastLoginAt: { type: Date }
}, baseOptions);
userSchema.index({ email: 1 }, { unique: true });

const moduleSchema = new Schema({
  key: { type: String, required: true, lowercase: true },
  name: { type: String, required: true },
  enabled: { type: Boolean, default: true }
}, baseOptions);
moduleSchema.index({ key: 1 }, { unique: true });

const employeeSchema = new Schema({
  employeeCode: { type: String, trim: true, index: true },
  firstName: { type: String, required: true },
  lastName: { type: String, default: '' },
  email: { type: String, lowercase: true, trim: true, index: true },
  department: { type: String, default: '' },
  designation: { type: String, default: '' },
  joiningDate: { type: Date },
  status: { type: String, enum: ['active', 'inactive', 'exited'], default: 'active' }
}, baseOptions);

const attendanceSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'TenantEmployee', required: true, index: true },
  date: { type: Date, required: true, index: true },
  status: { type: String, enum: ['present', 'absent', 'leave', 'holiday', 'remote'], default: 'present' },
  checkIn: { type: Date },
  checkOut: { type: Date }
}, baseOptions);

const payrollSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'TenantEmployee', required: true, index: true },
  period: { type: String, required: true, index: true },
  grossPay: { type: Number, default: 0 },
  deductions: { type: Number, default: 0 },
  netPay: { type: Number, default: 0 },
  status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' }
}, baseOptions);

const recruitmentSchema = new Schema({
  title: { type: String, required: true },
  department: { type: String, default: '' },
  status: { type: String, enum: ['open', 'paused', 'closed'], default: 'open' },
  candidates: [{ name: String, email: String, stage: String }]
}, baseOptions);

const onboardingSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'TenantEmployee', index: true },
  templateName: { type: String, required: true },
  tasks: [{ title: String, ownerRole: String, completed: { type: Boolean, default: false } }],
  status: { type: String, enum: ['draft', 'in_progress', 'complete'], default: 'draft' }
}, baseOptions);

const leaveSchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'TenantEmployee', required: true, index: true },
  type: { type: String, required: true },
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
}, baseOptions);

const documentSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: 'TenantEmployee', index: true },
  name: { type: String, required: true },
  category: { type: String, default: 'general' },
  storageKey: { type: String, required: true },
  visibility: { type: String, enum: ['private', 'hr', 'company'], default: 'private' }
}, baseOptions);

const assetSchema = new Schema({
  assetTag: { type: String, required: true, index: true },
  name: { type: String, required: true },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'TenantEmployee' },
  status: { type: String, enum: ['available', 'assigned', 'repair', 'retired'], default: 'available' }
}, baseOptions);

const workflowSchema = new Schema({
  name: { type: String, required: true },
  module: { type: String, required: true },
  steps: [{ name: String, approverRole: String, order: Number }],
  active: { type: Boolean, default: true }
}, baseOptions);

const socialMediaSchema = new Schema({
  channel: { type: String, required: true },
  externalId: { type: String },
  content: { type: String, required: true },
  status: { type: String, enum: ['draft', 'scheduled', 'published', 'failed'], default: 'draft' },
  publishAt: { type: Date }
}, baseOptions);

const dmsSchema = new Schema({
  folder: { type: String, default: '/' },
  title: { type: String, required: true },
  version: { type: Number, default: 1 },
  storageKey: { type: String, required: true },
  access: [{ roleCode: String, actions: [String] }]
}, baseOptions);

const auditSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId },
  actorEmail: { type: String },
  action: { type: String, required: true },
  resource: { type: String, required: true },
  resourceId: { type: String },
  ip: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, expires: Number(process.env.TENANT_AUDIT_LOG_RETENTION_SECONDS || 31536000) }
}, { collection: 'audit_logs' });

const modelDefinitions = {
  TenantRole: roleSchema,
  TenantUser: userSchema,
  TenantModule: moduleSchema,
  TenantEmployee: employeeSchema,
  TenantAttendance: attendanceSchema,
  TenantPayroll: payrollSchema,
  TenantRecruitment: recruitmentSchema,
  TenantOnboarding: onboardingSchema,
  TenantLeave: leaveSchema,
  TenantDocument: documentSchema,
  TenantAsset: assetSchema,
  TenantWorkflow: workflowSchema,
  TenantSocialMedia: socialMediaSchema,
  TenantDms: dmsSchema,
  TenantAuditLog: auditSchema
};

function registerTenantModels(connection) {
  Object.entries(modelDefinitions).forEach(([name, schema]) => {
    if (!connection.models[name]) {
      connection.model(name, schema);
    }
  });
  return connection.models;
}

module.exports = {
  modelDefinitions,
  registerTenantModels
};
