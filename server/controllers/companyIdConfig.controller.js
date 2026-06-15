const mongoose = require('mongoose');
const CompanySettings = require('../models/CompanySettings');
const DocumentType = require('../models/DocumentType');
const DocumentCounter = require('../models/DocumentCounter');
const CompanyIdConfig = require('../models/CompanyIdConfig'); // Legacy for migration

// Standard Enterprise Defaults
const DEFAULT_DOC_TYPES = {
    JOB: { name: 'Job Requisition', prefix: 'JOB', formatTemplate: '{{COMPANY}}/{{DEPT}}/{{PREFIX}}/{{YEAR}}/{{COUNTER}}', startFrom: 10001, generationMode: 'AUTO' },
    POS: { name: 'Position', prefix: 'POS', formatTemplate: '{{COMPANY}}/{{DEPT}}/{{PREFIX}}/{{YEAR}}/{{COUNTER}}', startFrom: 1, generationMode: 'AUTO' },
    APP: { name: 'Job Application', prefix: 'APP', formatTemplate: '{{PREFIX}}/{{YEAR}}/{{COUNTER}}', startFrom: 1, generationMode: 'AUTO' },
    CAND: { name: 'Candidate ID', prefix: 'CAN', formatTemplate: '{{PREFIX}}-{{YEAR}}-{{COUNTER}}', startFrom: 1000, generationMode: 'AUTO' },
    OFF: { name: 'Offer Letter', prefix: 'OFF', formatTemplate: '{{COMPANY}}/{{DEPT}}/{{PREFIX}}/{{YEAR}}/{{COUNTER}}', startFrom: 1, generationMode: 'AUTO' },
    APPT: { name: 'Appointment Letter', prefix: 'APPT', formatTemplate: '{{COMPANY}}/{{DEPT}}/{{PREFIX}}/{{YEAR}}/{{COUNTER}}', startFrom: 10001, generationMode: 'AUTO' },
    EMP: { name: 'Employee ID', prefix: 'EMP', formatTemplate: '{{PREFIX}}-{{YEAR}}-{{COUNTER}}', startFrom: 1000, resetPolicy: 'YEARLY', generationMode: 'AUTO' },
    INTN: { name: 'Intern ID', prefix: 'INTN', formatTemplate: '{{PREFIX}}-{{YEAR}}-{{COUNTER}}', startFrom: 1000, resetPolicy: 'YEARLY', generationMode: 'AUTO' },
    INT: { name: 'Interview', prefix: 'INT', formatTemplate: '{{COMPANY}}/{{PREFIX}}/{{YEAR}}/{{COUNTER}}', startFrom: 1, generationMode: 'AUTO' },
    EXP: { name: 'Experience Letter', prefix: 'EXP', formatTemplate: '{{COMPANY}}/{{PREFIX}}/{{YEAR}}/{{COUNTER}}', startFrom: 1, generationMode: 'AUTO' },
    REL: { name: 'Relieving Letter', prefix: 'REL', formatTemplate: '{{COMPANY}}/{{PREFIX}}/{{YEAR}}/{{COUNTER}}', startFrom: 1, generationMode: 'AUTO' }
};

// Legacy mappings for migration
const LEGACY_MAP = {
    'APPLICATION': 'APP',
    'OFFER': 'OFF',
    'APPOINTMENT': 'APPT',
    'EMPLOYEE': 'EMP',
    'INTERN': 'INTN',
    'CANDIDATE': 'CAND',
    'JOB_REQUISITION': 'JOB',
    'POSITION': 'POS'
};

/**
 * INITIALIZATION Engine
 * Ensures Settings and Document Types exist for the tenant.
 * Migrates data from CompanyIdConfig if needed.
 */
