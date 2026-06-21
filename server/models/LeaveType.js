const mongoose = require('mongoose');

const LeaveTypeSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true }, // e.g. "Earned Leave"
    code: { type: String, required: true, trim: true, uppercase: true }, // e.g. "EL"
    description: { type: String, trim: true },
    isPaid: { type: Boolean, default: true },
    isHalfDayAllowed: { type: Boolean, default: false },
    isAttachmentRequired: { type: Boolean, default: false },
    isCarryForwardEligible: { type: Boolean, default: false },
    isEncashmentEligible: { type: Boolean, default: false },
    isNegativeBalanceAllowed: { type: Boolean, default: false },
    color: { type: String, default: '#3b82f6' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

LeaveTypeSchema.index({ tenant: 1, code: 1 }, { unique: true });

module.exports = LeaveTypeSchema;
