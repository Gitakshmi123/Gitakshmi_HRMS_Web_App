const mongoose = require('mongoose');

const BGVLogSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true
  },
  caseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BGVCase',
    required: true,
    index: true
  },
  checkId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BGVCheck'
  },
  action: {
    type: String,
    required: true
  },
  description: String,
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  oldStatus: String,
  newStatus: String,
  metadata: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true,
  collection: 'bgv_logs'
});

module.exports = mongoose.model('BGVLog', BGVLogSchema);
