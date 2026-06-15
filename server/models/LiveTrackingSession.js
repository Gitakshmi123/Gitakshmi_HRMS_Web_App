const mongoose = require('mongoose');

const locationSnapshotSchema = new mongoose.Schema(
  {
    lat: { type: Number, min: -90, max: 90 },
    lng: { type: Number, min: -180, max: 180 },
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null },
    heading: { type: Number, default: null },
    altitude: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const deviceBindingSchema = new mongoose.Schema(
  {
    fingerprint: { type: String, trim: true, index: true },
    trusted: { type: Boolean, default: true },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    userAgent: { type: String, trim: true },
    platform: { type: String, trim: true },
    bindingSource: {
      type: String,
      enum: ['ATTENDANCE_MARK', 'TRACKING_RESUME', 'MANUAL'],
      default: 'ATTENDANCE_MARK'
    }
  },
  { _id: false }
);

const securitySummarySchema = new mongoose.Schema(
  {
    spoofDetected: { type: Boolean, default: false },
    lastReasons: [{ type: String, trim: true }],
    maxSpeedKmh: { type: Number, default: 0 },
    lastComputedSpeedKmh: { type: Number, default: 0 },
    lastJumpDistanceMeters: { type: Number, default: 0 },
    deviceMismatchCount: { type: Number, default: 0 }
  },
  { _id: false }
);

const LiveTrackingSessionSchema = new mongoose.Schema(
  {
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true
    },
    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      default: null,
      index: true
    },
    dateKey: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'PAUSED', 'STOPPED', 'SUSPICIOUS'],
      default: 'ACTIVE',
      index: true
    },
    online: {
      type: Boolean,
      default: true,
      index: true
    },
    checkInTime: {
      type: Date,
      default: null
    },
    checkOutTime: {
      type: Date,
      default: null
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    stoppedAt: {
      type: Date,
      default: null
    },
    lastHeartbeatAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    recommendedIntervalSec: {
      type: Number,
      default: 15
    },
    startLocation: {
      type: locationSnapshotSchema,
      default: null
    },
    lastLocation: {
      type: locationSnapshotSchema,
      default: null
    },
    totalUpdates: {
      type: Number,
      default: 0
    },
    suspiciousUpdateCount: {
      type: Number,
      default: 0
    },
    stopReason: {
      type: String,
      trim: true
    },
    security: {
      type: securitySummarySchema,
      default: () => ({})
    },
    device: {
      type: deviceBindingSchema,
      default: () => ({})
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'live_tracking_sessions'
  }
);

LiveTrackingSessionSchema.index({ tenant: 1, employee: 1, status: 1 });
LiveTrackingSessionSchema.index({ tenant: 1, status: 1, lastHeartbeatAt: -1 });
LiveTrackingSessionSchema.index({ tenant: 1, dateKey: 1, status: 1 });
LiveTrackingSessionSchema.index(
  { tenant: 1, employee: 1, dateKey: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'ACTIVE' }
  }
);

module.exports = LiveTrackingSessionSchema;
