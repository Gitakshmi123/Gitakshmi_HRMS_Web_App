const mongoose = require('mongoose');

/**
 * Referral codes for Internal Jobs (per tenant DB).
 * Maps a short code -> referrer employee/user.
 */
const ReferralCodeSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  code: { type: String, required: true, trim: true, uppercase: true, index: true },
  referrerEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  referrerName: { type: String, trim: true, default: '' },
}, { timestamps: true });

ReferralCodeSchema.index({ tenant: 1, code: 1 }, { unique: true });

module.exports = ReferralCodeSchema;

