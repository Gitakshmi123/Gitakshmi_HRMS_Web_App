const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DocumentTypeSchema = new Schema({
    companyId: {
        type: Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true
    },
    key: {
        type: String, // EMP, JOB, POS, OFF, APPT, APP, INT, EXP, REL
        required: true,
        uppercase: true,
        trim: true
    },
    name: {
        type: String, // Explicit name e.g. "Employee ID"
        trim: true
    },
    prefix: {
        type: String,
        trim: true,
        uppercase: true,
        default: ''
    },
    formatTemplate: {
        type: String,
        default: '{{COMPANY}}/{{DEPT}}/{{PREFIX}}/{{YEAR}}/{{COUNTER}}'
    },
    startFrom: {
        type: Number,
        default: 1,
        min: 1
    },
    paddingDigits: {
        type: Number,
        default: 4,
        min: 2,
        max: 10
    },
    resetPolicy: {
        type: String,
        enum: ['NEVER', 'YEARLY'],
        default: 'YEARLY'
    },
    generationMode: {
        type: String,
        enum: ['AUTO', 'MANUAL'],
        default: 'AUTO'
    },
    updatedBy: {
        type: String
    }
}, {
    timestamps: true
});

// Ensure unique Config per Key per Company
DocumentTypeSchema.index({ companyId: 1, key: 1 }, { unique: true });

module.exports = mongoose.model('DocumentType', DocumentTypeSchema);
