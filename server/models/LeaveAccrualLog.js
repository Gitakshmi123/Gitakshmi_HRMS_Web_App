const mongoose = require('mongoose');

const LeaveAccrualLogSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true }, // 1-12
    executedAt: { type: Date, default: Date.now }
}, { timestamps: true });

LeaveAccrualLogSchema.index({ tenant: 1, year: 1, month: 1 }, { unique: true });

module.exports = LeaveAccrualLogSchema;
