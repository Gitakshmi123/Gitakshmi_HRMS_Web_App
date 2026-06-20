const mongoose = require('mongoose');

/**
 * Enterprise Shift Master Schema
 * Stores the core static details of a shift.
 * Dynamic Rules (Late Marks, OT, Half Day) are stored in ShiftPolicy.
 */
const ShiftMasterSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: [true, 'Shift name is required'], trim: true },
    code: { type: String, required: [true, 'Shift code is required'], uppercase: true, trim: true },
    description: { type: String, trim: true },
    
    // Support: General Shift, Morning Shift, Evening Shift, Night Shift, Flexible Shift
    type: { 
        type: String, 
        enum: ['General', 'Morning', 'Evening', 'Night', 'Flexible'], 
        default: 'General' 
    },

    // Core Timing
    coreTiming: {
        startTime: { type: String, required: true }, // Format HH:mm
        endTime: { type: String, required: true },   // Format HH:mm
        isNightShiftAcrossMidnight: { type: Boolean, default: false } // Important for date calculations
    },

    // Working Hours
    workingHours: {
        minimumHoursForFullDay: { type: Number, required: true }, // in minutes
        minimumHoursForHalfDay: { type: Number, required: true }  // in minutes
    },

    // Break Rules
    breakRules: {
        duration: { type: Number, default: 60 }, // in minutes
        isPaid: { type: Boolean, default: false },
        flexibleBreak: { type: Boolean, default: true },
        breakStartTime: { type: String }, // Optional fixed break time
        breakEndTime: { type: String }
    },

    // Punch Mode Requirements
    punchMode: {
        requiresWebPunch: { type: Boolean, default: true },
        requiresMobilePunch: { type: Boolean, default: true },
        requiresBiometric: { type: Boolean, default: true },
        requiresFaceId: { type: Boolean, default: false }
    },

    // Location Rules
    locationRules: {
        geofenceEnabled: { type: Boolean, default: false },
        allowedLocations: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Location' }]
    },

    // Validity & Status
    status: {
        type: String,
        enum: ['Active', 'Inactive', 'Draft'],
        default: 'Active'
    },
    validFrom: { type: Date, required: true },
    validTo: { type: Date },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

// Ensure uniqueness per tenant
ShiftMasterSchema.index({ tenant: 1, code: 1 }, { unique: true });

module.exports = ShiftMasterSchema;
