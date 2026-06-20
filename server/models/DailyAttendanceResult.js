const mongoose = require('mongoose');

/**
 * Enterprise DailyAttendanceResult Schema (Phase 3 Module 1)
 *
 * This is the ultimate output of the Attendance Intelligence Layer.
 * It stores the processed result of an employee's daily punches against the Shift Policy.
 *
 * Replaces hardcoded "Present/Absent" statuses with a comprehensive audit trail.
 */

const dailyAttendanceResultSchema = new mongoose.Schema(
    {
        tenant: {
            type: String,
            required: true,
            index: true,
        },
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        
        // ── SOURCE OF TRUTH ────────────────────────────────────────────────
        shiftMasterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ShiftMaster',
            required: true,
        },
        shiftPolicyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ShiftPolicy',
            required: true,
            description: 'The exact policy version used for these calculations'
        },

        // ── RAW DATA ──────────────────────────────────────────────────────
        firstPunch: { type: Date, default: null },
        lastPunch: { type: Date, default: null },
        totalWorkingMinutes: { type: Number, default: 0 },

        // ── INTELLIGENCE LAYER OUTPUT ─────────────────────────────────────
        status: {
            type: String,
            enum: ['Present', 'Absent', 'Half Day', 'Weekly Off', 'Holiday', 'Leave', 'Missing Punch'],
            required: true
        },
        
        lateMinutes: { type: Number, default: 0 },
        earlyExitMinutes: { type: Number, default: 0 },
        
        // Overtime Engine Output
        otMinutes: { type: Number, default: 0 },
        otMultiplierApplied: { type: Number, default: 1.0 },

        // Compliance Engine Flags
        complianceViolations: [{
            type: String // e.g. "MAX_HOURS_EXCEEDED", "REST_HOURS_VIOLATION"
        }],

        // ── PERMISSION ENGINE (If any permission was applied to excuse late/early)
        permissionUsed: {
            type: Boolean,
            default: false
        },
        permissionMinutesExcused: {
            type: Number,
            default: 0
        },

        // ── GOVERNANCE LAYER ──────────────────────────────────────────────
        isRegularized: {
            type: Boolean,
            default: false
        },
        regularizedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    { timestamps: true }
);

// One result per employee per day
dailyAttendanceResultSchema.index({ tenant: 1, employeeId: 1, date: 1 }, { unique: true });

// Analytics Indexes
dailyAttendanceResultSchema.index({ tenant: 1, date: 1, status: 1 });
dailyAttendanceResultSchema.index({ tenant: 1, date: 1, lateMinutes: -1 });

module.exports = dailyAttendanceResultSchema;
