const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * 🔐 BGV Evidence Validator Service
 * 
 * Enterprise-grade evidence validation engine
 * Enforces mandatory evidence requirements before allowing verification
 * 
 * CRITICAL PRINCIPLE: No verification without validated evidence
 */
class BGVEvidenceValidator {

    /**
     * Validate if a check has all required evidence
     * @param {Object} check - BGVCheck document
     * @param {Array} documents - Array of BGVDocument documents
     * @param {Object} evidenceConfig - BGVEvidenceConfig for this check type
     * @returns {Object} - Validation result with status and details
     */
    static async validateCheckEvidence(check, documents, evidenceConfig) {
        const result = {
            isValid: false,
            hasRequiredEvidence: false,
            evidenceCompleteness: 0,
            missingDocuments: [],
            validationErrors: [],
            validationWarnings: [],
            uploadedDocumentTypes: [],
            requiredDocumentTypes: []
        };

        try {
            // If no evidence config, use default
            if (!evidenceConfig) {
                evidenceConfig = this.getDefaultEvidenceConfig(check.type);
            }

            // Get required document types
            const requiredDocs = evidenceConfig.requiredDocuments || [];
            result.requiredDocumentTypes = requiredDocs.map(doc => doc.documentType);

            // Get uploaded document types for this check
            const checkDocuments = documents.filter(doc =>
                doc.checkId && doc.checkId.toString() === check._id.toString() && !doc.isDeleted
            );
            result.uploadedDocumentTypes = [...new Set(checkDocuments.map(doc => doc.documentType))];

            // Validate each required document type
            for (const reqDoc of requiredDocs) {
                const matchingDocs = checkDocuments.filter(doc => doc.documentType === reqDoc.documentType);

                // Check if mandatory document is missing
                if (reqDoc.isMandatory && matchingDocs.length === 0) {
                    result.missingDocuments.push(reqDoc.documentType);
                    result.validationErrors.push({
                        field: reqDoc.documentType,
                        message: `Missing mandatory document: ${reqDoc.documentType}`,
                        severity: 'ERROR'
                    });
                }

                // Check minimum count requirement
                if (matchingDocs.length < reqDoc.minCount) {
                    result.validationErrors.push({
                        field: reqDoc.documentType,
                        message: `Insufficient documents: ${reqDoc.documentType}. Required: ${reqDoc.minCount}, Found: ${matchingDocs.length}`,
                        severity: 'ERROR'
                    });
                }

                // Validate document age if required
                if (reqDoc.validationRules?.maxAgeDays && matchingDocs.length > 0) {
                    const maxAge = reqDoc.validationRules.maxAgeDays;
                    const cutoffDate = new Date();
                    cutoffDate.setDate(cutoffDate.getDate() - maxAge);

                    const outdatedDocs = matchingDocs.filter(doc => {
                        const docDate = doc.evidenceMetadata?.documentDate || doc.uploadedAt;
                        return new Date(docDate) < cutoffDate;
                    });

                    if (outdatedDocs.length > 0) {
                        result.validationWarnings.push(
                            `Document ${reqDoc.documentType} is older than ${maxAge} days. Please upload a recent document.`
                        );
                    }
                }

                // Check if documents are reviewed
                if (matchingDocs.length > 0) {
                    const unreviewed = matchingDocs.filter(doc =>
                        !doc.reviewStatus || doc.reviewStatus.status === 'PENDING'
                    );

                    if (unreviewed.length > 0) {
                        result.validationWarnings.push(
                            `${unreviewed.length} document(s) of type ${reqDoc.documentType} are pending review`
                        );
                    }

                    const rejected = matchingDocs.filter(doc =>
                        doc.reviewStatus?.status === 'REJECTED'
                    );

                    if (rejected.length > 0) {
                        result.validationErrors.push({
                            field: reqDoc.documentType,
                            message: `${rejected.length} document(s) of type ${reqDoc.documentType} were rejected`,
                            severity: 'ERROR'
                        });
                    }
                }
            }

            // Handle "at least one of" scenarios (e.g., Aadhaar OR PAN)
            if (evidenceConfig.validationSettings?.requireAllMandatory === false) {
                const mandatoryDocs = requiredDocs.filter(doc => doc.isMandatory);
                const hasAtLeastOne = mandatoryDocs.some(reqDoc => {
                    return checkDocuments.some(doc => doc.documentType === reqDoc.documentType);
                });

                if (!hasAtLeastOne && mandatoryDocs.length > 0) {
                    result.validationErrors.push({
                        field: 'GENERAL',
                        message: `At least one of the following documents is required: ${mandatoryDocs.map(d => d.documentType).join(', ')}`,
                        severity: 'ERROR'
                    });
                }
            }

            // Calculate evidence completeness percentage
            const totalRequired = requiredDocs.filter(doc => doc.isMandatory).length;
            const totalUploaded = requiredDocs.filter(reqDoc => {
                return checkDocuments.some(doc => doc.documentType === reqDoc.documentType);
            }).length;

            result.evidenceCompleteness = totalRequired > 0
                ? Math.round((totalUploaded / totalRequired) * 100)
                : 0;

            // Determine if evidence is valid
            result.hasRequiredEvidence = result.validationErrors.length === 0;
            result.isValid = result.hasRequiredEvidence;

            return result;

        } catch (error) {
            console.error('[BGV_EVIDENCE_VALIDATOR] Error:', error);
            result.validationErrors.push({
                field: 'SYSTEM',
                message: `Validation error: ${error.message}`,
                severity: 'ERROR'
            });
            return result;
        }
    }

