const mongoose = require('mongoose');

/**
 * Shift Schema – Enterprise Edition
 * Covers all 13 policy sections for a complete attendance policy engine.
 * Multi-tenant: all documents are scoped by `tenant` field.
 * Backward-compatible: all legacy fields preserved.
 */

// ─── SUB-SCHEMA: Punch Mode ────────────────────────────────────────────────
const punchModeSchema = new mongoose.Schema({
    mode: { type: String, enum: ['single', 'multi'], default: 'single' },
    breakTrackingEnabled: { type: Boolean, default: false },
    deductBreakFromHours: { type: Boolean, default: true },
    autoDetectBreakFromGaps: { type: Boolean, default: false },
    autoBreakGapMinutes: { type: Number, default: 30, min: 0 },
}, { _id: false });

// ─── SUB-SCHEMA: Overtime ─────────────────────────────────────────────────
const overtimeSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    trackingEnabled: { type: Boolean, default: false },
    startAfterMinutes: { type: Number, default: 30, min: 0 },
    separateNightOT: { type: Boolean, default: false },
    compensationMode: {
        type: String,
        enum: ['NONE', 'HOURLY_RATE', 'FIXED_PER_HOUR'],
        default: 'NONE',
    },
    multiplier: { type: Number, default: 1.0, min: 0 },
    fixedHourlyRate: { type: Number, default: 0, min: 0 },
    earningLabel: { type: String, default: 'Overtime Pay' },
    earningCode: { type: String, default: 'OT' },
    roundingMode: {
        type: String,
        enum: ['none', 'round_up_15', 'round_up_30', 'round_down_15', 'round_down_30'],
        default: 'none',
    },
}, { _id: false });

// ─── SUB-SCHEMA: Location & Source ────────────────────────────────────────
const locationCfgSchema = new mongoose.Schema({
    allowedSources: {
        type: [String],
        enum: ['biometric', 'mobile', 'web'],
        default: ['biometric', 'mobile', 'web'],
    },
    webCheckinAllowed: { type: Boolean, default: true },
    faceRecognitionMandatory: { type: Boolean, default: false },
    geoFencingEnabled: { type: Boolean, default: false },
    geoFenceRadiusMeters: { type: Number, default: 100, min: 0 },
    geoFenceLatitude: { type: Number, default: null },
    geoFenceLongitude: { type: Number, default: null },
    ipRestrictionEnabled: { type: Boolean, default: false },
    allowedIPs: { type: [String], default: [] },
}, { _id: false });

// ─── SUB-SCHEMA: Working Hours & Thresholds ───────────────────────────────
const workingHoursCfgSchema = new mongoose.Schema({
    fullDayThresholdHours: { type: Number, default: 7, min: 0 },
    halfDayThresholdHours: { type: Number, default: 4, min: 0 },
    graceLateMinutes: { type: Number, default: 15, min: 0 },
    graceEarlyMinutes: { type: Number, default: 15, min: 0 },
}, { _id: false });

// ─── SUB-SCHEMA: Auto Absent & Sandwich ───────────────────────────────────
const absentCfgSchema = new mongoose.Schema({
    autoMarkAbsentOnNoPunch: { type: Boolean, default: true },
    sandwichLeaveEnabled: { type: Boolean, default: false },
    sandwichWeekendFill: { type: Boolean, default: false },
    sandwichHolidayFill: { type: Boolean, default: false },
}, { _id: false });

// ─── SUB-SCHEMA: Weekly Off & Saturday ────────────────────────────────────
const weeklyOffCfgSchema = new mongoose.Schema({
    mode: {
        type: String,
        enum: ['basic', 'custom', 'alternate_saturday'],
        default: 'basic',
    },
    days: { type: [Number], default: [0] },           // 0=Sun … 6=Sat
    saturdayMode: {
        type: String,
        enum: ['full_off', 'half_day', 'alternate_2nd_4th', 'full_working', 'alternate_1st_3rd', 'custom'],
        default: 'full_off',
    },
    customSaturdayPolicy: { type: String, default: '' }, // description when saturdayMode = 'custom'
    alternateSaturdayOffWeeks: { type: [Number], default: [2, 4] }, // which weeks are off
    employeeOverrideAllowed: { type: Boolean, default: false },
}, { _id: false });


