const mongoose = require('mongoose');

const OnboardingTemplateSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true
  },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  isPublished: { type: Boolean, default: false },
  sections: [{
    id: { type: String, required: true },
    title: { type: String, required: true },
    order: { type: Number, default: 0 },
    fields: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      label: { type: String, required: true },
      type: { 
        type: String, 
        enum: ['text', 'number', 'date', 'file', 'select', 'checkbox', 'textarea', 'email', 'tel', 'url'],
        required: true 
      },
      isRequired: { type: Boolean, default: false },
      isPublic: { type: Boolean, default: true }, // Candidate visible
      options: [String], // For dropdowns
      placeholder: String,
      defaultValue: mongoose.Schema.Types.Mixed,
      validation: {
        regex: String,
        min: Number,
        max: Number,
        fileTypes: [String],
        maxSize: Number // in MB
      },
      order: { type: Number, default: 0 }
    }]
  }],
  isDefault: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  targetRoles: [{ type: String, trim: true }],
  isGlobal: { type: Boolean, default: false },
  steps: [{
    title: { type: String, required: true },
    description: { type: String, trim: true },
    type: { type: String, default: 'form' },
    order: { type: Number, required: true },
    assignedRole: { type: String, default: 'employee' },
    assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    dueInDays: { type: Number, default: 1 },
    slaHours: { type: Number, default: 24 },
    requiresDocument: { type: Boolean, default: false },
    documentType: { type: String, default: '' },
    checklist: [{ type: String }],
    instructions: { type: String, default: '' },
    isBlocking: { type: Boolean, default: true },
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'onboarding_templates'
});

// Unique code per tenant for system lookups
OnboardingTemplateSchema.index({ tenant: 1, code: 1 }, { unique: true });

// Compound index for version control
OnboardingTemplateSchema.index({ tenant: 1, name: 1, version: 1 }, { unique: true });
OnboardingTemplateSchema.index({ tenant: 1, isDefault: 1 });
OnboardingTemplateSchema.index({ tenant: 1, status: 1 });

module.exports = mongoose.model('OnboardingTemplate', OnboardingTemplateSchema);
