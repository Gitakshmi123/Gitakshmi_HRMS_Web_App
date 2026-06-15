const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema({
    label: { type: String, required: true },
    fieldName: { type: String, required: true }, // camelCase identifier
    type: { 
        type: String, 
        enum: ['text', 'number', 'date', 'select', 'file', 'textarea'], 
        default: 'text' 
    },
    options: [String], // For 'select' type
    isRequired: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: true }, // Candidate can see/edit
    isPrivate: { type: Boolean, default: false }, // HR only
    validation: { type: String }, // Regex pattern
    placeholder: { type: String },
    order: { type: Number, default: 0 },
    section: { type: String, default: 'General' } // Grouping fields
});

const formDefinitionSchema = new mongoose.Schema({
    tenant: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Tenant', 
        required: true,
        index: true 
    },
    stage: { 
        type: String, 
        enum: ['BGV', 'JOINING', 'ONBOARDING'], 
        required: true,
        index: true
    },
    isActive: { type: Boolean, default: true },
    fields: [formFieldSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

// Ensure one active form per stage per tenant
formDefinitionSchema.index({ tenant: 1, stage: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = formDefinitionSchema;
