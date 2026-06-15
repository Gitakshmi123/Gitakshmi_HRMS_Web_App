/**
 * ═══════════════════════════════════════════════════════════════════════
 * CONFIGURABLE ID GENERATOR UTILITY
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Generates IDs based on company-specific configuration.
 * Reads ID format from CompanyIdConfig and generates accordingly.
 * 
 * @version 3.0 (Configurable)
 */

const mongoose = require('mongoose');

/**
 * Get models for database
 */
function getModels(db) {
    const CounterSource = require('../models/Counter');
    const CounterSchema = CounterSource.CounterSchema || CounterSource.schema || CounterSource;
    const Counter = db.models.Counter || db.model('Counter', CounterSchema);
    const CompanyIdConfig = db.models.CompanyIdConfig || db.model('CompanyIdConfig', require('../models/CompanyIdConfig'));

    return { Counter, CompanyIdConfig };
}

/**
 * Get or create company ID configuration
 */
async function getCompanyConfig(db, tenantId) {
    const { CompanyIdConfig } = getModels(db);

    let config = await CompanyIdConfig.findOne({ tenant: tenantId });

    // Initialize default config if not exists
    if (!config) {
        console.log(`Initializing default ID configuration for tenant: ${tenantId}`);
        config = await CompanyIdConfig.initializeDefaults(tenantId, 'system');
    }

    return config;
}

/**
 * Build counter key based on configuration
 */
function buildCounterKey(config, entityType, options = {}) {
    const parts = [entityType];

    const entityConfig = config.configurations.find(c => c.entityType === entityType);

    if (!entityConfig) {
        throw new Error(`Configuration not found for entity type: ${entityType}`);
    }

    // Add year if configured
    if (entityConfig.includeYear && entityConfig.resetPolicy === 'YEARLY') {
        const year = options.year || new Date().getFullYear();
        parts.push(year);
    }

    // Add month if configured (for payslip)
    if (entityConfig.includeMonth && entityConfig.resetPolicy === 'MONTHLY') {
        const month = options.month || (new Date().getMonth() + 1);
        parts.push(month);
    }

    // Add department if configured (for employee)
    if (entityConfig.includeDepartment && options.department) {
        parts.push(options.department.toUpperCase());
    }

    return parts.join('_');
}

/**
 * Format sequence number with padding
 */
function formatSequence(sequence, paddingLength) {
    return String(sequence).padStart(paddingLength, '0');
}

/**
 * Build ID from parts based on configuration
 */
function buildId(entityConfig, sequence, options = {}) {
    const parts = [entityConfig.prefix];

    // Add year if configured
    if (entityConfig.includeYear) {
        const year = options.year || new Date().getFullYear();
        const yearStr = entityConfig.yearFormat === 'YYYY'
            ? String(year)
            : String(year).slice(-2);
        parts.push(yearStr);
    }

    // Add month if configured (for payslip)
    if (entityConfig.includeMonth) {
        const month = options.month || (new Date().getMonth() + 1);
        const monthStr = entityConfig.monthFormat === 'MM'
            ? String(month).padStart(2, '0')
            : String(month);
        parts.push(monthStr);
    }

    // Add department if configured (for employee)
    if (entityConfig.includeDepartment && options.department) {
        const deptStr = entityConfig.departmentFormat === 'CODE'
            ? options.department.toUpperCase()
            : options.department.toUpperCase();
        parts.push(deptStr);
    }

    // Add sequence number
    const seqStr = formatSequence(sequence, entityConfig.paddingLength);
    parts.push(seqStr);

    return parts.join(entityConfig.separator);
}

/**
 * Generate ID with company configuration
 * 
 * @param {mongoose.Connection} db - Database connection
 * @param {ObjectId} tenantId - Tenant ID
 * @param {string} entityType - Entity type (job, application, offer, employee, payslip)
 * @param {object} options - Additional options (year, month, department)
 * @returns {Promise<string>} Generated ID
 */
