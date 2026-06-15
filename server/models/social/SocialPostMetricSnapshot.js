const mongoose = require('mongoose');

const SocialPostMetricSnapshotSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    branch: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Branch',
        default: null,
        index: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SocialPostEnterprise',
        required: true,
        index: true
    },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SocialAccountEnterprise',
        default: null,
        index: true
    },
    platform: {
        type: String,
        enum: ['instagram', 'facebook', 'linkedin'],
        required: true,
        index: true
    },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    reach: { type: Number, default: 0 },
    impressions: { type: Number, default: 0 },
    raw: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    collectedAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true,
    collection: 'social_post_metric_snapshots'
});

SocialPostMetricSnapshotSchema.index({ post: 1, collectedAt: -1 });

module.exports = SocialPostMetricSnapshotSchema;
