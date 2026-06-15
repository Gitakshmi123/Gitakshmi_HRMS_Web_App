const mongoose = require('mongoose');

const SocialPostLogSchema = new mongoose.Schema({
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
        index: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SocialPostEnterprise',
        index: true
    },
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SocialAccountEnterprise',
        index: true
    },
    action: {
        type: String, // 'create', 'publish_start', 'publish_success', 'publish_fail', 'delete', 'update'
        required: true,
        index: true
    },
    platform: {
        type: String,
        enum: ['instagram', 'facebook', 'linkedin']
    },
    level: {
        type: String,
        enum: ['info', 'warn', 'error'],
        default: 'info'
    },
    message: {
        type: String,
        required: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed,
        default: {} // Full API response or error object
    }
}, {
    timestamps: true,
    collection: 'social_post_logs' // STRICT: requirement 4
});

module.exports = SocialPostLogSchema;
