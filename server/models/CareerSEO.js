const mongoose = require('mongoose');

// Career SEO Schema - Stores SEO settings separately (very small document)
const CareerSEOSchema = new mongoose.Schema(
    {
        companyId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        tenantId: {
            type: String,
            required: true,
            index: true
        },
        // Core SEO fields
        seoTitle: {
            type: String,
            maxlength: 70,
            trim: true
        },
        seoDescription: {
            type: String,
            maxlength: 160,
            trim: true
        },
        seoKeywords: [{
            type: String,
            maxlength: 50,
            trim: true
        }],
        seoSlug: {
            type: String,
            maxlength: 100,
            lowercase: true,
            trim: true,
            match: /^[a-z0-9-]*$/
        },
        // Image stored as URL ONLY - never store Base64
        seoOgImageUrl: {
            type: String,
            default: ''
        },
        seoOgImageName: {
            type: String,
            default: ''
        },
        // Canonical URL
        canonicalUrl: {
            type: String,
            default: ''
        },
        // Track published version
        isDraft: {
            type: Boolean,
            default: true
        },
        isPublished: {
            type: Boolean,
            default: false
        },
        publishedAt: Date,
        createdAt: {
            type: Date,
            default: Date.now
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
);

// Index for efficient queries
CareerSEOSchema.index({ tenantId: 1, companyId: 1 });

module.exports = mongoose.model('CareerSEO', CareerSEOSchema);
