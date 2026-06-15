const mongoose = require('mongoose');

const SocialAccountSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        required: true,
        index: true
    },
    platform: {
        type: String,
        enum: ['instagram', 'facebook', 'linkedin'],
        required: true
    },
    accountName: {
        type: String,
        required: true,
        trim: true
    },
    accountType: {
        type: String,
        enum: ['profile', 'page', 'business_account'],
        default: 'profile'
    },
    platformAccountId: {
        type: String, // page_id / ig_business_id / linkedin_urn
        required: true
    },
    accessToken: {
        type: String, // Encrypted
        required: true
    },
    refreshToken: {
        type: String, // Encrypted
        default: null
    },
    expiresAt: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['active', 'expired', 'error', 'disconnected', 'reconnect_required'],
        default: 'active',
        index: true
    },
    meta: {
        profilePicture: String,
        handle: String,
        category: String,
        permissions: [String],
        lastSyncedAt: Date
    }
}, {
    timestamps: true,
    collection: 'social_accounts'
});

// Unique account per platform+ID within a branch
SocialAccountSchema.index({ branch: 1, platform: 1, platformAccountId: 1 }, { unique: true });

module.exports = SocialAccountSchema;