async function generateConfigurableId(db, tenantId, entityType, options = {}) {
    try {
        const { Counter } = getModels(db);

        // Get company configuration
        const companyConfig = await getCompanyConfig(db, tenantId);

        // Get entity-specific configuration
        const entityConfig = companyConfig.configurations.find(c => c.entityType === entityType);

        if (!entityConfig) {
            throw new Error(`Configuration not found for entity type: ${entityType}`);
        }

        // Build counter key
        const counterKey = buildCounterKey(companyConfig, entityType, options);

        // Atomic increment
        const counter = await Counter.findOneAndUpdate(
            { key: counterKey },
            {
                $inc: { seq: 1 },
                $setOnInsert: { seq: entityConfig.startingNumber }
            },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            }
        );

        // Build ID
        const generatedId = buildId(entityConfig, counter.seq, options);

        // Lock configuration on first use
        if (!entityConfig.isLocked) {
            companyConfig.lockConfig(entityType);
            await companyConfig.save();
        }

        console.log(`✅ Generated ${entityType} ID: ${generatedId} (key: ${counterKey}, seq: ${counter.seq})`);

        return generatedId;

    } catch (error) {
        console.error('❌ Configurable ID Generation Error:', error);
        throw new Error(`Failed to generate ${entityType} ID: ${error.message}`);
    }
}

/**
 * Helper functions for specific entity types
 */

async function generateJobId(db, tenantId, year = null) {
    return generateConfigurableId(db, tenantId, 'job', { year });
}

async function generateCandidateId(db, tenantId, year = null) {
    return generateConfigurableId(db, tenantId, 'candidate', { year });
}

async function generateApplicationId(db, tenantId, year = null) {
    return generateConfigurableId(db, tenantId, 'application', { year });
}

async function generateInterviewId(db, tenantId, year = null) {
    return generateConfigurableId(db, tenantId, 'interview', { year });
}

async function generateOfferId(db, tenantId, year = null) {
    return generateConfigurableId(db, tenantId, 'offer', { year });
}

async function generateEmployeeId(db, tenantId, department = null, year = null) {
    return generateConfigurableId(db, tenantId, 'employee', { department, year });
}

async function generatePayslipId(db, tenantId, month = null, year = null) {
    const currentDate = new Date();
    return generateConfigurableId(db, tenantId, 'payslip', {
        month: month || (currentDate.getMonth() + 1),
        year: year || currentDate.getFullYear()
    });
}

/**
 * Preview ID format without generating
 */
async function previewIdFormat(db, tenantId, entityType, options = {}) {
    try {
        const companyConfig = await getCompanyConfig(db, tenantId);
        const entityConfig = companyConfig.configurations.find(c => c.entityType === entityType);

        if (!entityConfig) {
            throw new Error(`Configuration not found for entity type: ${entityType}`);
        }

        // Build preview with example sequence
        const previewId = buildId(entityConfig, 1, options);

        return {
            format: previewId,
            config: {
                prefix: entityConfig.prefix,
                separator: entityConfig.separator,
                includeYear: entityConfig.includeYear,
                yearFormat: entityConfig.yearFormat,
                includeMonth: entityConfig.includeMonth,
                includeDepartment: entityConfig.includeDepartment,
                paddingLength: entityConfig.paddingLength,
                resetPolicy: entityConfig.resetPolicy,
                isLocked: entityConfig.isLocked,
                generatedCount: entityConfig.generatedCount
            }
        };

    } catch (error) {
        console.error('Preview ID Format Error:', error);
        throw error;
    }
}

/**
 * Get current counter value
 */
async function getCurrentCounter(db, tenantId, entityType, options = {}) {
    try {
        const { Counter } = getModels(db);
        const companyConfig = await getCompanyConfig(db, tenantId);

        const counterKey = buildCounterKey(companyConfig, entityType, options);
        const counter = await Counter.findOne({ key: counterKey });

        return counter ? counter.seq : 0;

    } catch (error) {
        console.error('Get Counter Error:', error);
        return 0;
    }
}

/**
 * Validate ID format against configuration
 */
async function validateIdFormat(db, tenantId, entityType, idValue) {
    try {
        const companyConfig = await getCompanyConfig(db, tenantId);
        const entityConfig = companyConfig.configurations.find(c => c.entityType === entityType);

        if (!entityConfig) {
            return { valid: false, error: 'Configuration not found' };
        }

        // Build regex pattern from configuration
        const parts = [entityConfig.prefix];

        if (entityConfig.includeYear) {
            parts.push(entityConfig.yearFormat === 'YYYY' ? '\\d{4}' : '\\d{2}');
        }

        if (entityConfig.includeMonth) {
            parts.push(entityConfig.monthFormat === 'MM' ? '\\d{2}' : '\\d{1,2}');
        }

        if (entityConfig.includeDepartment) {
            parts.push('[A-Z0-9]+');
        }

        parts.push(`\\d{${entityConfig.paddingLength}}`);

        const pattern = new RegExp(`^${parts.join(entityConfig.separator.replace('-', '\\-'))}$`);

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
    generateConfigurableId,

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
    getCurrentCounter,
    validateIdFormat,
    getCompanyConfig,

    // For backward compatibility
    generateId: generateConfigurableId
};
