const mongoose = require('mongoose');

const TicketTemplateSchema = new mongoose.Schema({
    tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    category: { type: String, required: true, index: true },
    
    // Dynamic Form Definition
    fields: [
        {
            label: { type: String, required: true },
            name: { type: String, required: true },
            type: { type: String, enum: ['text', 'number', 'date', 'select', 'textarea', 'checkbox', 'toggle'], default: 'text' },
            required: { type: Boolean, default: false },
            options: [String], // for select or checkbox
            placeholder: { type: String },
        }
    ],
    
    slaHours: { type: Number, default: 24 },
    assignedTeam: { type: String, default: 'HR-GENERAL' },
    status: { type: String, enum: ['DRAFT', 'ACTIVE'], default: 'DRAFT', index: true },
    version: { type: Number, default: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Ensure name is unique per tenant and category
TicketTemplateSchema.index({ tenant: 1, name: 1 }, { unique: true });

module.exports = TicketTemplateSchema;

