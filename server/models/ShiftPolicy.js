const mongoose = require('mongoose');

/**
 * Enterprise Shift Policy Schema
 * Holds the Dynamic JSON Rules for a specific Shift Master.
 * This supports versioning (Effective Date) for Audit Replay.
 */
const ShiftPolicySchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    shiftMasterId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftMaster', required: true, index: true },
    
    // Policy Versioning
    version: { type: Number, required: true, default: 1 },
    effectiveFrom: { type: Date, required: true }, // When this policy becomes active
    isCurrent: { type: Boolean, default: true },

    // TAB 2: ATTENDANCE RULES (Dynamic Rule Engine JSON)
    attendanceRules: {
        // Example: IF Late > 15 Min THEN Late Mark
        lateMarks: [{
            conditionType: { type: String, enum: ['GREATER_THAN', 'LESS_THAN'] },
            minutes: { type: Number },
            action: { type: String, enum: ['LATE_MARK', 'HALF_DAY', 'ABSENT', 'DEDUCT_LEAVE'] },
            leaveTypeToDeduct: { type: String } // Optional: CL, PL, SL
        }],
        // Example: IF Early Exit > 30 Min THEN Half Day
        earlyExit: [{
            conditionType: { type: String, enum: ['GREATER_THAN', 'LESS_THAN'] },
            minutes: { type: Number },
            action: { type: String, enum: ['LATE_MARK', 'HALF_DAY', 'ABSENT', 'DEDUCT_LEAVE'] }
        }],
        // Minimum hours thresholds
        absentThresholdMinutes: { type: Number, default: 240 } // IF Working Hours < 4 (240 min) THEN Absent
    },

    // TAB 3: PERMISSION ENGINE
    permissionEngine: {
        allowedDurations: [{ type: Number }], // e.g. [15, 30, 60, 120]
        monthlyLimitCount: { type: Number, default: 2 },
        monthlyLimitMinutes: { type: Number, default: 120 },
        yearlyLimitCount: { type: Number, default: 24 },
        requiresApproval: { type: Boolean, default: true }
    },

    // TAB 4: OVERTIME ENGINE
    overtimeEngine: {
        isEligible: { type: Boolean, default: false },
        minimumMinutesToQualify: { type: Number, default: 60 },
        maximumMinutesPerDay: { type: Number, default: 240 },
        
        // Multipliers
        normalMultiplier: { type: Number, default: 1.0 },
        holidayMultiplier: { type: Number, default: 2.0 },
        weeklyOffMultiplier: { type: Number, default: 2.0 },
        nightShiftMultiplier: { type: Number, default: 1.5 },

        requiresApproval: { type: Boolean, default: true }
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

// Ensure a single current version per shift
ShiftPolicySchema.index({ tenant: 1, shiftMasterId: 1, isCurrent: 1 });
ShiftPolicySchema.index({ tenant: 1, shiftMasterId: 1, version: 1 }, { unique: true });

module.exports = ShiftPolicySchema;
