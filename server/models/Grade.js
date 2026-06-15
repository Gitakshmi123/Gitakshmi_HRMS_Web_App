const mongoose = require('mongoose');
const TIME_HHMM_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const timeField = {
  type: String,
  trim: true,
  default: '',
  validate: {
    validator(value) {
      return !value || TIME_HHMM_PATTERN.test(value);
    },
    message: 'Time must be in HH:mm format',
  },
};

const benefitSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Benefit name is required'],
    trim: true,
    maxlength: 120,
  },
  code: {
    type: String,
    trim: true,
    uppercase: true,
    maxlength: 60,
    default: '',
  },
  type: {
    type: String,
    enum: ['ALLOWANCE', 'INSURANCE', 'RETIREMENT', 'LEAVE', 'PERK', 'CUSTOM'],
    default: 'CUSTOM',
  },
  valueType: {
    type: String,
    enum: ['FIXED', 'PERCENTAGE', 'TEXT', 'BOOLEAN'],
    default: 'TEXT',
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  },
  isTaxable: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { _id: false });

const attendanceRulesSchema = new mongoose.Schema({
  timingType: {
    type: String,
    enum: ['fixed', 'flexible'],
    default: 'fixed',
  },
  shiftStartTime: timeField,
  shiftEndTime: timeField,
  flexibleWindowStart: timeField,
  flexibleWindowEnd: timeField,
  requiredWorkMinutes: {
    type: Number,
    min: 0,
    default: null,
  },
  workingHoursPerDay: {
    type: Number,
    min: 0,
    max: 24,
    default: 8,
  },
  graceLateMinutes: {
    type: Number,
    min: 0,
    default: 0,
  },
  graceEarlyMinutes: {
    type: Number,
    min: 0,
    default: 0,
  },
  halfDayThresholdHours: {
    type: Number,
    min: 0,
    max: 24,
    default: 4,
  },
  fullDayThresholdHours: {
    type: Number,
    min: 0,
    max: 24,
    default: 8,
  },
  weeklyOffDays: {
    type: [Number],
    validate: {
      validator(days) {
        return Array.isArray(days) && days.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
      },
      message: 'weeklyOffDays must contain day numbers from 0 to 6',
    },
    default: [0],
  },
  overtimeEligible: {
    type: Boolean,
    default: false,
  },
  overtimeStartsAfterMinutes: {
    type: Number,
    min: 0,
    default: 0,
  },
  leaveDeductionOrder: {
    type: [String],
    default: [],
  },
  autoMarkAbsentOnNoPunch: {
    type: Boolean,
    default: true,
  },
  lateMarkEnabled: {
    type: Boolean,
    default: true,
  },
  allowedLateMinutesPerDay: {
    type: Number,
    min: 0,
    default: 0,
  },
  lateMarksToHalfDay: {
    type: Number,
    min: 0,
    default: 0,
  },
  lateMarksToFullDay: {
    type: Number,
    min: 0,
    default: 0,
  },
  earlyExitEnabled: {
    type: Boolean,
    default: true,
  },
  earlyExitsToHalfDay: {
    type: Number,
    min: 0,
    default: 0,
  },
  earlyExitsToFullDay: {
    type: Number,
    min: 0,
    default: 0,
  },
  autoLeaveDeductionEnabled: {
    type: Boolean,
    default: false,
  },
}, { _id: false });

const leaveRuleSchema = new mongoose.Schema({
  leaveType: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  totalPerYear: {
    type: Number,
    min: 0,
    default: 0,
  },
  monthlyAccrual: {
    type: Boolean,
    default: false,
  },
  accrualType: {
    type: String,
    enum: ['yearly', 'monthly'],
    default: 'yearly',
  },
  monthlyAccrualRate: {
    type: Number,
    min: 0,
    default: 0,
  },
  carryForwardAllowed: {
    type: Boolean,
    default: false,
  },
  maxCarryForward: {
    type: Number,
    min: 0,
    default: 0,
  },
  maxLeaveCap: {
    type: Number,
    min: 0,
    default: 0,
  },
  expiryMonths: {
    type: Number,
    min: 0,
    default: 0,
  },
  encashmentAllowed: {
    type: Boolean,
    default: false,
  },
  requiresApproval: {
    type: Boolean,
    default: true,
  },
  allowDuringProbation: {
    type: Boolean,
    default: false,
  },
  minimumTenureMonths: {
    type: Number,
    min: 0,
    default: 0,
  },
  prorateForNewJoiners: {
    type: Boolean,
    default: true,
  },
  color: {
    type: String,
    default: '#3b82f6',
  },
}, { _id: false });

const gradeSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Grade name is required'],
    trim: true,
    minlength: 2,
    maxlength: 120,
  },
  normalizedName: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  code: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 60,
  },
  level: {
    type: Number,
    required: [true, 'Grade level is required'],
    min: 1,
    max: 999,
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  },
  benefits: {
    type: [benefitSchema],
    default: [],
  },
  attendanceRules: {
    type: attendanceRulesSchema,
    default: () => ({}),
  },
  leaveRules: {
    type: [leaveRuleSchema],
    default: [],
  },
  effectiveFrom: {
    type: Date,
    default: null,
  },
  effectiveTo: {
    type: Date,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

gradeSchema.index({ tenant: 1, normalizedName: 1, isDeleted: 1 }, { unique: true });
gradeSchema.index({ tenant: 1, code: 1, isDeleted: 1 }, { unique: true });
gradeSchema.index({ tenant: 1, level: 1, isDeleted: 1 });

gradeSchema.pre('validate', function normalizeGrade(next) {
  if (this.name) {
    this.name = this.name.trim();
    this.normalizedName = this.name.toLowerCase();
  }

  if (!this.code && this.name) {
    this.code = this.name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  next();
});

module.exports = gradeSchema;
