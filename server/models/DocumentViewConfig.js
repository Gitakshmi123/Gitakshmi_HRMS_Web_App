const mongoose = require('mongoose');

const DocumentViewConfigSchema = new mongoose.Schema({
    tenantId: { type: String, required: true, index: true },
    documentType: {
        type: String,
        required: true,
        enum: ['JOINING_LETTER', 'OFFER_LETTER', 'CTC_ANNEXURE', 'PAYSLIP'],
        description: "The type of document this configuration applies to"
    },

    // Configuration for Data Sections
    // Allows defining multiple tables/sections in the document (e.g. Earnings Table, Deductions Table)
    sections: [{
        sectionKey: { type: String, required: true }, // Internal key e.g. 'earnings_table', 'deductions_table'
        dataSource: {
            type: String,
            enum: ['earnings', 'employeeDeductions', 'employerContributions', 'all'],
            default: 'earnings'
        },
        title: { type: String, default: "Earnings" },

        // Filtering Logic
        mode: {
            type: String,
            enum: ['INCLUDE_ALL', 'INCLUDE_SPECIFIC', 'EXCLUDE_SPECIFIC'],
            default: 'INCLUDE_ALL'
        },
        components: [String], // List of component names/keys (e.g. ['Basic Salary', 'HRA']) matches 'name' in snapshot

        // Display Logic
        columns: {
            monthly: { type: Boolean, default: true },
            yearly: { type: Boolean, default: true }
        },
        showTotal: { type: Boolean, default: true },
        totalLabel: { type: String, default: "Total" }
    }],

    isActive: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure one active config per type per tenant
DocumentViewConfigSchema.index({ tenantId: 1, documentType: 1 }, { unique: true });

module.exports = DocumentViewConfigSchema;
