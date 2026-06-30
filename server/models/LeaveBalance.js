const mongoose = require('mongoose');

const LeaveBalanceSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },

    // Reference to policy for rules
    policy: { type: mongoose.Schema.Types.ObjectId, ref: 'LeavePolicy' },

    leaveType: { type: String, required: true }, // copy from policy rule

    year: { type: Number, required: true }, // e.g., 2025

    total: { type: Number, default: 0 },    // Allocation
    used: { type: Number, default: 0 },     // Approved leaves
    pending: { type: Number, default: 0 },  // Applied but not approved

    opening: { type: Number, default: 0 },
    accrued: { type: Number, default: 0 },
    isOpeningManual: { type: Boolean, default: false },

    // Available = Total - Used - Pending (Calculated or Stored)
    // Stored is faster for read, needs transaction update
    available: { type: Number, default: 0 },

    // Eligibility metadata — when will this balance become active
    eligibleFrom: { type: Date, default: null },
    locked: { type: Boolean, default: false },
    expiresAt: { type: Date, default: null },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} }

}, { timestamps: true });

// Ensure available is updated before save
LeaveBalanceSchema.pre('save', function () {
    this.available = this.total - this.used - this.pending;
});

LeaveBalanceSchema.index({ tenant: 1, employee: 1, year: 1 });
LeaveBalanceSchema.index({ tenant: 1, employee: 1, leaveType: 1, year: 1 }, { unique: true });

module.exports = LeaveBalanceSchema;