const ensureConfiguration = async (tenantId) => {
    // 1. Ensure Company Settings
    let settings = await CompanySettings.findOne({ companyId: tenantId });
    if (!settings) {
        // Try to migrate from CompanyIdConfig or defaults
        const oldConfig = await CompanyIdConfig.findOne({ companyId: tenantId });
        settings = await CompanySettings.create({
            companyId: tenantId,
            companyCode: oldConfig?.companyCode || 'GTPL',
            branchCode: oldConfig?.branchCode || 'AHM',
            departmentCode: oldConfig?.departmentCode || 'GEN'
        });
    }

    // 2. Ensure Document Types
    const existingTypes = await DocumentType.find({ companyId: tenantId });
    const existingKeys = existingTypes.map(t => t.key);

    const keysToCreate = Object.keys(DEFAULT_DOC_TYPES).filter(k => !existingKeys.includes(k));

    for (const key of keysToCreate) {
        // Check legacy config first
        const legacyKey = Object.keys(LEGACY_MAP).find(k => LEGACY_MAP[k] === key) || key;
        const oldConfig = await CompanyIdConfig.findOne({ companyId: tenantId, entityType: legacyKey });

        const defaults = DEFAULT_DOC_TYPES[key];

        await DocumentType.create({
            companyId: tenantId,
            key: key,
            name: defaults.name,
            prefix: oldConfig?.prefix || defaults.prefix,
            formatTemplate: oldConfig?.formatTemplate || defaults.formatTemplate,
            startFrom: oldConfig?.startFrom || defaults.startFrom,
            paddingDigits: oldConfig?.padding || 4, // Mapping padding to paddingDigits
            resetPolicy: oldConfig?.resetPolicy || defaults.resetPolicy || 'YEARLY',
            generationMode: oldConfig?.mode || defaults.generationMode || 'AUTO'
        });

        // Migrate Counter if old config exists
        if (oldConfig) {
            // If we have an old counter, we assume it belongs to the CURRENT financial year or GLOBAL
            // To be safe, we init the counter for the current settings year
            const counterKey = (oldConfig.resetPolicy || defaults.resetPolicy) === 'NEVER' ? 'GLOBAL' : settings.financialYear;

            // Create counter with lastNumber = currentSeq
            // Check if already exists (race condition)
            const exists = await DocumentCounter.findOne({ companyId: tenantId, documentType: key, financialYear: counterKey });
            if (!exists) {
                await DocumentCounter.create({
                    companyId: tenantId,
                    documentType: key,
                    financialYear: counterKey,
                    lastNumber: oldConfig.currentSeq || 0
                });
            }
        }
    }

    return settings;
};


/**
 * GET CONFIGURATIONS
 * Returns { settings, documentTypes }
 */
