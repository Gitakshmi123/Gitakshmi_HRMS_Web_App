const mongoose = require('mongoose');

const CandidateSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    candidateId: { type: String, trim: true, unique: true }, // Format: CAND-2026-0001
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    mobile: { type: String, trim: true },

    // Profile Information
    resume: { type: String }, // Path to default resume
    skills: [{ type: String }],
    experience: [{
        title: String,
        company: String,
        duration: String,
        description: String
    }],
    education: [{
        degree: String,
        institution: String,
        year: String
    }],
    fatherName: { type: String, trim: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other', ''], default: '' },
    address: { type: String },
    dob: { type: Date },
    profilePic: { type: String }, // Path to profile picture
    professionalTier: { type: String, default: 'Technical Leader' }, // New field for profile customization
    linkedinUrl: { type: String, trim: true },
    portfolioUrl: { type: String, trim: true },

    // 🔐 Identity Verification Fields (Required for OCR Validation)
    aadhaarNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true, uppercase: true },
    digitalSignature: { type: String }, // Base64 signature image

    // Status
    isDeleted: { type: Boolean, default: false },

    // Additional data
    metadata: { type: Object, default: {} },
    
    // Password Reset
    resetPasswordOtp: { type: String },
    resetPasswordExpires: { type: Date },

    // Meta
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure unique email PER TENANT
CandidateSchema.index({ tenant: 1, email: 1 }, { unique: true });

module.exports = CandidateSchema;
