const mongoose = require('mongoose');

const MinimumWageSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    state: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    category: {
        type: String,
        enum: ['UNSKILLED', 'SEMI_SKILLED', 'SKILLED', 'HIGHLY_SKILLED', 'GENERAL'],
        required: true,
        uppercase: true
    },
    monthlyAmount: {
        type: Number,
        required: true,
        min: 0
    },
    dailyAmount: {
        type: Number,
        min: 0
    },
    effectiveFrom: {
        type: Date,
        required: true,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true,
    collection: 'minimum_wages'
});

// Ensure unique state+category per tenant
MinimumWageSchema.index({ tenantId: 1, state: 1, category: 1, isActive: 1 }, { unique: true });

module.exports = MinimumWageSchema;
