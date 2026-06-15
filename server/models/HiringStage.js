const mongoose = require('mongoose');

const HiringStageSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true }, // Optional for system defaults
    name: { type: String, required: true, trim: true },
    isSystemStage: { type: Boolean, default: false },
    defaultOrder: { type: Number, default: 0 },
    description: { type: String },
    defaultFeedbackTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'FeedbackTemplate' }
}, { timestamps: true });

// Ensure unique stage name per tenant (or system wide if tenant is null)
HiringStageSchema.index({ tenant: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('HiringStage', HiringStageSchema);
