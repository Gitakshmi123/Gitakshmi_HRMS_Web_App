const mongoose = require('mongoose');

const onboardingTaskSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  onboardingInstance: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingInstance', required: true, index: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingTemplate', required: true, index: true },
  stepId: { type: mongoose.Schema.Types.ObjectId, required: true },
  stepOrder: { type: Number, required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  type: {
    type: String,
    enum: ['form', 'document', 'approval', 'setup', 'orientation', 'offer'],
    default: 'form',
  },
  assignedRole: {
    type: String,
    enum: ['super_admin', 'company_admin', 'hr', 'manager', 'it', 'employee'],
    required: true,
    index: true,
  },
  assignedToUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  assignedToEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'rejected', 'overdue'],
    default: 'pending',
    index: true,
  },
  dueDate: { type: Date, index: true },
  completedAt: { type: Date, default: null },
  startedAt: { type: Date, default: null },
  slaHours: { type: Number, default: 24 },
  reminderCount: { type: Number, default: 0 },
  lastReminderAt: { type: Date, default: null },
  notes: { type: String, trim: true, default: '' },
  completionPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

onboardingTaskSchema.index({ tenant: 1, assignedRole: 1, status: 1, dueDate: 1 });
onboardingTaskSchema.index({ tenant: 1, employee: 1, status: 1 });

module.exports = onboardingTaskSchema;