exports.getConfigurations = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const settings = await ensureConfiguration(tenantId);
        const docTypes = await DocumentType.find({ companyId: tenantId });

        // Augment with NEXT number for preview
        const configsWithPreview = await Promise.all(docTypes.map(async (doc) => {
            const counterKey = doc.resetPolicy === 'NEVER' ? 'GLOBAL' : settings.financialYear;
            const counter = await DocumentCounter.findOne({ companyId: tenantId, documentType: doc.key, financialYear: counterKey });
            const lastNum = counter ? counter.lastNumber : (doc.startFrom - 1);
            const nextNum = lastNum + 1;

            // Simplified preview gen (reuse logic ideally, but quick here)
            const params = {
                COMPANY: settings.companyCode,
                BRANCH: settings.branchCode,
                DEPT: settings.departmentCode, // Default
                PREFIX: doc.prefix,
                YEAR: settings.financialYear,
                COUNTER: String(nextNum).padStart(doc.paddingDigits, '0')
            };

            let preview = doc.formatTemplate;
            Object.keys(params).forEach(k => preview = preview.replace(`{{${k}}}`, params[k]));

            return {
                ...doc.toObject(),
                nextNumber: nextNum,
                financialYear: settings.financialYear,
                previewId: preview,
                lastNumber: lastNum
            };
        }));

        res.json({
            success: true,
            data: {
                settings,
                documentTypes: configsWithPreview
            }
        });

    } catch (error) {
        console.error("Error fetching configs:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * SAVE CONFIGURATIONS
 * Handles updates to CompanySettings and DocumentTypes
 */
exports.saveConfigurations = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { settings: settingsUpdate, documentTypes: typesUpdate } = req.body;

        // 1. Update Settings
        let settings;
        if (settingsUpdate) {
            settings = await CompanySettings.findOneAndUpdate(
                { companyId: tenantId },
                { $set: settingsUpdate },
                { new: true, upsert: true }
            );
        } else {
            settings = await CompanySettings.findOne({ companyId: tenantId });
        }

        // 2. Update Types
        const results = [];
        if (Array.isArray(typesUpdate)) {
            for (const typeFn of typesUpdate) {
                if (!typeFn.key) continue;

                // If startFrom changed, should we reset counter? 
                // Advanced logic: Only if explicitly requested or handling logic needed. 
                // For now, we update config. Counter respects previous state unless manual intervention.

                const updated = await DocumentType.findOneAndUpdate(
                    { companyId: tenantId, key: typeFn.key },
                    { $set: typeFn },
                    { new: true }
                );
                results.push(updated);
            }
        }

        res.json({
            success: true,
            message: 'Configuration saved',
            data: {
                settings,
                documentTypes: results
            }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * INTERNAL GENERATE ID
 * The Core Engine Function
 */
exports.generateIdInternal = async ({ tenantId, entityType, increment, extraReplacements = {} }) => {

    // 1. Load Context
    // Map legacy entity types to new Keys if needed
    const key = LEGACY_MAP[entityType] || entityType;

    let settings = await CompanySettings.findOne({ companyId: tenantId });
    if (!settings) settings = await ensureConfiguration(tenantId);

    let docType = await DocumentType.findOne({ companyId: tenantId, key: key });

    // Auto-create doc type if missing (robustness)
    if (!docType && DEFAULT_DOC_TYPES[key]) {
        await ensureConfiguration(tenantId); // Should create it
        docType = await DocumentType.findOne({ companyId: tenantId, key: key });
    }

    if (!docType) throw new Error(`Document Type configuration not found for: ${key}`);

    // 2. Determine Counter Context
    let counterKey;
    if (docType.resetPolicy === 'NEVER') {
        counterKey = 'GLOBAL';
    } else {
        // Use financial year for all YEARLY resets to stay consistent with UI
        counterKey = settings.financialYear;
    }

    let sequence;
    let counterDoc;

    // 3. Counter Operations
    if (increment) {
        // Atomic Upsert + Increment
        // We want to initialize to (startFrom - 1) so first increment hits startFrom.
        const startVal = docType.startFrom;

        counterDoc = await DocumentCounter.findOneAndUpdate(
            {
                companyId: tenantId,
                documentType: key,
                financialYear: counterKey
            },
            {
                $inc: { lastNumber: 1 }
            },
            {
                new: true,
                upsert: true
            }
        );

        // Check for Start From catch-up (Lazy Init)
        // If the incremented value is less than startFrom, jump to startFrom.
        // This handles the first run case where DB was 0 (or missing) -> 1, but we want 1000.
        if (counterDoc.lastNumber < docType.startFrom) {
            // Atomic update to jump forward only if still lagging
            counterDoc = await DocumentCounter.findOneAndUpdate(
                {
                    companyId: tenantId,
                    documentType: key,
                    financialYear: counterKey,
                    lastNumber: { $lt: docType.startFrom }
                },
                { $set: { lastNumber: docType.startFrom } },
                { new: true }
            ) || counterDoc; // If update failed (race), use existing (means someone else updated or we are fine)
        }
        sequence = counterDoc.lastNumber;
    } else {
        // Preview Read
        counterDoc = await DocumentCounter.findOne({
            companyId: tenantId,
            documentType: key,
            financialYear: counterKey
        });

        const last = counterDoc ? counterDoc.lastNumber : (docType.startFrom - 1);
        sequence = last + 1;
    }

    // 4. Token Replacements
    const padding = docType.paddingDigits || 4;
    const seqStr = String(sequence).padStart(padding, '0');

    const replacements = {
        '{{COMPANY}}': settings.companyCode || 'COMP',
        '{{BRANCH}}': settings.branchCode || 'BR',
        '{{DEPT}}': extraReplacements['{{DEPT}}'] || settings.departmentCode || 'GEN',
        '{{PREFIX}}': docType.prefix || key,
        '{{YEAR}}': settings.financialYear || String(new Date().getFullYear()),
        '{{MONTH}}': new Date().toLocaleString('default', { month: '2-digit' }),
        '{{COUNTER}}': seqStr,
        ...extraReplacements
    };

    let generatedId = docType.formatTemplate;
    Object.keys(replacements).forEach(token => {
        generatedId = generatedId.split(token).join(replacements[token]);
    });

    // Cleanup double separators if tokens are empty
    // (e.g. if DEPT is empty, GTPL//POS... -> GTPL/POS...)
    const sep = docType.separator || '/';
    // regex to replace multiple separators
    generatedId = generatedId.replace(new RegExp(`\\${sep}+`, 'g'), sep);

    return {
        id: generatedId,
        sequence: sequence,
        docTypeId: docType._id,
        generationMode: docType.generationMode || 'AUTO'
    };
};

exports.getNextId = async (req, res) => {
    try {
        const { entityType, increment, extraReplacements } = req.body;
        
        // Map legacy entityType to new keys
        const key = LEGACY_MAP[entityType] || entityType;

        const result = await exports.generateIdInternal({
            tenantId: req.tenantId,
            entityType: key,
            increment: increment === true || increment === 'true',
            extraReplacements
        });

        res.json({
            success: true,
            data: result,
            nextId: result.id
        });
    } catch (error) {
        console.error("ID Gen Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
