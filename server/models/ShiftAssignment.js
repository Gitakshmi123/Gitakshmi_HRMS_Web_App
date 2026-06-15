const mongoose = require('mongoose');

/**
 * ShiftAssignment Schema
 *
 * Records which shift is assigned to which employee, with date-range scoping.
 * Supports:
 *   - Standard assignment: employee assigned to a shift from effectiveFrom onwards
 *   - Temporary overrides: isOverride=true with overrideEndDate for short date ranges
 *
 * Multi-tenant: all documents scoped by `tenant` field.
 */

const shiftAssignmentSchema = new mongoose.Schema(
    {
        // ── EMPLOYEE & SHIFT REFERENCE ────────────────────────────────────
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: [true, 'Employee reference is required'],
        },
        shift: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, 'Shift reference is required'],
        },

        // ── EFFECTIVE DATES ───────────────────────────────────────────────
        effectiveFrom: {
            type: Date,
            required: [true, 'Effective From date is required'],
        },
        effectiveTo: {
            type: Date,
            default: null,  // null = open-ended (no end date)
        },

        // ── OVERRIDE SUPPORT ──────────────────────────────────────────────
        isOverride: {
            type: Boolean,
            default: false,  // true = temporary date-range override
        },
        overrideReason: {
            type: String,
            default: '',
        },

        // ── STATUS ────────────────────────────────────────────────────────
        isActive: {
            type: Boolean,
            default: true,
        },

        // ── META ──────────────────────────────────────────────────────────
        tenant: {
            type: String,
            required: true,
            index: true,
        },
        assignedBy: {
            type: String,  // user email or ID who assigned
            default: null,
        },
    },
    { timestamps: true }
);

// ── INDEXES ──────────────────────────────────────────────────────────────
// Composite: find active assignment for an employee on a date
shiftAssignmentSchema.index({ employee: 1, effectiveFrom: -1, tenant: 1 });
shiftAssignmentSchema.index({ tenant: 1, isActive: 1 });
shiftAssignmentSchema.index({ shift: 1, tenant: 1, isActive: 1 });
shiftAssignmentSchema.index({ employee: 1, tenant: 1, isActive: 1, isOverride: 1 });

module.exports = shiftAssignmentSchema;
