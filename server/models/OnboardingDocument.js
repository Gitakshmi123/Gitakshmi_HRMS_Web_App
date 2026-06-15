const mongoose = require('mongoose');

const onboardingDocumentSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  onboardingInstance: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingInstance', required: true, index: true },
  task: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingTask', default: null, index: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  type: { type: String, required: true, trim: true, index: true },
  label: { type: String, trim: true, default: '' },
  fileName: { type: String, trim: true, required: true },
  originalName: { type: String, trim: true, required: true },
  mimeType: { type: String, trim: true, default: '' },
  size: { type: Number, default: 0 },
  path: { type: String, required: true, trim: true },
  storageProvider: { type: String, enum: ['local', 'cloudinary', 's3'], default: 'local', index: true },
  storageKey: { type: String, trim: true, default: '' },
  secureUrl: { type: String, trim: true, default: '' },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'resubmitted'],
    default: 'pending',
    index: true,
  },
  rejectionReason: { type: String, trim: true, default: '' },
  uploadedByRole: { type: String, trim: true, default: 'employee' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  version: { type: Number, default: 1 },
}, { timestamps: true });

onboardingDocumentSchema.index({ tenant: 1, employee: 1, type: 1, version: -1 });

module.exports = onboardingDocumentSchema;
