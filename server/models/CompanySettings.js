const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const CompanySettingsSchema = new Schema({
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        unique: true
    },
    companyCode: {
        type: String,
        uppercase: true,
        trim: true,
        default: 'GTPL'
    },
    branchCode: {
        type: String,
        uppercase: true,
        trim: true,
        default: 'AHM'
    },
    departmentCode: {
        type: String, // Default Department Code
        uppercase: true,
        trim: true,
        default: 'GEN'
    },
    financialYear: {
        type: String, // e.g. "25-26"
        required: true,
        default: () => {
            const d = new Date();
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const startY = m < 4 ? y - 1 : y;
            return `${String(startY).slice(-2)}-${String(startY + 1).slice(-2)}`;
        }
    },
    resetPolicy: {
        type: String,
        enum: ['NEVER', 'YEARLY'],
        default: 'YEARLY'
    },
    updatedBy: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CompanySettings', CompanySettingsSchema);
