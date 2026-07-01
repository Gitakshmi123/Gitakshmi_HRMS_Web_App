const mongoose = require('mongoose');

const EmailTemplateSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  module: { type: String, required: true, trim: true },
  triggerType: { type: String, required: true, trim: true },
  recipientType: { type: String, trim: true },
  subject: { type: String, required: true },
  bodyHtml: { type: String, required: true },
  designJson: { type: Object },
  placeholders: [{ type: String }],
  sidebarVisibility: { type: Object, default: null },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Ensure unique template names per tenant and trigger type
EmailTemplateSchema.index({ tenantId: 1, triggerType: 1 }, { unique: false }); // One trigger can have multiple templates if we want to support "Select Template", but usually we want one default or let user pick.

module.exports = EmailTemplateSchema;
