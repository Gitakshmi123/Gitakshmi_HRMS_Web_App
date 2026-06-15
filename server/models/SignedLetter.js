const mongoose = require('mongoose');

const SignedLetterSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    letterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'GeneratedLetter',
        required: true
    },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        required: true
    },
    signatureImage: {
        type: String, // Base64 PNG
        required: true
    },
    signaturePosition: {
        alignment: {
            type: String,
            enum: ['left', 'center', 'right'],
            default: 'right'
        },
        coordinates: {
            x: { type: Number, default: 0 },
            y: { type: Number, default: 0 }
        },
        useCustomCoords: {
            type: Boolean,
            default: false
        }
    },
    signedAt: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['signed', 'unsigned'],
        default: 'signed'
    },
    ip: String,
    userAgent: String
}, { timestamps: true });

// Ensure one signature per letter-candidate pair
SignedLetterSchema.index({ letterId: 1, candidateId: 1 }, { unique: true });

module.exports = SignedLetterSchema;
