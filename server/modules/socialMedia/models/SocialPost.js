const mongoose = require('mongoose');

const SocialPostSchema = new mongoose.Schema({
    tenantId: {
        type: String,
        required: true,
        index: true
    },
    content: {
        type: String,
        required: false
    },
    imageUrl: {
        type: String  // Legacy single image support
    },
    imageUrls: [{
        type: String  // New multiple images support
    }],
    link: {
        type: String
    },
    platforms: [{
        type: String,
        enum: ['linkedin', 'facebook', 'instagram', 'twitter']
    }],
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'publishing', 'published', 'failed', 'partial_success', 'edited', 'deleted', 'partially_deleted'],
        default: 'published'
    },
    scheduledAt: {
        type: Date
    },
    editedAt: {
        type: Date
    },
    deletedAt: {
        type: Date
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    publishedAt: {
        type: Date
    },
    errorLog: {
        type: String
    },
    platformResponses: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    }
}, { timestamps: true });

module.exports = mongoose.model('SocialPost', SocialPostSchema);
