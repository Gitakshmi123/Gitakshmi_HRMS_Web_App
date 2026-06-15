const mongoose = require('mongoose');

// Career Sections Schema - Stores individual page sections separately to avoid 16MB limit
const CareerSectionSchema = new mongoose.Schema(
    {
        companyId: {
            type: String,
            required: true,
            index: true
        },
        tenantId: {
            type: String,
            required: true,
            index: true
        },
        sectionId: {
            type: String,
            required: true,
            unique: false
        },
        sectionType: {
            type: String,
            required: true,
            enum: ['hero', 'openings', 'about', 'benefits', 'testimonials', 'cta', 'custom', 'highlights', 'company-info', 'faq'],
            index: true
        },
        sectionOrder: {
            type: Number,
            default: 0
        },
        // Minimal content - no large base64 images
        content: {
            type: mongoose.Schema.Types.Mixed,
            validate: {
                validator: function(v) {
                    const str = JSON.stringify(v);
                    return str.length < 2000000; // 2MB max per section
                },
                message: 'Section content exceeds 2MB limit'
            }
        },
        // Theme colors only - no images here
        theme: {
            primaryColor: String,
            secondaryColor: String,
            textColor: String,
            backgroundColor: String
        },
        // Track if published
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
CareerSectionSchema.index({ tenantId: 1, companyId: 1, isDraft: 1 });
CareerSectionSchema.index({ tenantId: 1, companyId: 1, isPublished: 1 });

module.exports = mongoose.model('CareerSection', CareerSectionSchema);
