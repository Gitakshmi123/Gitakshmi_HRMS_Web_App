const mongoose = require('mongoose');

const companyProfileSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        unique: true // One profile per tenant
    },
    companyName: {
        type: String,
        required: true,
        trim: true
    },
    tagline: {
        type: String,
        default: 'TECHNOLOGIES'
    },
    companyLogo: {
        type: String, // URL or Base64
        default: ''
    },
    website: {
        type: String,
        trim: true
    },

    // Address Details
    address: {
        line1: { type: String, required: true },
        line2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        country: { type: String, default: 'India' }
    },

    // Contact Info for Footer
    contactEmail: { type: String, trim: true },
    contactPhone: { type: String, trim: true },
    cin: { type: String, trim: true }, // Corporate Identity Number
    gstin: { type: String, trim: true },

    // Branding Configuration
    branding: {
        primaryColor: { type: String, default: '#2563eb' }, // e.g., Blue
        secondaryColor: { type: String, default: '#1e40af' },
        fontFamily: { type: String, default: 'Arial' },
        watermarkText: { type: String, default: 'CONFIDENTIAL' },
        watermarkOpacity: { type: Number, default: 0.1 },
        showWatermark: { type: Boolean, default: true },
        letterheadBg: { type: String, default: '' }
    },

    // Document Reference Settings
    refPrefix: { type: String, default: 'OFFER' }, // e.g., GITK

    // Default Signatory
    signatory: {
        name: { type: String, required: true },
        designation: { type: String, required: true },
        signatureImage: { type: String } // URL to signature image
    },

    // Meta field for dynamic extensions (Career Page, etc)
    meta: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }

}, { timestamps: true });

// Multi-tenant fix: Export ONLY Schema (not mongoose.model)
module.exports = companyProfileSchema;
