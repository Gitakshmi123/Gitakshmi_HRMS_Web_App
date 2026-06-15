/**
 * ═══════════════════════════════════════════════════════════════════════
 * ID VALIDATION MIDDLEWARE
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Prevents ID tampering and validates ID formats.
 * Ensures security by blocking invalid or malicious ID patterns.
 * 
 * @version 2.0
 */

/**
 * ID format patterns
 */
const ID_PATTERNS = {
    jobOpeningId: /^JOB-\d{4}-\d{4}$/,
    applicationId: /^APP-\d{4}-\d{4}$/,
    interviewId: /^INT-\d{4}-\d{4}$/,
    offerId: /^OFF-\d{4}-\d{4}$/,
    candidateId: /^CAN-\d{4}-\d{4}$/,
    employeeId: /^EMP-[A-Z0-9]+-\d{4}$/,
    payslipId: /^PAY-\d{6}-\d{4}$/
};

/**
 * MongoDB ObjectId pattern (to detect and block)
 */
const MONGODB_OBJECTID_PATTERN = /^[0-9a-fA-F]{24}$/;

/**
 * Validate ID format in route parameters
 */
function validateIdFormat(req, res, next) {
    const params = req.params;
    const errors = [];

    // Check each parameter against its pattern
    Object.keys(params).forEach(paramName => {
        const paramValue = params[paramName];

        // Check if it's an ID field
        if (paramName.endsWith('Id') && ID_PATTERNS[paramName]) {
            const pattern = ID_PATTERNS[paramName];

            if (!pattern.test(paramValue)) {
                errors.push({
                    field: paramName,
                    value: paramValue,
                    expected: pattern.toString()
                });
            }
        }

        // Block MongoDB ObjectIds
        if (MONGODB_OBJECTID_PATTERN.test(paramValue)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid ID format. MongoDB ObjectIds are not allowed.',
                code: 'MONGODB_OBJECTID_NOT_ALLOWED'
            });
        }
    });

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format',
            code: 'INVALID_ID_FORMAT',
            errors: errors
        });
    }

    next();
}

/**
 * Sanitize request body to prevent ID tampering
 */
function sanitizeRequestBody(req, res, next) {
    if (!req.body) {
        return next();
    }

    const body = req.body;
    const warnings = [];

    // Remove MongoDB internal fields
    const internalFields = ['_id', '__v', 'tenant'];
    internalFields.forEach(field => {
        if (body[field]) {
            delete body[field];
            warnings.push(`Removed internal field: ${field}`);
        }
    });

    // Check for MongoDB ObjectId patterns in values
    Object.keys(body).forEach(key => {
        const value = body[key];

        if (typeof value === 'string' && MONGODB_OBJECTID_PATTERN.test(value)) {
            // Check if it's a legitimate reference field
            const legitimateRefFields = ['jobId', 'candidateId', 'applicationId', 'offerId', 'employeeId'];

            if (!legitimateRefFields.includes(key)) {
                console.warn(`⚠️ Suspicious ObjectId in request body: ${key} = ${value}`);
                warnings.push(`Suspicious ObjectId detected in field: ${key}`);
            }
        }
    });

    // Log warnings if any
    if (warnings.length > 0 && process.env.NODE_ENV !== 'production') {
        console.log('Request sanitization warnings:', warnings);
    }

    next();
}

/**
 * Prevent ID modification in update requests
 */
function preventIdModification(req, res, next) {
    if (!req.body) {
        return next();
    }

    // List of ID fields that should never be modified
    const immutableIds = [
        'jobOpeningId',
        'applicationId',
        'interviewId',
        'offerId',
        'candidateId',
        'employeeId',
        'payslipId',
        '_id',
        'tenant'
    ];

    const attemptedChanges = [];

    immutableIds.forEach(idField => {
        if (req.body[idField]) {
            attemptedChanges.push(idField);
            delete req.body[idField];
        }
    });

    if (attemptedChanges.length > 0) {
        console.warn(`⚠️ Attempted to modify immutable IDs: ${attemptedChanges.join(', ')}`);

        // In strict mode, reject the request
        if (process.env.STRICT_ID_VALIDATION === 'true') {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify immutable ID fields',
                code: 'IMMUTABLE_ID_MODIFICATION',
                fields: attemptedChanges
            });
        }
    }

    next();
}

/**
 * Validate ID exists in database (for critical operations)
 */
function validateIdExists(idField, model) {
    return async (req, res, next) => {
        try {
            const idValue = req.params[idField];

            if (!idValue) {
                return res.status(400).json({
                    success: false,
                    message: `${idField} is required`,
                    code: 'MISSING_ID'
                });
            }

            const { db, tenantId } = req;
            const Model = db.models[model] || db.model(model, require(`../models/${model}`));

            const exists = await Model.findOne({
                [idField]: idValue,
                tenant: tenantId
            });

            if (!exists) {
                return res.status(404).json({
                    success: false,
                    message: `${model} not found with ${idField}: ${idValue}`,
                    code: 'RESOURCE_NOT_FOUND'
                });
            }

            // Attach to request for use in controller
            req.validated = req.validated || {};
            req.validated[idField] = exists;

            next();

        } catch (error) {
            console.error('ID validation error:', error);
            res.status(500).json({
                success: false,
                message: 'ID validation failed',
                error: error.message
            });
        }
    };
}

/**
 * Combined validation middleware
 */
function validateIds(options = {}) {
    return [
        validateIdFormat,
        sanitizeRequestBody,
        ...(options.preventModification ? [preventIdModification] : [])
    ];
}

module.exports = {
    validateIdFormat,
    sanitizeRequestBody,
    preventIdModification,
    validateIdExists,
    validateIds,
    ID_PATTERNS,
    MONGODB_OBJECTID_PATTERN
};
