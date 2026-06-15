const mongoose = require('mongoose');

const OfferLetterTemplateSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' },
    name: { type: String, required: true, trim: true },
    header: { type: String, default: '' },
    body: { type: String, required: true }, // Store text with {{placeholders}}
    footer: { type: String, default: '' },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = OfferLetterTemplateSchema;
