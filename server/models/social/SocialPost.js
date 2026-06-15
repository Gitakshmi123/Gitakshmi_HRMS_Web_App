const mongoose = require('mongoose');

const SocialPostSchema = new mongoose.Schema({
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
    campaign: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SocialCampaign',
        required: true,
        index: true
    },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SocialAccountEnterprise',
        required: true,
        index: true
    },
    platform: {
        type: String,
        enum: ['instagram', 'facebook', 'linkedin'],
        required: true
    },
    caption: {
        type: String,
        default: null
    },
    postType: {
        type: String,
        enum: ['post', 'story', 'reel'],
        default: 'post'
    },
    platformPostId: {
        type: String,
        default: null,
        index: true   // Indexed for quick lookup during edit/delete
    },
    mediaUrls: {
        type: [String],
        default: []
    },
    platform_media_id: {
        type: String,
        default: null
    },
    musicId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Music',
        default: null
    },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['draft', 'pending', 'scheduled', 'publishing', 'published', 'completed', 'failed', 'cancelled', 'deleted'],
        default: 'draft',
        index: true
    },
    error: {
        type: String,
        default: null
    },
    error_message: {
        type: String,
        default: null
    },
    error_details: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    retryCount: {
        type: Number,
        default: 0
    },
    containerId: {
        type: String,
        default: null
    },
    platformAssetUrn: {
        type: String,
        default: null
    },
    lastPlatformResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    lastErrorAt: {
        type: Date,
        default: null
    },
    nextRetryAt: {
        type: Date,
        default: null
    },
    publishedAt: {
        type: Date,
        default: null
    },
    scheduledAt: {
        type: Date,
        default: null
    },
    metrics: {
        impressions: { type: Number, default: 0 },
        reach: { type: Number, default: 0 },
        views: { type: Number, default: 0 },
        engagements: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
        shares: { type: Number, default: 0 }
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'social_posts'
});

module.exports = SocialPostSchema;
