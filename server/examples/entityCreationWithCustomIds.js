/**
 * ═══════════════════════════════════════════════════════════════════════
 * EXAMPLE: ENTITY CREATION WITH CUSTOM ID GENERATION
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * This file shows how to integrate custom ID generation into your
 * existing entity creation controllers.
 * 
 * @version 3.0
 */

const {
    generateJobId,
    generateCandidateId,
    generateApplicationId,
    generateOfferId,
    generateEmployeeId,
    generatePayslipId
} = require('../services/idGenerator.service');

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 1: CREATE JOB
// ═══════════════════════════════════════════════════════════════════

/**
 * Create new job with auto-generated ID
 */
exports.createJob = async (req, res) => {
    try {
        const companyId = req.tenantId || req.user.tenantId;
        const { title, department, description, ...otherFields } = req.body;

        // ✅ GENERATE CUSTOM ID
        const jobId = await generateJobId(companyId);

        // Create job with generated ID
        const job = new Job({
            jobId,  // ← Custom ID (e.g., JOB-2026-0001)
            companyId,
            title,
            department,
            description,
            ...otherFields,
            createdBy: req.user.email
        });

        await job.save();

        res.status(201).json({
            success: true,
            message: 'Job created successfully',
            data: job
        });

    } catch (error) {
        console.error('Create Job Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create job',
            error: error.message
        });
    }
};

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 2: CREATE CANDIDATE
// ═══════════════════════════════════════════════════════════════════

/**
 * Create new candidate with auto-generated ID
 */
exports.createCandidate = async (req, res) => {
    try {
        const companyId = req.tenantId || req.user.tenantId;
        const { name, email, mobile, ...otherFields } = req.body;

        // ✅ GENERATE CUSTOM ID
        const candidateId = await generateCandidateId(companyId);

        const candidate = new Candidate({
            candidateId,  // ← Custom ID (e.g., CAN-2026-0042)
            companyId,
            name,
            email,
            mobile,
            ...otherFields
        });

        await candidate.save();

        res.status(201).json({
            success: true,
            message: 'Candidate created successfully',
            data: candidate
        });

    } catch (error) {
        console.error('Create Candidate Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create candidate',
            error: error.message
        });
    }
};

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 3: CREATE APPLICATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Create new application with auto-generated ID
 */
exports.createApplication = async (req, res) => {
    try {
        const companyId = req.tenantId || req.user.tenantId;
        const { jobId, candidateId, ...otherFields } = req.body;

        // ✅ GENERATE CUSTOM ID
        const applicationId = await generateApplicationId(companyId);

        const application = new Application({
            applicationId,  // ← Custom ID (e.g., APP-2026-0123)
            companyId,
            jobId,
            candidateId,
            status: 'APPLIED',
            ...otherFields,
            appliedDate: new Date()
        });

        await application.save();

        res.status(201).json({
            success: true,
            message: 'Application created successfully',
            data: application
        });

    } catch (error) {
        console.error('Create Application Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create application',
            error: error.message
        });
    }
};

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 4: CREATE OFFER
// ═══════════════════════════════════════════════════════════════════

/**
 * Create new offer with auto-generated ID
 */
exports.createOffer = async (req, res) => {
    try {
        const companyId = req.tenantId || req.user.tenantId;
        const { applicationId, candidateId, salary, joiningDate, ...otherFields } = req.body;

        // ✅ GENERATE CUSTOM ID
        const offerId = await generateOfferId(companyId);

        const offer = new Offer({
            offerId,  // ← Custom ID (e.g., OFF-2026-0015)
            companyId,
            applicationId,
            candidateId,
            salary,
            joiningDate,
            status: 'DRAFT',
            ...otherFields,
            createdDate: new Date()
        });

        await offer.save();

        res.status(201).json({
            success: true,
            message: 'Offer created successfully',
            data: offer
        });

    } catch (error) {
        console.error('Create Offer Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create offer',
            error: error.message
        });
    }
};

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 5: CREATE EMPLOYEE (with Department)
// ═══════════════════════════════════════════════════════════════════

/**
 * Create new employee with auto-generated ID
 */
exports.createEmployee = async (req, res) => {
    try {
        const companyId = req.tenantId || req.user.tenantId;
        const { name, email, department, departmentCode, ...otherFields } = req.body;

        // ✅ GENERATE CUSTOM ID WITH DEPARTMENT CODE
        const employeeId = await generateEmployeeId(companyId, departmentCode || department);

        const employee = new Employee({
            employeeId,  // ← Custom ID (e.g., EMP-IT-0001)
            companyId,
            name,
            email,
            department,
            departmentCode,
            status: 'ACTIVE',
            ...otherFields,
            joiningDate: new Date()
        });

        await employee.save();

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            data: employee
        });

    } catch (error) {
        console.error('Create Employee Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create employee',
            error: error.message
        });
    }
};

// ═══════════════════════════════════════════════════════════════════
// EXAMPLE 6: CREATE PAYSLIP
// ═══════════════════════════════════════════════════════════════════

/**
 * Create new payslip with auto-generated ID
 */
exports.createPayslip = async (req, res) => {
    try {
        const companyId = req.tenantId || req.user.tenantId;
        const { employeeId, month, year, salary, ...otherFields } = req.body;

        // ✅ GENERATE CUSTOM ID
        const payslipId = await generatePayslipId(companyId);

        const payslip = new Payslip({
            payslipId,  // ← Custom ID (e.g., PAY-202601-0001)
            companyId,
            employeeId,
            month,
            year,
            salary,
            status: 'GENERATED',
            ...otherFields,
            generatedDate: new Date()
        });

        await payslip.save();

        res.status(201).json({
            success: true,
            message: 'Payslip created successfully',
            data: payslip
        });

    } catch (error) {
        console.error('Create Payslip Error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create payslip',
            error: error.message
        });
    }
};

// ═══════════════════════════════════════════════════════════════════
// IMPORTANT NOTES
// ═══════════════════════════════════════════════════════════════════

/**
 * ✅ DO's:
 * 
 * 1. ALWAYS generate ID on backend before creating entity
 * 2. Use appropriate generator function for each entity type
 * 3. Pass departmentCode for Employee IDs
 * 4. Handle errors from ID generation
 * 5. Use transactions for critical operations
 * 
 * ❌ DON'Ts:
 * 
 * 1. NEVER accept ID from frontend
 * 2. NEVER allow manual ID editing
 * 3. NEVER skip ID generation
 * 4. NEVER modify generated IDs
 * 5. NEVER bypass the ID generator service
 * 
 * 📋 FRONTEND RULES:
 * 
 * 1. Frontend NEVER sends ID in request body
 * 2. Frontend receives ID in response
 * 3. Frontend displays ID as read-only
 * 4. Frontend uses ID for reference only
 */

module.exports = exports;