// ─── SUB-SCHEMA: Late Mark Rules (Advanced) ───────────────────────────────
const lateMarkRulesSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    allowedLateMinutesPerDay: { type: Number, default: 0, min: 0 },
    lateMarksToHalfDay: { type: Number, default: 3, min: 1 },
    lateMarksToFullDay: { type: Number, default: 6, min: 1 },
    autoLeaveDeduction: { type: Boolean, default: false },
    leaveDeductionPriority: {
        type: [String],
        enum: ['CL', 'SL', 'EL', 'Optional', 'LOP'],
        default: ['CL', 'SL', 'EL', 'Optional', 'LOP'],
    },
}, { _id: false });

// ─── SUB-SCHEMA: Early Exit Rules ─────────────────────────────────────────
const earlyExitRulesSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    allowedEarlyMinutesPerDay: { type: Number, default: 0, min: 0 },
    earlyExitsToHalfDay: { type: Number, default: 3, min: 1 },
    earlyExitsToFullDay: { type: Number, default: 6, min: 1 },
}, { _id: false });

// ─── SUB-SCHEMA: Half Day & Absent Rules ──────────────────────────────────
const halfDayRulesSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    halfDayIfWorkedLessThanHours: { type: Number, default: 4, min: 0 },
    halfDayIfLateMoreThanMinutes: { type: Number, default: 120, min: 0 },
    noPunchEqualsAbsent: { type: Boolean, default: true },
    onlyInNoOutBehaviour: {
        type: String,
        enum: ['half_day', 'lop', 'absent'],
        default: 'half_day',
    },
    convertToLOPIfNoLeave: { type: Boolean, default: true },
}, { _id: false });

// ─── SUB-SCHEMA: Leave Integration ────────────────────────────────────────
const leaveIntegrationSchema = new mongoose.Schema({
    autoLeaveDeductionEnabled: { type: Boolean, default: false },
    deductionPriority: {
        type: [String],
        enum: ['CL', 'SL', 'EL', 'Optional', 'LOP'],
        default: ['CL', 'SL', 'EL', 'Optional', 'LOP'],
    },
    convertDeficitToLOP: { type: Boolean, default: true },
}, { _id: false });

// ─── SUB-SCHEMA: WFH Settings ─────────────────────────────────────────────
const wfhSettingsSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    gpsValidationRequired: { type: Boolean, default: false },
    ipRestrictionRequired: { type: Boolean, default: false },
    autoPresentMode: {
        type: String,
        enum: ['full_day', 'half_day'],
        default: 'full_day',
    },
}, { _id: false });

// ─── SUB-SCHEMA: OD Settings ──────────────────────────────────────────────
const odSettingsSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    approvalRequired: { type: Boolean, default: true },
    approvalLevels: {
        type: [String],
        enum: ['manager', 'hr'],
        default: ['manager', 'hr'],
    },
    countAsPresent: { type: Boolean, default: true },
}, { _id: false });

// ─── SUB-SCHEMA: Comp-Off Settings ────────────────────────────────────────
const compOffSettingsSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    autoCreditOnHolidayWork: { type: Boolean, default: true },
    autoCreditOnWeeklyOffWork: { type: Boolean, default: true },
    expiryDays: { type: Number, default: 90, min: 0 },
}, { _id: false });

// ─── SUB-SCHEMA: Night Shift Rules ────────────────────────────────────────
const nightShiftRulesSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: false },
    shiftSpansMidnight: { type: Boolean, default: false },
    attendanceDateAsShiftStart: { type: Boolean, default: true },
    separateOTForNight: { type: Boolean, default: false },
    allowanceEnabled: { type: Boolean, default: false },
    allowanceCode: { type: String, default: '' },  // payroll integration code
    allowanceAmount: { type: Number, default: 0, min: 0 },
    allowanceLabel: { type: String, default: 'Night Shift Allowance' },
    allowanceTaxable: { type: Boolean, default: true },
}, { _id: false });

// ─── SUB-SCHEMA: Correction Workflow ──────────────────────────────────────
const correctionWorkflowSchema = new mongoose.Schema({
    regularizationLevels: {
        type: [String],
        enum: ['employee', 'manager', 'hr'],
        default: ['employee', 'manager', 'hr'],
    },
    cutoffDays: { type: Number, default: 7, min: 0 },  // lock after N days
}, { _id: false });

// ─── LEGACY: attendance rules (kept for backward-compat) ──────────────────
const attendanceRulesSchema = new mongoose.Schema({
    markLateAfter: { type: Number, default: 15, min: 0 },
    markHalfDayAfter: { type: Number, default: 120, min: 0 },
    markAbsentAfter: { type: Number, default: 240, min: 0 },
    minWorkingHours: { type: Number, default: 8, min: 0 },
    overtimeAllowed: { type: Boolean, default: false },
    overtimeStartAfter: { type: Number, default: 30, min: 0 },
}, { _id: false });

