const mongoose = require('mongoose');

const FeedbackTemplateSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true, required: true },
    templateName: { type: String, required: true, trim: true },
    description: { type: String },
    criteria: [{
        label: { type: String, required: true },
        type: { type: String, enum: ['rating', 'text', 'yesno'], default: 'rating' },
        required: { type: Boolean, default: true },
        options: [String], // For future expansion (select, etc.)
        weight: { type: Number, default: 1 } // For weighted scoring
    }],
    isDefault: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Ensure unique template name per tenant
FeedbackTemplateSchema.index({ tenant: 1, templateName: 1 }, { unique: true });

module.exports = mongoose.model('FeedbackTemplate', FeedbackTemplateSchema);