    /**
     * Generate SHA-256 hash for document file
     * @param {String} filePath - Absolute path to file
     * @returns {Promise<String>} - SHA-256 hash
     */
    static async generateDocumentHash(filePath) {
        return new Promise((resolve, reject) => {
            try {
                const hash = crypto.createHash('sha256');
                const stream = fs.createReadStream(filePath);

                stream.on('data', (data) => {
                    hash.update(data);
                });

                stream.on('end', () => {
                    resolve(hash.digest('hex'));
                });

                stream.on('error', (err) => {
                    reject(err);
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Verify document integrity by comparing hash
     * @param {String} filePath - Absolute path to file
     * @param {String} storedHash - Hash stored in database
     * @returns {Promise<Boolean>} - True if hashes match
     */
    static async verifyDocumentIntegrity(filePath, storedHash) {
        try {
            const currentHash = await this.generateDocumentHash(filePath);
            return currentHash === storedHash;
        } catch (error) {
            console.error('[BGV_EVIDENCE_VALIDATOR] Hash verification error:', error);
            return false;
        }
    }

    /**
     * Validate maker-checker workflow compliance
     * @param {Object} check - BGVCheck document
     * @param {Object} user - Current user attempting action
     * @param {String} action - 'VERIFY' or 'APPROVE'
     * @returns {Object} - Validation result
     */
    static validateMakerCheckerCompliance(check, user, action) {
        const result = {
            isValid: false,
            errors: [],
            warnings: []
        };

        try {
            const workflow = check.verificationWorkflow || {};

            if (action === 'VERIFY') {
                // Maker action - no restrictions
                result.isValid = true;
            } else if (action === 'APPROVE') {
                // Checker action - must be different user
                if (!workflow.verifiedBy) {
                    result.errors.push('Check must be verified before approval');
                    return result;
                }

                const verifierId = workflow.verifiedBy.toString();
                const approverId = user._id.toString();

                if (verifierId === approverId) {
                    result.errors.push('Approver must be different from verifier (Maker-Checker violation)');
                    return result;
                }

                // Check if already approved
                if (workflow.approvalDecision === 'APPROVED') {
                    result.errors.push('Check is already approved');
                    return result;
                }

                result.isValid = true;
            }

            return result;

        } catch (error) {
            console.error('[BGV_EVIDENCE_VALIDATOR] Maker-Checker validation error:', error);
            result.errors.push(`Validation error: ${error.message}`);
            return result;
        }
    }

    /**
     * Get default evidence configuration for a check type
     * @param {String} checkType - Type of BGV check
     * @returns {Object} - Default evidence configuration
     */
    static getDefaultEvidenceConfig(checkType) {
        const defaults = {
            IDENTITY: {
                requiredDocuments: [
                    {
                        documentType: 'AADHAAR',
                        isMandatory: false,
                        minCount: 1,
                        validationRules: { requireOCR: true, requireManualReview: true }
                    },
                    {
                        documentType: 'PAN',
                        isMandatory: false,
                        minCount: 1,
                        validationRules: { requireOCR: true, requireManualReview: true }
                    }
                ],
                validationSettings: { requireAllMandatory: false }
            },
            EMPLOYMENT: {
                requiredDocuments: [
                    {
                        documentType: 'EXPERIENCE_LETTER',
                        isMandatory: true,
                        minCount: 1,
                        validationRules: { requireManualReview: true }
                    },
                    {
                        documentType: 'PAYSLIP',
                        isMandatory: true,
                        minCount: 2,
                        validationRules: { maxAgeDays: 365, requireManualReview: true }
                    }
                ],
                validationSettings: { requireAllMandatory: true }
            },
            EDUCATION: {
                requiredDocuments: [
                    {
                        documentType: 'DEGREE_CERTIFICATE',
                        isMandatory: true,
                        minCount: 1,
                        validationRules: { requireManualReview: true }
                    },
                    {
                        documentType: 'MARKSHEET',
                        isMandatory: true,
                        minCount: 1,
                        validationRules: { requireManualReview: true }
                    }
                ],
                validationSettings: { requireAllMandatory: true }
            },
            ADDRESS: {
                requiredDocuments: [
                    {
                        documentType: 'UTILITY_BILL',
                        isMandatory: false,
                        minCount: 1,
                        validationRules: { maxAgeDays: 90, requireManualReview: true }
                    },
                    {
                        documentType: 'RENT_AGREEMENT',
                        isMandatory: false,
                        minCount: 1,
                        validationRules: { requireManualReview: true }
                    }
                ],
                validationSettings: { requireAllMandatory: false }
            },
            CRIMINAL: {
                requiredDocuments: [
                    {
                        documentType: 'POLICE_VERIFICATION',
                        isMandatory: false,
                        minCount: 1,
                        validationRules: { maxAgeDays: 180, requireManualReview: true }
                    },
                    {
                        documentType: 'COURT_SEARCH_RESULT',
                        isMandatory: false,
                        minCount: 1,
                        validationRules: { requireManualReview: true }
                    }
                ],
                validationSettings: { requireAllMandatory: false }
            },
            REFERENCE: {
                requiredDocuments: [
                    {
                        documentType: 'REFERENCE_LETTER',
                        isMandatory: true,
                        minCount: 2,
                        validationRules: { requireManualReview: true }
                    }
                ],
                validationSettings: { requireAllMandatory: true }
            },
            SOCIAL_MEDIA: {
                requiredDocuments: [
                    {
                        documentType: 'OTHER',
                        isMandatory: true,
                        minCount: 1,
                        validationRules: { requireManualReview: true }
                    }
                ],
                validationSettings: { requireAllMandatory: true }
            }
        };

        return defaults[checkType] || { 
            requiredDocuments: [
                {
                    documentType: 'OTHER',
                    isMandatory: true,
                    minCount: 1,
                    validationRules: { requireManualReview: true },
                    description: `Supporting documents for ${checkType} verification`
                }
            ], 
            validationSettings: { requireAllMandatory: true } 
        };
    }

    /**
     * Check-specific validation logic
     */
    static async validateIdentityCheck(documents, candidateData) {
        const errors = [];
        const warnings = [];

        // Validate Aadhaar
        const aadhaarDocs = documents.filter(doc => doc.documentType === 'AADHAAR');
        if (aadhaarDocs.length > 0) {
            const aadhaar = aadhaarDocs[0];
            const extractedNumber = aadhaar.evidenceMetadata?.documentNumber;

            if (extractedNumber && extractedNumber.length !== 12) {
                errors.push('Invalid Aadhaar number format (must be 12 digits)');
            }
        }

        // Validate PAN
        const panDocs = documents.filter(doc => doc.documentType === 'PAN');
        if (panDocs.length > 0) {
            const pan = panDocs[0];
            const extractedNumber = pan.evidenceMetadata?.documentNumber;

            if (extractedNumber && extractedNumber.length !== 10) {
                errors.push('Invalid PAN number format (must be 10 characters)');
            }
        }

        return { errors, warnings };
    }

    static async validateEmploymentCheck(documents, candidateData) {
        const errors = [];
        const warnings = [];

        // Validate payslips
        const payslips = documents.filter(doc => doc.documentType === 'PAYSLIP');
        if (payslips.length < 2) {
            errors.push('At least 2 payslips are required for employment verification');
        }

        // Check payslip dates
        const payslipDates = payslips
            .map(doc => doc.evidenceMetadata?.documentDate)
            .filter(date => date)
            .sort();

        if (payslipDates.length >= 2) {
            const firstDate = new Date(payslipDates[0]);
            const lastDate = new Date(payslipDates[payslipDates.length - 1]);
            const daysDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24);

            if (daysDiff < 30) {
                warnings.push('Payslips should span at least 30 days');
            }
        }

        return { errors, warnings };
    }

    static async validateEducationCheck(documents, candidateData) {
        const errors = [];
        const warnings = [];

        // Validate degree and marksheet presence
        const degrees = documents.filter(doc => doc.documentType === 'DEGREE_CERTIFICATE');
        const marksheets = documents.filter(doc => doc.documentType === 'MARKSHEET');

        if (degrees.length === 0) {
            errors.push('Degree certificate is mandatory');
        }

        if (marksheets.length === 0) {
            errors.push('Marksheet is mandatory');
        }

        // Validate degree year vs candidate DOB
        if (degrees.length > 0 && candidateData?.dob) {
            const degreeYear = degrees[0].evidenceMetadata?.documentDate;
            if (degreeYear) {
                const candidateDOB = new Date(candidateData.dob);
                const degreeDate = new Date(degreeYear);
                const age = (degreeDate - candidateDOB) / (1000 * 60 * 60 * 24 * 365);

                if (age < 18) {
                    errors.push('Degree year is inconsistent with candidate date of birth');
                }
            }
        }

        return { errors, warnings };
    }

    static async validateAddressCheck(documents, candidateData) {
        const errors = [];
        const warnings = [];

        // Check for at least one address proof
        const addressProofs = documents.filter(doc =>
            ['UTILITY_BILL', 'RENT_AGREEMENT', 'ADDRESS_PROOF'].includes(doc.documentType)
        );

        if (addressProofs.length === 0) {
            errors.push('At least one address proof document is required');
        }

        // Validate utility bill age
        const utilityBills = documents.filter(doc => doc.documentType === 'UTILITY_BILL');
        if (utilityBills.length > 0) {
            const bill = utilityBills[0];
            const billDate = bill.evidenceMetadata?.documentDate;

            if (billDate) {
                const daysSinceBill = (new Date() - new Date(billDate)) / (1000 * 60 * 60 * 24);
                if (daysSinceBill > 90) {
                    warnings.push('Utility bill is older than 90 days. Please upload a recent bill.');
                }
            }
        }

        return { errors, warnings };
    }
}

module.exports = BGVEvidenceValidator;
