const mongoose = require('mongoose');

const payslipTemplateSchema = new mongoose.Schema({
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
    templateType: {
        type: String,
        enum: ['HTML', 'WORD', 'CUSTOM', 'BUILDER'],
        default: 'HTML'
    },
    builderConfig: {
        type: Object, // Stores the JSON tree for visual builder
        default: null
    },
    htmlContent: {
        type: String,
        // Only required for HTML templates, not for BUILDER
        required: function () { return this.templateType === 'HTML'; },
        default: ''
    },
    filePath: {
        type: String,
        required: function () { return this.templateType === 'WORD'; }
    },
    placeholders: [{
        type: String
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Ensure only one default template per tenant
payslipTemplateSchema.index({ tenant: 1, isDefault: 1 }, {
    unique: true,
    partialFilterExpression: { isDefault: true }
});

// Tenant + name unique
payslipTemplateSchema.index({ tenant: 1, name: 1 }, { unique: true });

module.exports = payslipTemplateSchema;
