const mongoose = require('mongoose');

// Published Career Page Schema - Optimized for high-performance read
// This document stores the final, merged, and lightweight version of the career page
const PublishedCareerPageSchema = new mongoose.Schema(
    {
        tenantId: {
            type: String,
            required: true,
            index: true
        },
        companyId: {
            type: String,
            required: true,
            index: true
        },
        // Complete SEO Meta Tags (Pre-computed for fast injection)
        seo: {
            title: String,
            description: String,
            keywords: [String],
            slug: { type: String, index: true },
            ogImage: String,
            canonicalUrl: String,
            metaHtml: {
                title: String,
                description: String,
                keywords: String,
                ogTitle: String,
                ogDescription: String,
                ogImage: String,
                ogUrl: String,
                canonical: String
            }
        },
        // Lightweight Sections (Content only, no large assets)
        // defined as Array to prevent CastErrors with strict subdocument schemas
        sections: {
            type: Array,
            default: []
        },
        // Theme Configuration
        theme: {
            primaryColor: String,
            secondaryColor: String,
            textColor: String,
            backgroundColor: String,
            customCSS: String,
            logoUrl: String,
            companyName: String,
            companyNameColor: String,
            showHeader: Boolean,
            logoHeight: Number,
            logoLink: String
        },
        // Complete Apply Form Configuration (Saved via ApplyPageBuilder)
        applyPage: {
            type: Object,
            default: {}
        },
        // Metadata
        publishedAt: {
            type: Date,
            default: Date.now
        },
        version: {
            type: Number,
            default: 1
        }
    },
    { timestamps: true } // Auto-manage createdAt / updatedAt
);

// Compound index for fast lookup by tenant
PublishedCareerPageSchema.index({ tenantId: 1, companyId: 1 });
// Index for slug lookup if needed
PublishedCareerPageSchema.index({ tenantId: 1, 'seo.slug': 1 });

module.exports = mongoose.model('PublishedCareerPage', PublishedCareerPageSchema);
