const mongoose = require('mongoose');

// Benefit schema aligned to requested Earnings-style fields
const benefitComponentSchema = new mongoose.Schema({
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    benefitType: { type: String, enum: ['EMPLOYER_PF', 'GRATUITY', 'INSURANCE', 'CUSTOM'], default: 'CUSTOM' },
    payslipName: { type: String, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },

    // Pay Configuration
    payType: { type: String, enum: ['FIXED', 'VARIABLE'], default: 'FIXED' },
    calculationType: { type: String, enum: ['FLAT', 'PERCENT_OF_BASIC', 'PERCENT_OF_CTC', 'FORMULA'], default: 'FLAT' },
    formula: { type: String, trim: true },
    formulaFrequency: { type: String, enum: ['MONTHLY', 'ANNUAL'], default: 'MONTHLY' },
    value: { type: Number, required: true, min: 0 },

    // Flags & Rules
    partOfSalaryStructure: { type: Boolean, default: true },
    isTaxable: { type: Boolean, default: false },
    proRata: { type: Boolean, default: false },
    considerForEPF: { type: Boolean, default: false },
    considerForESI: { type: Boolean, default: false },

    // Display
    showInPayslip: { type: Boolean, default: false },

    // System
    // System
    isActive: { type: Boolean, default: true },
    enabled: { type: Boolean, default: true },
    status: { type: String, enum: ['ACTIVE', 'DISABLED', 'DELETED'], default: 'ACTIVE' }

}, { timestamps: true });

// Indexes: unique code per tenant, unique name per tenant
benefitComponentSchema.index({ tenantId: 1, code: 1 }, { unique: true });
benefitComponentSchema.index({ tenantId: 1, name: 1 }, { unique: true });

module.exports = benefitComponentSchema;
