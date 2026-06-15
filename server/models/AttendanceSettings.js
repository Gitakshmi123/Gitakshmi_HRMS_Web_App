const mongoose = require('mongoose');

const AttendanceSettingsSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, unique: true },

    // Shift Configuration
    shiftStartTime: { type: String, default: "09:00" }, // 24hr format
    shiftEndTime: { type: String, default: "18:00" },

    // Grace & Thresholds
    graceTimeMinutes: { type: Number, default: 15 },
    lateMarkThresholdMinutes: { type: Number, default: 30 },
    halfDayThresholdHours: { type: Number, default: 4 },
    fullDayThresholdHours: { type: Number, default: 7 },

    // Weekly Off (0 = Sunday, 1 = Monday ...)
    weeklyOffDays: { type: [Number], default: [0] },

    // Policy Switches
    sandwichLeave: { type: Boolean, default: false },
    autoAbsent: { type: Boolean, default: true },
    attendanceLockDay: { type: Number, default: 25 }, // Day of month after which attendance is locked

    // Leave Policy Quota Configuration
    leaveCycleStartMonth: { type: Number, default: 0 }, // 0 = Jan, 3 = April etc.

    // ========== PUNCH POLICY CONFIGURATION ==========

    // Punch Mode: 'single', 'multiple' (legacy) or 'multi' (advanced)
    punchMode: { type: String, enum: ['single', 'multiple', 'multi'], default: 'single' },

    // Max punches per day (only applies if punchMode is 'multiple')
    maxPunchesPerDay: { type: Number, default: 10, min: 2 },

    // Action when max punches exceeded: 'block' or 'warn'
    maxPunchAction: { type: String, enum: ['block', 'warn'], default: 'block' },

    // Break Tracking
    breakTrackingEnabled: { type: Boolean, default: false },

    // Overtime Configuration
    overtimeAllowed: { type: Boolean, default: false },
    overtimeAfterShiftHours: { type: Boolean, default: true }, // Only count overtime after shift hours
    overtimeToPayroll: { type: Boolean, default: false }, // Send overtime to payroll

    // Geo-fencing Configuration
    geoFencingEnabled: { type: Boolean, default: false },
    officeLatitude: { type: Number }, // Office location latitude
    officeLongitude: { type: Number }, // Office location longitude
    allowedRadiusMeters: { type: Number, default: 100 }, // Allowed radius in meters


    geofance: [
        {
            lat: Number,
            lng: Number
        }
    ],
    allowedAccuracy: {
        type: Number,
        default: 80
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // IP Restriction Configuration
    ipRestrictionEnabled: { type: Boolean, default: false },
    allowedIPRanges: [{ type: String }], // Array of IP addresses or CIDR ranges (e.g., "192.168.1.0/24")
    allowedIPs: [{ type: String }], // Array of specific allowed IP addresses

    // Location Restriction Mode: 'none', 'geo', 'ip', 'both'
    locationRestrictionMode: { type: String, enum: ['none', 'geo', 'ip', 'both'], default: 'none' },

    // ========== ADVANCED ATTENDANCE POLICY (NON-BREAKING EXTENSIONS) ==========
    advancedPolicy: {
        // WEEKLY OFF SETTINGS & EMPLOYEE OVERRIDES
        weeklyOff: {
            mode: {
                type: String,
                enum: ['basic', 'sunday', 'saturday_sunday', 'alternate_saturday', 'custom'],
                default: 'basic'
            },
            // If true, treat Saturdays as half-day working by default
            saturdayHalfDayEnabled: { type: Boolean, default: false },
            // Alternate Saturday logic – e.g. workingWeeks: [1,3], offWeeks: [2,4]
            alternateSaturday: {
                workingWeeks: [{ type: Number }], // 1-5
                offWeeks: [{ type: Number }]
            },
            // Per-employee weekly off override without touching Employee schema
            employeeOverrides: [{
                employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
                weeklyOffDays: [{ type: Number }], // 0-6
                saturdayHalfDayEnabled: { type: Boolean, default: false }
            }]
        },

        // LATE MARK RULES
        lateMarkRules: {
            enabled: { type: Boolean, default: false },
            allowedLateMinutesPerDay: { type: Number, default: 0 },
            // Aggregation thresholds – evaluated at snapshot/payroll time
            lateMarksToHalfDay: { type: Number, default: 0 },
            lateMarksToFullDay: { type: Number, default: 0 },
            autoLeaveDeductionEnabled: { type: Boolean, default: false }
        },

        // EARLY EXIT RULES
        earlyExitRules: {
            enabled: { type: Boolean, default: false },
            allowedEarlyMinutesPerDay: { type: Number, default: 0 },
            earlyExitsToHalfDay: { type: Number, default: 0 },
            earlyExitsToFullDay: { type: Number, default: 0 }
        },

        // HALF-DAY RULES
        halfDayRules: {
            enabled: { type: Boolean, default: false },
            // If working hours < threshold -> Half day (if >0)
            workingHoursThreshold: { type: Number, default: 0 },
            // If late minutes > threshold -> Half day (if >0)
            lateMinutesThreshold: { type: Number, default: 0 },
            saturdayHalfDayEnabled: { type: Boolean, default: false }
        },

        // ABSENT / NO-PUNCH RULES
        absentRules: {
            // If true, days with no punches are auto-marked absent
            noPunchConsideredAbsent: { type: Boolean, default: true },
            // Behaviour when only IN or only OUT exists
            singlePunchBehaviour: {
                type: String,
                enum: ['half_day', 'absent'],
                default: 'half_day'
            },
            autoLeaveDeductionEnabled: { type: Boolean, default: false },
            convertToLopWhenNoLeave: { type: Boolean, default: false }
        },

        // LEAVE & ATTENDANCE INTEGRATION
        leaveIntegration: {
            // Priority order for auto leave deduction
            autoLeaveDeductionOrder: {
                type: [String],
                default: ['CL', 'SL', 'EL', 'Optional', 'LOP']
            },
            // Holiday + weekend sandwich rule extension
            sandwichRuleEnabled: { type: Boolean, default: false },
            // WFH counted as full present or half-day
            wfhPresentMode: {
                type: String,
                enum: ['present', 'half_day'],
                default: 'present'
            }
        },

        // WORK FROM HOME (WFH) SETTINGS
        wfhSettings: {
            enabled: { type: Boolean, default: false },
            gpsRestrictionEnabled: { type: Boolean, default: false },
            ipRestrictionEnabled: { type: Boolean, default: false },
            // 'auto_present' -> mark WFH as present automatically
            // 'requires_approval' -> rely on existing approval/regularization flow
            autoPresentMode: {
                type: String,
                enum: ['auto_present', 'requires_approval'],
                default: 'requires_approval'
            }
        },

        // ON-DUTY (OD) RULES
        odSettings: {
            enabled: { type: Boolean, default: false },
            approvalRequired: { type: Boolean, default: true },
            odCountMode: {
                type: String,
                enum: ['present', 'half_day', 'custom'],
                default: 'present'
            }
        },

        // COMP-OFF SETTINGS
        compOffSettings: {
            enabled: { type: Boolean, default: false },
            autoCreditOnHolidayWork: { type: Boolean, default: false },
            expiryDays: { type: Number, default: 30 },
            approvalRequired: { type: Boolean, default: true }
        },

        // DEVICE & PUNCH-SOURCE SETTINGS
        deviceSettings: {
            // Allowed punch sources; if empty treat as "all"
            allowedSources: [{
                type: String,
                enum: ['biometric', 'mobile', 'web']
            }],
            faceRecognitionMandatory: { type: Boolean, default: false },
            webCheckinAllowed: { type: Boolean, default: true }
        },

        // MANUAL ATTENDANCE CORRECTION WORKFLOW (leverages Regularization module)
        manualCorrectionWorkflow: {
            enabled: { type: Boolean, default: true },
            requireManagerApproval: { type: Boolean, default: true },
            requireHrApproval: { type: Boolean, default: true }
        },

        // NIGHT SHIFT LOGIC
        nightShiftRules: {
            enabled: { type: Boolean, default: false },
            shiftSpansMidnight: { type: Boolean, default: false },
            nightShiftAllowanceEnabled: { type: Boolean, default: false },
            nightShiftAllowanceCode: { type: String },
            overtimeSeparateForNightShift: { type: Boolean, default: false }
        }
    },

    // Audit Details
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
}, { timestamps: true });

module.exports = AttendanceSettingsSchema;
