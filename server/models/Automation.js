const mongoose = require('mongoose');

const AutomationSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  triggerEvent: { type: String, required: true, index: true }, // e.g. OFFER_LETTER_REQUESTED, EMPLOYEE_JOINED
  isActive: { type: Boolean, default: true },
  
  // Array of conditions (ALL must be true, or grouped). Simple structure:
  conditions: [{
    field: { type: String }, // e.g. 'department'
    operator: { type: String, enum: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than'] },
    value: { type: mongoose.Schema.Types.Mixed }
  }],

  // Actions to execute sequentially
  actions: [{
    type: { type: String, enum: ['SEND_EMAIL', 'TRIGGER_APPROVAL', 'WEBHOOK', 'ASSIGN_TASK'], required: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} }, // Action specific config
    order: { type: Number, default: 0 }
  }],
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = AutomationSchema;
