const mongoose = require('mongoose');

const CompanyWorkflowConfigSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    unique: true,
    index: true
  },
  bgv: {
    isEnabled: { type: Boolean, default: false },
    triggerStage: { 
      type: String, 
      enum: ['PRE_OFFER', 'POST_OFFER', 'PRE_JOINING', 'POST_JOINING'],
      default: 'POST_OFFER'
    },
    defaultChecks: [{
      type: { type: String },
      isRequired: { type: Boolean, default: true }
    }],
    defaultSlaDays: { type: Number, default: 7 }
  },
  onboarding: {
    isEnabled: { type: Boolean, default: true },
    defaultTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingTemplate' },
    requiredDocuments: [String],
    autoInvite: { type: Boolean, default: false }
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  collection: 'company_workflow_configs'
});

module.exports = mongoose.model('CompanyWorkflowConfig', CompanyWorkflowConfigSchema);
