const mongoose = require('mongoose');

const SocialAnalyticsSchema = new mongoose.Schema({
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
    snapshotDate: {
        type: Date,
        required: true,
        index: true
    },
    metrics: {
        totalFollowers: { type: Number, default: 0 },
        followerGrowth: { type: Number, default: 0 },
        totalImpressions: { type: Number, default: 0 },
        totalReach: { type: Number, default: 0 },
        totalEngagements: { type: Number, default: 0 },
        engagementRate: { type: Number, default: 0 },
        topPosts: [{
            postId: { type: mongoose.Schema.Types.ObjectId, ref: 'SocialPostEnterprise' },
            performance: Number
        }]
    }
}, {
    timestamps: true,
    collection: 'social_analytics' // STRICT: requirement 5
});

// Snapshot per account per day
SocialAnalyticsSchema.index({ account: 1, snapshotDate: 1 }, { unique: true });

module.exports = SocialAnalyticsSchema;
