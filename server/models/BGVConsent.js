const mongoose = require('mongoose');

/**
 * BGV Consent Model
 * Captures digital consent from candidates before BGV begins
 * MANDATORY: BGV cannot proceed without valid consent
 */
const BGVConsentSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    caseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BGVCase',
        required: true,
        index: true
    },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        required: false   // Can also be an Applicant or Employee ID
    },

    // Consent Details
    consentGiven: {
        type: Boolean,
        required: true,
        default: false
    },
    consentTextVersion: {
        type: String,
        required: true,
        default: 'v1.0' // Track which version of consent text was shown
    },
    consentText: {
        type: String,
        required: true
    },

    // E-Signature
    signatureType: {
        type: String,
        enum: ['DIGITAL_SIGNATURE', 'TYPED_NAME', 'CHECKBOX', 'BIOMETRIC'],
        default: 'TYPED_NAME'
    },
    signatureData: {
        type: String, // Base64 image or typed name
        required: false,  // Relaxed - validated by controller
        default: ''
    },
    signatureImageUrl: String, // If signature is uploaded as image

    // Timestamp & IP Tracking
    consentTimestamp: {
        type: Date,
        required: true,
        default: Date.now,
        immutable: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: String,
    deviceInfo: {
        browser: String,
        os: String,
        device: String
    },

    // Geolocation (Optional)
    location: {
        latitude: Number,
        longitude: Number,
        city: String,
        country: String
    },

    // Consent Scope
    scopeAgreed: [{
        checkType: {
            type: String,
            enum: ['IDENTITY', 'ADDRESS', 'EMPLOYMENT', 'EDUCATION', 'CRIMINAL', 'REFERENCE', 'SOCIAL_MEDIA']
        },
        agreedAt: Date
    }],

    // Withdrawal
    isWithdrawn: {
        type: Boolean,
        default: false
    },
    withdrawnAt: Date,
    withdrawalReason: String,
    withdrawnBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Audit Fields
    isImmutable: {
        type: Boolean,
        default: true // Once given, cannot be modified
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: Date,

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'bgv_consents'
});

// Indexes
BGVConsentSchema.index({ tenant: 1, caseId: 1 }, { unique: true });
BGVConsentSchema.index({ tenant: 1, candidateId: 1 });
BGVConsentSchema.index({ consentGiven: 1, isWithdrawn: 1 });

// Prevent modification after consent is given
BGVConsentSchema.pre('save', function (next) {
    if (this.isModified() && this.isImmutable && !this.isNew) {
        // Allow only withdrawal
        if (!this.isModified('isWithdrawn') && !this.isModified('withdrawnAt') && !this.isModified('withdrawalReason')) {
            return next(new Error('Consent record is immutable and cannot be modified'));
        }
    }
    next();
});

// Virtual: Is consent valid?
BGVConsentSchema.virtual('isValid').get(function () {
    return this.consentGiven && !this.isWithdrawn;
});

// Static method: Check if candidate has valid consent for case
BGVConsentSchema.statics.hasValidConsent = async function (caseId) {
    const consent = await this.findOne({ caseId, consentGiven: true, isWithdrawn: false });
    return !!consent;
};

module.exports = BGVConsentSchema;
