const mongoose = require('mongoose');

// Career Layout Schema - Stores layout and theme separately (small document)
const CareerLayoutSchema = new mongoose.Schema(
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
        // Lightweight layout info only
        layoutConfig: {
            theme: {
                primaryColor: { type: String, default: '#4F46E5' },
                secondaryColor: { type: String, default: '#9333EA' },
                textColor: { type: String, default: '#1F2937' },
                backgroundColor: { type: String, default: '#FFFFFF' },
                logoUrl: { type: String, default: '' },
                companyName: { type: String, default: '' },
                companyNameColor: { type: String, default: '#111827' },
                showHeader: { type: Boolean, default: true },
                logoHeight: { type: Number, default: 40 },
                logoLink: { type: String, default: '' }
            },
            // Section order - just IDs and order
            sectionOrder: [{
                sectionId: String,
                sectionType: String,
                order: Number
            }],
            // Minimal styling - no bloat
            customCSS: {
                type: String,
                maxlength: 50000 // 50KB max for CSS
            }
        },
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
CareerLayoutSchema.index({ tenantId: 1, companyId: 1 });

module.exports = mongoose.model('CareerLayout', CareerLayoutSchema);
