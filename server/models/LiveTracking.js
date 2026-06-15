const mongoose = require('mongoose');

const snapshotSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, default: null },
    speed: { type: Number, default: null },
    heading: { type: Number, default: null },
    altitude: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const deviceSchema = new mongoose.Schema(
  {
    fingerprint: { type: String, trim: true, index: true },
    userAgent: { type: String, trim: true },
    platform: { type: String, trim: true },
    language: { type: String, trim: true },
    hardwareConcurrency: { type: Number, default: null },
    deviceMemory: { type: Number, default: null }
  },
  { _id: false }
);

const securitySchema = new mongoose.Schema(
  {
    suspected: { type: Boolean, default: false, index: true },
    severity: {
      type: String,
      enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH'],
      default: 'NONE'
    },
    reasons: [{ type: String, trim: true }],
    computedSpeedKmh: { type: Number, default: 0 },
    jumpDistanceMeters: { type: Number, default: 0 },
    deviceMismatch: { type: Boolean, default: false },
    mockedLocation: { type: Boolean, default: false },
    poorAccuracy: { type: Boolean, default: false }
  },
  { _id: false }
);

const geoPointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: {
      type: [Number],
      default: undefined,
      validate: {
        validator: (value) => Array.isArray(value) && value.length === 2,
        message: 'geoPoint.coordinates must contain [lng, lat]'
      }
    }
  },
  { _id: false }
);

const LiveTrackingSchema = new mongoose.Schema(
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
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LiveTrackingSession',
      default: null,
      index: true
    },
    timestamp: {
      type: Date,
      required: true,
      index: true
    },
    location: {
      type: snapshotSchema,
      required: true
    },
    geoPoint: {
      type: geoPointSchema,
      required: true
    },
    battery: {
      level: { type: Number, default: null },
      charging: { type: Boolean, default: null }
    },
    network: {
      effectiveType: { type: String, trim: true },
      rtt: { type: Number, default: null },
      downlink: { type: Number, default: null },
      saveData: { type: Boolean, default: null }
    },
    device: {
      type: deviceSchema,
      default: () => ({})
    },
    source: {
      type: String,
      enum: [
        'CHECK_IN',
        'TRACKER',
        'CHECK_OUT',
        'LOGOUT',
        'CLIENT_MEETING_START',
        'CLIENT_MEETING',
        'CLIENT_MEETING_END'
      ],
      default: 'TRACKER',
      index: true
    },
    intervalSeconds: {
      type: Number,
      default: 15
    },
    security: {
      type: securitySchema,
      default: () => ({})
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'live_tracking'
  }
);

LiveTrackingSchema.pre('validate', function preValidate(next) {
  if (this.location?.lat !== undefined && this.location?.lng !== undefined) {
    this.geoPoint = {
      type: 'Point',
      coordinates: [this.location.lng, this.location.lat]
    };
  }
  next();
});

LiveTrackingSchema.index({ tenant: 1, employee: 1, timestamp: -1 });
LiveTrackingSchema.index({ tenant: 1, session: 1, timestamp: -1 });
LiveTrackingSchema.index({ tenant: 1, timestamp: -1 });
LiveTrackingSchema.index({ geoPoint: '2dsphere' });
LiveTrackingSchema.index({ tenant: 1, 'security.suspected': 1, timestamp: -1 });

module.exports = LiveTrackingSchema;
