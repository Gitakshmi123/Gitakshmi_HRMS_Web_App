const mongoose = require('mongoose');

/**
 * Enterprise ShiftAssignment Schema (Phase 2 Module 1)
 *
 * Records which shift is assigned to an entity, supporting Priority Hierarchies:
 * Employee > Department > Branch > Company Default
 * 
 * Supports Future Assignment Queue and Effective Date logic.
 *
 * Multi-tenant: all documents scoped by `tenant` field.
 */

const shiftAssignmentSchema = new mongoose.Schema(
    {
        tenant: {
            type: String,
            required: true,
            index: true,
        },
        shiftMasterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ShiftMaster',
            required: [true, 'Shift reference is required'],
        },

        // ── ASSIGNMENT TARGET HIERARCHY ───────────────────────────────────
        entityType: {
            type: String,
            enum: ['Employee', 'Department', 'Designation', 'Branch', 'Location', 'Grade', 'Company'],
            required: true
        },
        entityId: {
            type: mongoose.Schema.Types.ObjectId,
            // Only required if not Company-wide default
            required: function() {
                return this.entityType !== 'Company';
            }
        },

        // ── EFFECTIVE DATES (FUTURE QUEUE & EXPIRATION) ───────────────────
        effectiveFrom: {
            type: Date,
            required: [true, 'Effective From date is required'],
        },
        effectiveTo: {
            type: Date,
            default: null,  // null = open-ended (runs indefinitely until superseded)
        },

        // ── OVERRIDE SUPPORT (For legacy compatibility & short terms) ─────
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
        assignedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
    },
    { timestamps: true }
);

// ── INDEXES ──────────────────────────────────────────────────────────────
// Fast lookup for finding active assignments for an entity
shiftAssignmentSchema.index({ tenant: 1, entityType: 1, entityId: 1, effectiveFrom: -1 });
// Find what shift an employee is assigned to today
shiftAssignmentSchema.index({ tenant: 1, isActive: 1, effectiveFrom: 1, effectiveTo: 1 });

module.exports = shiftAssignmentSchema;
