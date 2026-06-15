const mongoose = require('mongoose');

const SocialCampaignSchema = new mongoose.Schema({
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
    content: {
        type: String,
        required: true
    },
    media: [{
        url: String,
        type: { type: String, enum: ['image', 'video'] },
        key: String // For cloud storage reference
    }],
    postType: {
        type: String,
        enum: ['post', 'story', 'reel'],
        default: 'post'
    },
    scheduledAt: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'publishing', 'completed', 'failed', 'cancelled', 'deleted'],
        default: 'draft',
        index: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    meta: {
        platforms: [String],
        accountIds: [mongoose.Schema.Types.ObjectId],
        totalPosts: { type: Number, default: 0 },
        publishedPosts: { type: Number, default: 0 },
        failedPosts: { type: Number, default: 0 }
    }
}, {
    timestamps: true,
    collection: 'social_campaigns'
});

module.exports = SocialCampaignSchema;
