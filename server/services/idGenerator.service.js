/**
 * ═══════════════════════════════════════════════════════════════════════
 * CUSTOM ID GENERATOR SERVICE
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Central service for generating custom IDs based on company configuration.
 * Transaction-safe, atomic counter increments.
 * 
 * @version 3.0 - Production Ready
 */

const mongoose = require('mongoose');
const CompanyIdConfig = require('../models/CompanyIdConfig');

/**
 * Generate custom ID for any entity
 * 
 * @param {ObjectId} companyId - Company/Tenant ID
 * @param {string} entityType - JOB, APPLICATION, OFFER, EMPLOYEE, PAYSLIP, CANDIDATE
 * @param {string} departmentCode - Optional department code (for EMPLOYEE)
 * @returns {Promise<string>} Generated ID
 */
async function generateCustomId(companyId, entityType, departmentCode = null) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // Normalize entity type
        entityType = entityType.toUpperCase();

        // Get or create configuration
        let config = await CompanyIdConfig.findOne({
            companyId,
            entityType,
            isActive: true
        }).session(session);

        if (!config) {
            // Initialize defaults if not exists
            await CompanyIdConfig.initializeDefaults(companyId);

            config = await CompanyIdConfig.findOne({
                companyId,
                entityType,
                isActive: true
            }).session(session);

            if (!config) {
                throw new Error(`Failed to initialize ID configuration for ${entityType}`);
            }
        }

        // Get next sequence number (with auto-reset check)
        const sequence = await config.getNextSequence();

        // Build ID
        const generatedId = config.buildId(sequence, departmentCode);

        // Save updated config (incremented counter)
        await config.save({ session });

        // Commit transaction
        await session.commitTransaction();

        console.log(`✅ Generated ${entityType} ID: ${generatedId} (seq: ${sequence})`);

        return generatedId;

    } catch (error) {
        await session.abortTransaction();
        console.error(`❌ ID Generation Error for ${entityType}:`, error);
        throw new Error(`Failed to generate ${entityType} ID: ${error.message}`);
    } finally {
        session.endSession();
    }
}

/**
 * Helper functions for specific entity types
 */

async function generateJobId(companyId) {
    return generateCustomId(companyId, 'JOB');
}

async function generateCandidateId(companyId) {
    return generateCustomId(companyId, 'CANDIDATE');
}

async function generateApplicationId(companyId) {
    return generateCustomId(companyId, 'APPLICATION');
}

async function generateInterviewId(companyId) {
    return generateCustomId(companyId, 'INTERVIEW');
}

async function generateOfferId(companyId) {
    return generateCustomId(companyId, 'OFFER');
}

async function generateEmployeeId(companyId, departmentCode) {
    if (!departmentCode) {
        throw new Error('Department code is required for Employee ID generation');
    }
    return generateCustomId(companyId, 'EMPLOYEE', departmentCode);
}

async function generatePayslipId(companyId) {
    return generateCustomId(companyId, 'PAYSLIP');
}

/**
 * Preview ID format without generating
 */
async function previewIdFormat(companyId, entityType, departmentCode = 'DEPT') {
    try {
        const config = await CompanyIdConfig.getOrCreate(companyId, entityType.toUpperCase());

        if (!config) {
            throw new Error(`Configuration not found for ${entityType}`);
        }

        return {
            preview: config.buildPreview(departmentCode),
            config: {
                prefix: config.prefix,
                separator: config.separator,
                includeYear: config.includeYear,
                yearFormat: config.yearFormat,
                includeMonth: config.includeMonth,
                monthFormat: config.monthFormat,
                includeDepartment: config.includeDepartment,
                padding: config.padding,
                startFrom: config.startFrom,
                currentSeq: config.currentSeq,
                resetPolicy: config.resetPolicy,
                isLocked: config.isLocked,
                generatedCount: config.generatedCount
            }
        };
    } catch (error) {
        console.error('Preview ID Format Error:', error);
        throw error;
    }
}

/**
 * Get current sequence number
 */
async function getCurrentSequence(companyId, entityType) {
    try {
        const config = await CompanyIdConfig.findOne({
            companyId,
            entityType: entityType.toUpperCase(),
            isActive: true
        });

        return config ? config.currentSeq : 0;
    } catch (error) {
        console.error('Get Current Sequence Error:', error);
        return 0;
    }
}

/**
 * Validate ID format
 */
async function validateIdFormat(companyId, entityType, idValue) {
    try {
        const config = await CompanyIdConfig.findOne({
            companyId,
            entityType: entityType.toUpperCase(),
            isActive: true
        });

        if (!config) {
            return { valid: false, error: 'Configuration not found' };
        }

        // Build regex pattern from config
        const parts = [config.prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')];

        if (config.includeYear) {
            parts.push(config.yearFormat === 'YYYY' ? '\\d{4}' : '\\d{2}');
        }

        if (config.includeMonth) {
            parts.push(config.monthFormat === 'MM' ? '\\d{2}' : '\\d{1,2}');
        }

        if (config.includeDepartment) {
            parts.push('[A-Z0-9]+');
        }

        parts.push(`\\d{${config.padding}}`);

        const separator = config.separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^${parts.join(separator)}$`);

        const valid = pattern.test(idValue);

        return {
            valid,
            pattern: pattern.toString(),
            error: valid ? null : 'ID format does not match configuration'
        };

    } catch (error) {
        return { valid: false, error: error.message };
    }
}

module.exports = {
    // Main function
    generateCustomId,

    // Helper functions
    generateJobId,
    generateCandidateId,
    generateApplicationId,
    generateInterviewId,
    generateOfferId,
    generateEmployeeId,
    generatePayslipId,

    // Utility functions
    previewIdFormat,
    getCurrentSequence,
    validateIdFormat
};