// ═══════════════════════════════════════════════════════════════════════════
//  MAIN SHIFT SCHEMA
// ═══════════════════════════════════════════════════════════════════════════
const shiftSchema = new mongoose.Schema(
    {
        // ── 1) BASIC DETAILS ─────────────────────────────────────────────
        name: { type: String, required: [true, 'Shift name is required'], trim: true },
        code: { type: String, required: [true, 'Shift code is required'], trim: true, uppercase: true },
        shiftType: {
            type: String,
            enum: ['Day Shift', 'Night Shift', 'General Shift', 'Rotational Shift', 'Custom Shift'],
            default: 'General Shift',
        },
        description: { type: String, default: '' },

        // ── TIMING (core – backward-compat) ──────────────────────────────
        startTime: { type: String, required: [true, 'Start time is required'] },
        endTime: { type: String, required: [true, 'End time is required'] },
        isNightShift: { type: Boolean, default: false },
        breakMinutes: { type: Number, default: 30, min: 0 },
        graceMinutes: { type: Number, default: 15, min: 0 },   // legacy compat
        graceEarly: { type: Number, default: 15, min: 0 },     // legacy compat
        lateThreshold: { type: Number, default: 30, min: 0 },  // legacy compat
        weeklyOffs: { type: [Number], default: [0] },          // legacy compat

        // ── 2) PUNCH MODE ─────────────────────────────────────────────────
        punchMode: { type: punchModeSchema, default: () => ({}) },

        // ── 3) OVERTIME ───────────────────────────────────────────────────
        overtimeCfg: { type: overtimeSchema, default: () => ({}) },

        // ── 4) LOCATION & SOURCE ──────────────────────────────────────────
        locationCfg: { type: locationCfgSchema, default: () => ({}) },

        // ── 5) WORKING HOURS & THRESHOLDS ─────────────────────────────────
        workingHoursCfg: { type: workingHoursCfgSchema, default: () => ({}) },

        // ── 6) AUTO ABSENT & SANDWICH ─────────────────────────────────────
        absentCfg: { type: absentCfgSchema, default: () => ({}) },

        // ── 7) WEEKLY OFF & SATURDAY ──────────────────────────────────────
        weeklyOffCfg: { type: weeklyOffCfgSchema, default: () => ({}) },

        // ── 8) LATE MARK RULES ────────────────────────────────────────────
        lateMarkRules: { type: lateMarkRulesSchema, default: () => ({}) },

        // ── 9) EARLY EXIT RULES ───────────────────────────────────────────
        earlyExitRules: { type: earlyExitRulesSchema, default: () => ({}) },

        // ── 10) HALF DAY & ABSENT RULES ───────────────────────────────────
        halfDayRules: { type: halfDayRulesSchema, default: () => ({}) },

        // ── 11) LEAVE INTEGRATION ─────────────────────────────────────────
        leaveIntegration: { type: leaveIntegrationSchema, default: () => ({}) },
        wfhSettings: { type: wfhSettingsSchema, default: () => ({}) },
        odSettings: { type: odSettingsSchema, default: () => ({}) },
        compOffSettings: { type: compOffSettingsSchema, default: () => ({}) },

        // ── 12) NIGHT SHIFT & CORRECTION ──────────────────────────────────
        nightShiftRules: { type: nightShiftRulesSchema, default: () => ({}) },
        correctionWorkflow: { type: correctionWorkflowSchema, default: () => ({}) },

        // ── 13) VALIDITY & STATUS ─────────────────────────────────────────
        effectiveFrom: { type: Date, required: [true, 'Effective From date is required'] },
        effectiveTo: { type: Date, default: null },
        status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },

        // ── LEGACY ATTENDANCE RULES (backward-compat) ────────────────────
        attendanceRules: { type: attendanceRulesSchema, default: () => ({}) },
        alternateSaturday: { type: Boolean, default: false },
        allowWeeklyOffOverride: { type: Boolean, default: false },

        // ── META ──────────────────────────────────────────────────────────
        tenant: { type: String, required: true, index: true },

        createdBy: { type: String, default: null },
        isDeleted: { type: Boolean, default: false, index: true },
        isActive: { type: Boolean, default: true },  // legacy compat
    },
    { timestamps: true }
);

// ── INDEXES ──────────────────────────────────────────────────────────────
shiftSchema.index({ code: 1, tenant: 1 }, { unique: true });
shiftSchema.index({ tenant: 1, isDeleted: 1, status: 1 });

module.exports = shiftSchema;
