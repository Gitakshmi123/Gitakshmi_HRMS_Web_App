/**
 * ═══════════════════════════════════════════════════════════════════════
 * RESPONSE SHAPING MIDDLEWARE
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Automatically filters API responses based on user role.
 * Ensures IDs are only shown when appropriate.
 * 
 * Core Philosophy:
 * - IDs are backend control entities
 * - UI shows IDs only where legally/operationally required
 * - MongoDB ObjectIds are NEVER exposed
 * 
 * @version 2.0
 */

/**
 * Role-based ID visibility permissions
 */
const ROLE_PERMISSIONS = {
    candidate: {
        showIds: ['employeeId', 'offerId', 'payslipId'],
        hideIds: ['_id', '__v', 'jobOpeningId', 'applicationId', 'interviewId', 'candidateId', 'tenant']
    },
    employee: {
        showIds: ['employeeId', 'offerId', 'payslipId'],
        hideIds: ['_id', '__v', 'jobOpeningId', 'applicationId', 'interviewId', 'candidateId', 'tenant']
    },
    hr: {
        showIds: ['jobOpeningId', 'candidateId', 'applicationId', 'offerId', 'employeeId', 'payslipId'],
        hideIds: ['_id', '__v', 'interviewId', 'tenant'] // Interview ID never shown
    },
    manager: {
        showIds: ['employeeId', 'payslipId'],
        hideIds: ['_id', '__v', 'jobOpeningId', 'applicationId', 'interviewId', 'candidateId', 'tenant']
    },
    admin: {
        showIds: ['jobOpeningId', 'candidateId', 'applicationId', 'offerId', 'employeeId', 'payslipId'],
        hideIds: ['_id', '__v', 'interviewId', 'tenant']
    },
    psa: {
        showIds: ['jobOpeningId', 'candidateId', 'applicationId', 'offerId', 'employeeId', 'payslipId'],
        hideIds: ['_id', '__v', 'tenant']
    }
};

/**
 * Fields that should always be included in responses
 */
const ALWAYS_INCLUDE_FIELDS = [
    // Display fields
    'title', 'name', 'status', 'createdAt', 'updatedAt',
    'jobTitle', 'department', 'designation', 'email', 'mobile',
    'firstName', 'lastName', 'contactNo',

    // Date/Time fields
    'date', 'time', 'joiningDate', 'validUntil',

    // Location fields
    'mode', 'location', 'address',

    // Status fields
    'offerStatus', 'isActive', 'isExpired',

    // Numeric fields
    'ctc', 'grossSalary', 'netSalary', 'round', 'count',

    // Messages
    'statusMessage', 'offerMessage', 'message'
];

/**
 * Shape single object based on permissions
 */
function shapeObject(obj, permissions, context) {
    if (!obj || typeof obj !== 'object') return obj;

    const shaped = {};

    // Always include display fields
    ALWAYS_INCLUDE_FIELDS.forEach(field => {
        if (obj[field] !== undefined) {
            shaped[field] = obj[field];
        }
    });

    // Add allowed IDs
    permissions.showIds.forEach(idField => {
        if (obj[idField]) {
            shaped[idField] = obj[idField];
        }
    });

    // Add nested objects (cleaned)
    if (obj.candidateInfo) {
        shaped.candidateInfo = shapeNestedObject(obj.candidateInfo, permissions);
    }

    if (obj.jobDetails) {
        shaped.jobDetails = shapeNestedObject(obj.jobDetails, permissions);
    }

    if (obj.salarySnapshot) {
        shaped.salarySnapshot = shapeNestedObject(obj.salarySnapshot, permissions);
    }

    // Add arrays (cleaned)
    if (obj.interviews && Array.isArray(obj.interviews)) {
        shaped.interviews = obj.interviews.map(interview =>
            shapeNestedObject(interview, permissions)
        );
    }

    if (obj.statusHistory && Array.isArray(obj.statusHistory)) {
        shaped.statusHistory = obj.statusHistory.map(history =>
            shapeNestedObject(history, permissions)
        );
    }

    if (obj.reviews && Array.isArray(obj.reviews)) {
        shaped.reviews = obj.reviews.map(review =>
            shapeNestedObject(review, permissions)
        );
    }

    if (obj.earnings && Array.isArray(obj.earnings)) {
        shaped.earnings = obj.earnings;
    }

    if (obj.deductions && Array.isArray(obj.deductions)) {
        shaped.deductions = obj.deductions;
    }

    if (obj.employerContributions && Array.isArray(obj.employerContributions)) {
        shaped.employerContributions = obj.employerContributions;
    }

    if (obj.benefits && Array.isArray(obj.benefits)) {
        shaped.benefits = obj.benefits;
    }

    if (obj.specialTerms && Array.isArray(obj.specialTerms)) {
        shaped.specialTerms = obj.specialTerms;
    }

    if (obj.notes && Array.isArray(obj.notes)) {
        shaped.notes = obj.notes.map(note => shapeNestedObject(note, permissions));
    }

    // For detail view, include more fields
    if (context === 'detail') {
        const detailFields = [
            'probationPeriod', 'noticePeriod', 'workingDays', 'workingHours',
            'sentDate', 'acceptedDate', 'rejectedDate', 'withdrawnDate',
            'rejectionReason', 'withdrawalReason', 'acceptanceNotes',
            'overallScore', 'priority', 'source', 'tags',
            'currentInterviewRound', 'totalInterviewRounds',
            'offerLetterPath', 'joiningLetterPath', 'resume'
        ];

        detailFields.forEach(field => {
            if (obj[field] !== undefined) {
                shaped[field] = obj[field];
            }
        });
    }

    return shaped;
}

/**
 * Shape nested object (remove IDs)
 */
function shapeNestedObject(obj, permissions) {
    if (!obj || typeof obj !== 'object') return obj;

    const shaped = { ...obj };

    // Remove all hidden IDs
    permissions.hideIds.forEach(idField => {
        delete shaped[idField];
    });

    // Always remove MongoDB fields
    delete shaped._id;
    delete shaped.__v;

    return shaped;
}

/**
 * Shape response based on user role and context
 */
function shapeResponse(data, userRole, context = 'list') {
    if (!data) return data;

    const permissions = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.candidate;

    // Handle arrays
    if (Array.isArray(data)) {
        return data.map(item => shapeObject(item, permissions, context));
    }

    // Handle single object
    return shapeObject(data, permissions, context);
}

/**
 * Express middleware wrapper
 * 
 * Usage:
 * router.get('/applications', responseShaper('list'), controller.getApplications);
 * router.get('/applications/:id', responseShaper('detail'), controller.getApplicationDetail);
 */
function responseShaper(context = 'list') {
    return (req, res, next) => {
        // Store original json method
        const originalJson = res.json.bind(res);

        // Override json method
        res.json = function (data) {
            const userRole = req.user?.role || 'candidate';

            // Shape the data if it exists
            if (data && data.data) {
                data.data = shapeResponse(data.data, userRole, context);
            } else if (data && !data.success && !data.error) {
                // If data is not wrapped, shape it directly
                data = shapeResponse(data, userRole, context);
            }

            // Call original json with shaped data
            return originalJson(data);
        };

        next();
    };
}

/**
 * Manual shaping function for use in controllers
 * 
 * Usage:
 * const shaped = shapeResponse(applications, req.user.role, 'list');
 * res.json({ success: true, data: shaped });
 */
module.exports = {
    shapeResponse,
    responseShaper,
    ROLE_PERMISSIONS,
    ALWAYS_INCLUDE_FIELDS
};
