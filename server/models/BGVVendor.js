const mongoose = require('mongoose');

const BGVVendorSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    endpoint: {
        type: String,
        trim: true
    },
    apiKey: {
        type: String // Encrypted
    },
    apiSecret: {
        type: String // Encrypted
    },
    supportedChecks: [{
        type: String,
        enum: ['IDENTITY', 'ADDRESS', 'EDUCATION', 'EMPLOYMENT', 'CRIMINAL', 'REFERENCE']
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    config: {
        type: Object,
        default: {}
    }
}, {
    timestamps: true,
    collection: 'bgv_vendors'
});

module.exports = BGVVendorSchema;
