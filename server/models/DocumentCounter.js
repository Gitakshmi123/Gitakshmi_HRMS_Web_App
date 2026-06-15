const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DocumentCounterSchema = new Schema({
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    documentType: {
        type: String, // Matches DocumentType.key (EMP, POS, etc.)
        required: true,
        uppercase: true,
        trim: true
    },
    financialYear: {
        type: String, // e.g. "25-26" or "GLOBAL"
        required: true
    },
    lastNumber: {
        type: Number,
        default: 0, // Will increment to 1 on first use
        required: true
    }
}, {
    timestamps: true
});

// Unique counter per Type + Year + Company
DocumentCounterSchema.index({ companyId: 1, documentType: 1, financialYear: 1 }, { unique: true });

module.exports = mongoose.model('DocumentCounter', DocumentCounterSchema);
