const mongoose = require('mongoose');

const pathPointSchema = new mongoose.Schema({
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  accuracy: { type: Number, default: null },
  speed: { type: Number, default: null },
  heading: { type: Number, default: null },
  altitude: { type: Number, default: null },
  timestamp: { type: Date, default: Date.now },
  source: {
    type: String,
    enum: ['CHECK_IN', 'TRACKER', 'CHECK_OUT', 'CLIENT_MEETING'],
    default: 'TRACKER'
  },
  securityFlags: [{ type: String, trim: true }],
  mocked: { type: Boolean, default: false }
}, { _id: false });

const AttendanceSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  employeeId: { type: String, trim: true, default: '' },
  date: { type: Date, required: true, index: true },

  // High-Level Status
  status: {
    type: String,
    enum: ['present', 'absent', 'leave', 'holiday', 'weekly_off', 'half_day', 'missed_punch'],
    default: 'absent'
  },
  leaveType: { type: String },
  leaveColor: { type: String },

  // Punch Details
  scheduledIn: { type: Date, default: null },
  scheduledOut: { type: Date, default: null },
  checkIn: { type: Date },
  checkOut: { type: Date },
  checkInTime: { type: Date, default: null },
  checkOutTime: { type: Date, default: null },

  // Multi-punch log (for detailed audit)
  logs: [{
    time: { type: Date },
    type: { type: String, enum: ['IN', 'OUT'] },
    device: { type: String },
    location: { type: String },
    method: {
      type: String,
      enum: ['FACE', 'FACE_GPS', 'MANUAL', 'GPS', 'SYSTEM'],
      default: 'SYSTEM'
    },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null },
    heading: { type: Number, default: null },
    securityFlags: [{ type: String }],
    deviceFingerprint: { type: String, trim: true }
  }],

  checkInLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null },
    heading: { type: Number, default: null },
    altitude: { type: Number, default: null },
    timestamp: { type: Date, default: null }
  },
  checkOutLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null },
    heading: { type: Number, default: null },
    altitude: { type: Number, default: null },
    timestamp: { type: Date, default: null }
  },
  gpsLocation: {
    lat: { type: Number, default: null },
    lng: { type: Number, default: null }
  },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  accuracy: { type: Number, default: null },
  pathPoints: {
    type: [pathPointSchema],
    default: []
  },
  faceVerified: { type: Boolean, default: false, index: true },
  gpsValidated: { type: Boolean, default: false },
  verificationStatus: {
    type: String,
    enum: ['VERIFIED', 'FLAGGED', 'REJECTED'],
    default: 'VERIFIED'
  },
  flagged: { type: Boolean, default: false, index: true },
  flagReason: { type: String, trim: true, default: '' },
  flagReasons: [{ type: String, trim: true }],
  faceConfidence: { type: Number, default: 0 },
  deviceType: {
    type: String,
    enum: ['mobile', 'desktop'],
    default: 'desktop'
  },
  deviceId: { type: String, trim: true, default: '' },
  deviceFingerprint: { type: String, trim: true, default: '' },
  deviceInfo: {
    fingerprint: { type: String, trim: true, default: '' },
    deviceType: {
      type: String,
      enum: ['mobile', 'desktop'],
      default: 'desktop'
    },
    userAgent: { type: String, trim: true, default: '' },
    platform: { type: String, trim: true, default: '' },
    language: { type: String, trim: true, default: '' },
    timezone: { type: String, trim: true, default: '' },
    hardwareConcurrency: { type: Number, default: null },
    deviceMemory: { type: Number, default: null }
  },
  faceVerification: {
    verifiedAt: { type: Date, default: null },
    livenessScore: { type: Number, default: 0 },
    matchScore: { type: Number, default: 0 },
    similarity: { type: Number, default: 0 },
    method: { type: String, default: 'SYSTEM' }
  },
  checkInImage: { type: String, default: '' },
  checkOutImage: { type: String, default: '' },
  tracking: {
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LiveTrackingSession', default: null },
    status: {
      type: String,
      enum: ['IDLE', 'ACTIVE', 'PAUSED', 'STOPPED', 'SUSPICIOUS'],
      default: 'IDLE'
    },
    startedAt: { type: Date, default: null },
    stoppedAt: { type: Date, default: null },
    lastHeartbeatAt: { type: Date, default: null },
    recommendedIntervalSec: { type: Number, default: 15 },
    lastLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      speed: { type: Number, default: null },
      heading: { type: Number, default: null },
      altitude: { type: Number, default: null },
      timestamp: { type: Date, default: null }
    }
  },
  securityFlags: [{ type: String }],

  // Calculated Metrics
  workingHours: { type: Number, default: 0 }, // In hours
  overtimeHours: { type: Number, default: 0 }, // Overtime hours (calculated if overtime is enabled)
  isLate: { type: Boolean, default: false },
  isEarlyOut: { type: Boolean, default: false },

  // Advanced Metrics (non-breaking additions)
  lateMinutes: { type: Number, default: 0 },          // Minutes late beyond shift start
  earlyExitMinutes: { type: Number, default: 0 },     // Minutes early before shift end

  // Advanced Policy Flags (WFH / OD / Comp-off / Night Shift)
  isWFH: { type: Boolean, default: false },           // Work From Home day
  isOnDuty: { type: Boolean, default: false },        // On Duty day
  isCompOffDay: { type: Boolean, default: false },    // Comp-off consumed today
  isNightShift: { type: Boolean, default: false },    // Shift spans past midnight

  // Loss of Pay (derived) – fraction of day converted to LOP (e.g., 0.5, 1)
  lopDays: { type: Number, default: 0 },

  // Rules Engine Traceability
  ruleEngineVersion: { type: Number, default: 1 },
  ruleEngineMeta: { type: mongoose.Schema.Types.Mixed },

  // Metadata
  isManualOverride: { type: Boolean, default: false },
  overrideReason: { type: String },
  locked: { type: Boolean, default: false }, // Prevent edits after payroll processing

  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },


  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift', default: null, index: true },

}, { timestamps: true });

// Compound index for unique attendance per day per employee
AttendanceSchema.index({ tenant: 1, employee: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ tenant: 1, 'tracking.status': 1, date: -1 });
AttendanceSchema.index({ tenant: 1, faceVerified: 1, date: -1 });
AttendanceSchema.index({ tenant: 1, flagged: 1, date: -1 });

module.exports = AttendanceSchema;
