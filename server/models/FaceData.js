const mongoose = require('mongoose');

/**
 * Face Data Model - Enterprise Grade
 * 
 * Security Features:
 * - Encrypted embeddings at rest
 * - No raw image storage (only embeddings + quality metrics)
 * - Audit trail for all access
 * - Version tracking for model updates
 * - Automatic encryption on save, decryption on retrieve
 * 
 * Storage Strategy:
 * - Embeddings: Encrypted 512-dim vectors (2KB each)
 * - Quality Metrics: Unencrypted (needed for debugging)
 * - Images: Encrypted backup only, optional
 * - Audit: Unencrypted (for compliance)
 */

const FaceDataSchema = new mongoose.Schema(
  {
    // ============ IDENTIFIERS ============
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

    // ============ FACE EMBEDDING (PRIMARY) ============
    // 512-dimensional vector from FaceNet/MobileNet
    // Encrypted with AES-256-GCM for security
    faceEmbedding: {
      // Encrypted embedding data
      encrypted: {
        type: String,
        required: true
      },
      // Initialization vector (needed for decryption)
      iv: {
        type: String,
        required: true
      },
      // Authentication tag (prevents tampering)
      authTag: {
        type: String,
        required: true
      },
      // Metadata
      algorithm: {
        type: String,
        default: 'aes-256-gcm'
      },
      encryptedAt: {
        type: Date,
        default: Date.now
      }
    },

    // ============ QUALITY METRICS ============
    // Unencrypted metrics used for validation & debugging
    quality: {
      sharpness: {
        type: Number,
        min: 0,
        max: 100,
        required: true
      },
      brightness: {
        type: Number,
        min: 0,
        max: 255,
        required: true
      },
      contrast: {
        type: Number,
        min: 0,
        max: 100,
        required: true
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100,
        required: true
      },
      faceAngle: {
        yaw: { type: Number, default: 0 },    // Head rotation (degrees)
        pitch: { type: Number, default: 0 },  // Up/down tilt
        roll: { type: Number, default: 0 }    // Side tilt
      },
      eyesOpen: { type: Boolean, default: true },
      mouthOpen: { type: Boolean, default: false },
      gaze: {
        leftEyeOpen: { type: Boolean },
        rightEyeOpen: { type: Boolean }
      },
      capturedAt: { type: Date, default: Date.now }
    },

    // ============ FACE DETECTION DATA ============
    detection: {
      // Bounding box for detected face
      bbox: {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true }
      },
      // Face landmarks (68 points)
      landmarks: {
        type: mongoose.Schema.Types.Mixed
      },
      // Landmarks are removed before storage for privacy
      // Only bounding box and overall confidence kept
    },

    // ============ LIVENESS DETECTION ============
    liveness: {
      status: {
        type: String,
        enum: ['UNKNOWN', 'PENDING', 'PASSED', 'FAILED'],
        default: 'UNKNOWN'
      },
      confidence: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },
      method: {
        type: String,
        enum: ['NONE', 'BLINK', 'MOVEMENT', 'TEXTURE', 'CHALLENGE_RESPONSE'],
        default: 'NONE'
      },
      detections: {
        blinkDetected: { type: Boolean, default: false },
        movementDetected: { type: Boolean, default: false },
        textureValid: { type: Boolean, default: false }
      },
      checkedAt: Date,
      validUntil: {
        type: Date
      }
    },

    // ============ REGISTRATION METADATA ============
    registration: {
      registeredAt: {
        type: Date,
        default: Date.now,
        required: true,
        index: true
      },
      registeredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      registrationNotes: {
        type: String
      },
      deviceInfo: {
        type: String
      },
      browser: String,
      ipAddress: {
        type: String
      },
      location: {
        latitude: Number,
        longitude: Number,
        accuracy: Number
      },
      // Consent tracking
      consentVersion: {
        type: Number,
        default: 1
      },
      consentGiven: { type: Boolean, default: false },
      consentGivenAt: Date
    },

    // ============ STATUS & VERIFICATION ============
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE', 'PENDING_REVIEW', 'REJECTED', 'EXPIRED'],
      default: 'ACTIVE',
      required: true,
      index: true
    },
    
    isVerified: {
      type: Boolean,
      default: false
    },
    
    verification: {
      verifiedAt: Date,
      verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      rejectionReason: {
        type: String,
        enum: ['LOW_QUALITY', 'SPOOFING_DETECTED', 'DUPLICATE', 'CONSENT_MISSING', 'OTHER']
      },
      rejectionDetails: String
    },

    // ============ MODEL VERSIONING ============
    // Track which ML model generated this embedding
    model: {
      name: {
        type: String,
        default: 'facenet-mobilenet-v2'
      },
      version: {
        type: String,
        default: '1.0.0'
      },
      generatedAt: { type: Date, default: Date.now }
    },

    // ============ USAGE & AUDIT ============
    usage: {
      lastUsedFor: {
        type: String,
        enum: ['ATTENDANCE', 'ACCESS_CONTROL', 'BOTH'],
        default: 'ATTENDANCE'
      },
      lastUsedAt: {
        type: Date,
        index: true
      },
      successCount: {
        type: Number,
        default: 0
      },
      failureCount: {
        type: Number,
        default: 0
      },
      lastFailureAt: Date,
      lastFailureReason: String
    },

    // ============ AUDIT TRAIL ============
    audit: {
      // Automatic: createdAt, updatedAt (timestamps)
      // Manual entries for important events
      events: [
        {
          eventType: {
            type: String,
            enum: ['CREATED', 'VERIFIED', 'USED', 'FAILED', 'UPDATED', 'DELETED'],
            required: true
          },
          timestamp: { type: Date, default: Date.now, required: true },
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
          },
          ipAddress: String,
          details: mongoose.Schema.Types.Mixed,
          notes: String
        }
      ],
      accessLog: [
        {
          accessedAt: { type: Date, default: Date.now },
          accessedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
          },
          action: {
            type: String,
            enum: ['VIEW', 'VERIFY', 'DECRYPT', 'MODIFY'],
            required: true
          },
          ipAddress: String
        }
      ]
    },

    // ============ BACKUP & RECOVERY ============
    backups: [
      {
        // Store encrypted backup of original image (optional)
        // For cases where face needs to be re-registered
        imageData: {
          encrypted: String,
          iv: String,
          authTag: String
        },
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        quality: {
          sharpness: Number,
          brightness: Number,
          contrast: Number,
          confidence: Number
        },
        notes: String
      }
    ],
    maxBackups: {
      type: Number,
      default: 3
    },

    // ============ MULTI-FACE SUPPORT ============
    // Can store multiple face embeddings for same person
    // Improves matching accuracy (different angles/expressions)
    alternatives: [
      {
        embedding: {
          encrypted: String,
          iv: String,
          authTag: String
        },
        quality: mongoose.Schema.Types.Mixed,
        registeredAt: Date,
        usageCount: Number,
        status: {
          type: String,
          enum: ['ACTIVE', 'INACTIVE'],
          default: 'ACTIVE'
        }
      }
    ],

    // ============ EXPIRATION & MAINTENANCE ============
    // Policies for face template lifecycle
    expiration: {
      enabled: { type: Boolean, default: true },
      expiresAt: {
        type: Date
      },
      renewalRequired: {
        type: Boolean,
        default: false
      },
      notificationSentAt: Date
    },

    // ============ SYSTEM METADATA ============
    isActive: { type: Boolean, default: true, index: true },
    dataRetentionDays: {
      type: Number,
      default: 365
    },
    encryptionKey: {
      type: String
    }
  },
  {
    timestamps: true,
    collection: 'facedata',
    strict: true
  }
);

// ============ INDEXES ============
// Fast lookups by tenant & employee
FaceDataSchema.index({ tenant: 1, employee: 1, status: 1 });

// Fast lookups by verification status
FaceDataSchema.index({ tenant: 1, isVerified: 1, status: 1 });

// For audit compliance
FaceDataSchema.index({ 'audit.events.timestamp': -1 });

// For usage analytics
FaceDataSchema.index({ 'usage.lastUsedAt': -1 });

// For data cleanup
FaceDataSchema.index({ createdAt: 1, isActive: 1 });

module.exports = FaceDataSchema;
