const mongoose = require('mongoose');

const SocialAccountSchema = new mongoose.Schema({
    tenantId: {
        type: String,
        required: true,
        index: true
    },
    platform: {
        type: String,
        required: true,
        enum: ['linkedin', 'facebook', 'instagram', 'twitter']
    },
    accessToken: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String
    },
    tokenExpiry: {
        type: Date
    },
    expiresAt: {
        type: Date
    },
    connectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['connected', 'expired', 'error'],
        default: 'connected'
    },
    isConnected: {
        type: Boolean,
        default: true
    },
    platformUserId: {
        type: String
    },
    platformUserName: {
        type: String
    },
    pageId: {
        type: String
    },
    pageName: {
        type: String
    }
}, { timestamps: true });

SocialAccountSchema.index({ tenantId: 1, platform: 1 }, { unique: true });

module.exports = mongoose.model('SocialAccount', SocialAccountSchema);
