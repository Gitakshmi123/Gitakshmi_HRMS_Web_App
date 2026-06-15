const mongoose = require('mongoose');

const benefitSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    benefitType: {
        type: String,
        required: true,
        enum: [
            "EMPLOYER_PF",
            "GRATUITY",
            "INSURANCE",
            "CUSTOM"
        ]
    },
    payType: {
        type: String,
        required: true,
        enum: ["FIXED", "VARIABLE"]
    },
    calculationType: {
        type: String,
        required: true,
        enum: [
            "FLAT",
            "PERCENT_OF_BASIC",
            "PERCENT_OF_CTC"
        ]
    },
    value: {
        type: Number,
        required: true
    },
    partOfSalaryStructure: {
        type: Boolean,
        default: true
    },
    isTaxable: {
        type: Boolean,
        default: false
    },
    proRata: {
        type: Boolean,
        default: false
    },
    considerForEPF: {
        type: Boolean,
        default: false
    },
    considerForESI: {
        type: Boolean,
        default: false
    },
    showInPayslip: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

module.exports = benefitSchema;
