const mongoose = require('mongoose');

const socialTemplateSchema = new mongoose.Schema({
    name: { type: String, required: true },
    thumbnail: { type: String }, // URL to image
    canvasData: { type: Object, required: true }, // Fabric.js JSON
    category: { type: String, default: 'General' },
    isPublic: { type: Boolean, default: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant' }
}, { timestamps: true });

module.exports = mongoose.model('SocialTemplate', socialTemplateSchema);
