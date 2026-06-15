const mongoose = require('mongoose');

/**
 * BGV Evidence Configuration Model
 * Defines mandatory evidence requirements for each check type
 * Supports tenant-specific customization
 */
const BGVEvidenceConfigSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
        index: true
    },
    checkType: {
        type: String,
        enum: ['IDENTITY', 'ADDRESS', 'EDUCATION', 'EMPLOYMENT', 'CRIMINAL', 'REFERENCE', 'SOCIAL_MEDIA'],
        required: true,
        index: true
    },

    // Required Evidence Configuration
    requiredDocuments: [{
        documentType: {
            type: String,
            enum: [
                'AADHAAR', 'PAN', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID',
                'DEGREE_CERTIFICATE', 'MARKSHEET', 'EXPERIENCE_LETTER', 'PAYSLIP',
                'RELIEVING_LETTER', 'ADDRESS_PROOF', 'POLICE_VERIFICATION',
                'REFERENCE_LETTER', 'COURT_SEARCH_RESULT', 'UTILITY_BILL',
                'RENT_AGREEMENT', 'OTHER'
            ],
            required: true
        },
        isMandatory: {
            type: Boolean,
            default: true
        },
        minCount: {
            type: Number,
            default: 1 // e.g., "At least 2 payslips"
        },
        validationRules: {
            maxAgeDays: Number, // Document must be recent (e.g., utility bill within 90 days)
            requireOCR: Boolean, // Requires OCR extraction
            requireManualReview: Boolean, // Always needs human verification
            customValidation: String // Custom validation function name
        },
        description: String // Human-readable description
    }],

    // Optional Evidence
    optionalDocuments: [{
        documentType: String,
        description: String
    }],

    // Validation Settings
    validationSettings: {
        requireAllMandatory: {
            type: Boolean,
            default: true
        },
        allowManualOverride: {
            type: Boolean,
            default: false // Admin can override evidence requirement
        },
        overrideRequiresApproval: {
            type: Boolean,
            default: true
        },
        minDocumentQualityScore: {
            type: Number,
            default: 0.7 // OCR confidence threshold
        }
    },

    // Maker-Checker Settings
    makerCheckerSettings: {
        enabled: {
            type: Boolean,
            default: true
        },
        requireDifferentUsers: {
            type: Boolean,
            default: true
        },
        checkerRoles: [{
            type: String,
            default: ['HR_ADMIN', 'BGV_ADMIN']
        }]
    },

    // Active/Inactive
    isActive: {
        type: Boolean,
        default: true
    },

    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    collection: 'bgv_evidence_configs'
});

// Indexes
BGVEvidenceConfigSchema.index({ tenant: 1, checkType: 1 }, { unique: true });

// Default configurations for each check type
BGVEvidenceConfigSchema.statics.getDefaultConfig = function (checkType) {
    const defaults = {
        IDENTITY: {
            requiredDocuments: [
                {
                    documentType: 'AADHAAR',
                    isMandatory: false, // Either Aadhaar OR PAN
                    minCount: 1,
                    validationRules: {
                        requireOCR: true,
                        requireManualReview: true
                    },
                    description: 'Aadhaar Card with clear photo and number'
                },
                {
                    documentType: 'PAN',
                    isMandatory: false, // Either Aadhaar OR PAN
                    minCount: 1,
                    validationRules: {
                        requireOCR: true,
                        requireManualReview: true
                    },
                    description: 'PAN Card with clear details'
                }
            ],
            validationSettings: {
                requireAllMandatory: false, // At least one of Aadhaar/PAN
                allowManualOverride: false
            }
        },
        EMPLOYMENT: {
            requiredDocuments: [
                {
                    documentType: 'EXPERIENCE_LETTER',
                    isMandatory: true,
                    minCount: 1,
                    validationRules: {
                        requireManualReview: true
                    },
                    description: 'Experience/Relieving letter from previous employer'
                },
                {
                    documentType: 'PAYSLIP',
                    isMandatory: true,
                    minCount: 2,
                    validationRules: {
                        maxAgeDays: 365,
                        requireManualReview: true
                    },
                    description: 'At least 2 recent payslips'
                }
            ]
        },
        EDUCATION: {
            requiredDocuments: [
                {
                    documentType: 'DEGREE_CERTIFICATE',
                    isMandatory: true,
                    minCount: 1,
                    validationRules: {
                        requireManualReview: true
                    },
                    description: 'Degree certificate from university'
                },
                {
                    documentType: 'MARKSHEET',
                    isMandatory: true,
                    minCount: 1,
                    validationRules: {
                        requireManualReview: true
                    },
                    description: 'Final year marksheet or consolidated marksheet'
                }
            ]
        },
        ADDRESS: {
            requiredDocuments: [
                {
                    documentType: 'UTILITY_BILL',
                    isMandatory: false,
                    minCount: 1,
                    validationRules: {
                        maxAgeDays: 90,
                        requireManualReview: true
                    },
                    description: 'Recent utility bill (electricity/water/gas)'
                },
                {
                    documentType: 'RENT_AGREEMENT',
                    isMandatory: false,
                    minCount: 1,
                    validationRules: {
                        requireManualReview: true
                    },
                    description: 'Rent agreement or property documents'
                }
            ],
            validationSettings: {
                requireAllMandatory: false // At least one address proof
            }
        },
        CRIMINAL: {
            requiredDocuments: [
                {
                    documentType: 'POLICE_VERIFICATION',
                    isMandatory: false,
                    minCount: 1,
                    validationRules: {
                        maxAgeDays: 180,
                        requireManualReview: true
                    },
                    description: 'Police verification certificate'
                },
                {
                    documentType: 'COURT_SEARCH_RESULT',
                    isMandatory: false,
                    minCount: 1,
                    validationRules: {
                        requireManualReview: true
                    },
                    description: 'Court record search result or API response'
                }
            ],
            validationSettings: {
                requireAllMandatory: false
            }
        },
        REFERENCE: {
            requiredDocuments: [
                {
                    documentType: 'REFERENCE_LETTER',
                    isMandatory: true,
                    minCount: 2,
                    validationRules: {
                        requireManualReview: true
                    },
                    description: 'Reference letters with contact details'
                }
            ]
        },
        SOCIAL_MEDIA: {
            requiredDocuments: [
                {
                    documentType: 'OTHER',
                    isMandatory: true,
                    minCount: 1,
                    validationRules: {
                        requireManualReview: true
                    },
                    description: 'Social media verification report or screenshots'
                }
            ]
        }
    };

    return defaults[checkType] || { requiredDocuments: [] };
};

module.exports = BGVEvidenceConfigSchema;
