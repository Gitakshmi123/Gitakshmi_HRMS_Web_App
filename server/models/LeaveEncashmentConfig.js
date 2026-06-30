const mongoose = require('mongoose');

const LeaveEncashmentConfigSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    allowed: { type: Boolean, default: false },
    leaveType: { type: String, default: 'EL', trim: true },
    formula: { type: String, default: 'Basic / 30', trim: true },
    minBalanceRetain: { type: Number, default: 15 },
    maxEncashableDays: { type: Number, default: 10 },
    taxRule: { type: String, default: 'Exempt up to 3 Lakhs', trim: true }
}, { timestamps: true });

LeaveEncashmentConfigSchema.index({ tenant: 1 }, { unique: true });

module.exports = LeaveEncashmentConfigSchema;
