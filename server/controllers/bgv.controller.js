const { getBGVModels } = require('../utils/bgvModels');
const { createBGVCaseWithUniqueId } = require('../utils/bgvCaseId');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// OCR Services
const BGVOCREngine = require('../services/BGVOCREngine');
const BGVDocumentParser = require('../services/BGVDocumentParser');
const BGVOCRValidator = require('../services/BGVOCRValidator');

/**
 * BGV Package Definitions
 */
const BGV_PACKAGES = {
    BASIC: ['IDENTITY', 'ADDRESS', 'EMPLOYMENT'],
    STANDARD: ['IDENTITY', 'ADDRESS', 'EMPLOYMENT', 'EDUCATION', 'CRIMINAL'],
    PREMIUM: ['IDENTITY', 'ADDRESS', 'EMPLOYMENT', 'EDUCATION', 'CRIMINAL', 'SOCIAL_MEDIA', 'REFERENCE']
};

/**
 * Helper: Create timeline entry
 */
async function createTimelineEntry(BGVTimeline, data) {
    try {
        await BGVTimeline.create(data);
    } catch (err) {
        console.error('[BGV_TIMELINE_ERROR]', err);
    }
}

/**
 * Helper: Add log to case
 */
function addCaseLog(bgvCase, action, user, req, oldStatus = null, newStatus = null, remarks = '') {
    bgvCase.logs.push({
        action,
        performedBy: user?.name || user?.email || 'System',
        performedById: user?._id || user?.id || null,
        oldStatus,
        newStatus,
        remarks,
        ip: req?.ip || null,
        userAgent: req?.get('user-agent') || null,
        timestamp: new Date()
    });
}

/**
 * STEP 2: HR Initiates BGV
 * POST /api/bgv/initiate
 * 
 * Returns:
 *  - 201: BGV case created successfully
 *  - 409: BGV case already exists for this candidate
 *  - 400: Bad request (missing required fields)
 *  - 500: Server error
 */
exports.initiateBGV = async (req, res, next) => {
    try {
        let { applicationId, employeeId, candidateId, package: selectedPackage, slaDays } = req.body;

        // console.log('[BGV_INITIATE] Request:', { applicationId, employeeId, candidateId, selectedPackage, slaDays });

        const { BGVCase, BGVCheck, BGVTimeline, Applicant, Employee } = await getBGVModels(req);

        // Validate required fields
        if (!applicationId && !employeeId) {
            return res.status(400).json({
                success: false,
                message: "applicationId or employeeId is required"
            });
        }

        let checkTypes = [];
        if (selectedPackage === 'CUSTOM') {
            const applicant = await Applicant.findById(applicationId).populate('requirementId');
            if (applicant?.requirementId?.bgvConfig?.checks?.length > 0) {
                checkTypes = applicant.requirementId.bgvConfig.checks;
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Custom package selected but no checks defined in job requirement"
                });
            }
        } else if (BGV_PACKAGES[selectedPackage]) {
            checkTypes = BGV_PACKAGES[selectedPackage];
        } else {
            return res.status(400).json({
                success: false,
                message: "Valid package (BASIC/STANDARD/PREMIUM/CUSTOM) is required"
            });
        }

        // Handle Applicant logic
        if (applicationId && !candidateId) {
            const applicant = await Applicant.findById(applicationId).select('candidateId');
            if (applicant) {
                candidateId = applicant.candidateId;
            }
        }

        // Ensure tenantId is ObjectId for consistent querying
        const tenantId = new mongoose.Types.ObjectId(req.tenantId);

        // Check if BGV case ALREADY EXISTS for this candidate/employee
        // Primary check: by candidateId if available
        let existingCase = null;

        if (candidateId) {
            existingCase = await BGVCase.findOne({
                candidateId,
                tenant: tenantId,
                isClosed: false  // Don't block if previous case is closed
            }).lean();
        }

        // Secondary check: by applicationId if no candidateId match
        if (!existingCase && applicationId) {
            existingCase = await BGVCase.findOne({
                applicationId,
                tenant: tenantId,
                isClosed: false  // Don't block if previous case is closed
            }).lean();
        }

        // Secondary check: by employeeId if neither candidateId nor applicationId match
        if (!existingCase && employeeId) {
            existingCase = await BGVCase.findOne({
                employeeId,
                tenant: tenantId,
                isClosed: false  // Don't block if previous case is closed
            }).lean();
        }

        // If active BGV case exists, return 409 Conflict
        if (existingCase) {
            return res.status(409).json({
                success: false,
                message: `BGV already initiated for this candidate. Case ID: ${existingCase.caseId}. Status: ${existingCase.overallStatus}`,
                caseId: existingCase.caseId,
                existingCaseStatus: existingCase.overallStatus,
                action: "BGV_ALREADY_EXISTS"
            });
        }

        // Create BGV Case with proper error handling
        let newCase;
        try {
            newCase = await createBGVCaseWithUniqueId(BGVCase, {
                tenant: tenantId,
                applicationId: applicationId || null,
                employeeId: employeeId || null,
                candidateId: candidateId || null,
                package: selectedPackage,
                initiatedBy: req.user?._id || req.user?.id,
                overallStatus: 'PENDING',
                sla: {
                    targetDays: slaDays || 7
                }
            });
        } catch (err) {
            // Handle duplicate key error (E11000)
            if (err.code === 11000) {
                const field = Object.keys(err.keyPattern)[0];
                console.error(`[BGV_DUPLICATE_ERROR] Duplicate ${field}:`, err.keyValue);
                return res.status(409).json({
                    success: false,
                    message: `BGV case already exists (duplicate ${field})`,
                    field,
                    action: "BGV_ALREADY_EXISTS"
                });
            }
            throw err;
        }

        // console.log('[BGV_CASE_CREATED] Case:', { caseId: newCase.caseId, _id: newCase._id, tenant: newCase.tenant });

        // Add initial log
        addCaseLog(newCase, 'CASE_INITIATED', req.user, req, null, 'PENDING', `BGV ${selectedPackage} package initiated`);
        await newCase.save();

        // STEP 3: Auto-generate checks based on package
        const checksToCreate = checkTypes;
        const checkPromises = checksToCreate.map(checkType => {
            return BGVCheck.create({
                caseId: newCase._id,
                tenant: tenantId,
                type: checkType,
                status: 'NOT_STARTED',
                slaDays: 5
            });
        });

        const createdChecks = await Promise.all(checkPromises);
        // console.log('[BGV_CHECKS_CREATED] Count:', createdChecks.length, 'Types:', checksToCreate);

        // Create timeline entry
        await createTimelineEntry(BGVTimeline, {
            tenant: tenantId,
            caseId: newCase._id,
            eventType: 'CASE_INITIATED',
            title: 'BGV Process Initiated',
            description: `Background verification initiated with ${selectedPackage} package (${checksToCreate.length} checks)`,
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name || req.user?.email,
                userRole: req.user?.role
            },
            newStatus: 'PENDING',
            visibleTo: ['ALL'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        // Initialize Risk Score for the case
        const BGVRiskEngine = require('../services/BGVRiskEngine');
        const { BGVRiskScore } = await getBGVModels(req);

        try {
            await BGVRiskEngine.initializeRiskScore(BGVRiskScore, newCase._id, tenantId);
            // console.log(`[BGV_RISK_INITIALIZED] Case: ${newCase.caseId}`);
        } catch (riskError) {
            console.error('[BGV_RISK_INIT_ERROR]', riskError);
            // Don't fail BGV initiation if risk score init fails
        }

        res.status(201).json({
            success: true,
            message: "BGV initiated successfully",
            data: {
                case: newCase,
                checks: createdChecks,
                checksCount: createdChecks.length
            }
        });

    } catch (err) {
        console.error('[BGV_INITIATE_ERROR]', err);
        next(err);
    }
};

/**
 * Get all BGV cases (HR Dashboard)
 * GET /api/bgv/cases
 */
exports.getAllCases = async (req, res, next) => {
    try {
        const { status, package: pkg, search, page = 1, limit = 20 } = req.query;
        const { BGVCase, BGVCheck } = await getBGVModels(req);

        // Build query
        // Normalize tenantId to ObjectId to avoid cast/mismatch edge-cases
        const tenantId = mongoose.isValidObjectId(req.tenantId)
            ? new mongoose.Types.ObjectId(req.tenantId)
            : req.tenantId;
        const query = { tenant: tenantId };
        if (status) query.overallStatus = status;
        if (pkg) query.package = pkg;

        // Search by case ID or candidate name
        if (search) {
            const { Applicant, Employee } = await getBGVModels(req);
            const applicants = await Applicant.find({ name: { $regex: search, $options: 'i' } }).select('_id');
            const employees = await Employee.find({ 
                $or: [
                    { firstName: { $regex: search, $options: 'i' } }, 
                    { lastName: { $regex: search, $options: 'i' } }
                ] 
            }).select('_id');

            query.$or = [
                { caseId: { $regex: search, $options: 'i' } },
                { applicationId: { $in: applicants.map(a => a._id) } },
                { employeeId: { $in: employees.map(e => e._id) } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const cases = await BGVCase.find(query)
            .populate({
                path: 'applicationId',
                select: 'name email mobile requirementId',
                populate: {
                    path: 'requirementId',
                    select: 'jobOpeningId jobTitle'
                }
            })
            .populate('employeeId', 'firstName lastName email contactNo employeeId')
            .populate('candidateId', 'name email mobile')
            .populate('initiatedBy', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await BGVCase.countDocuments(query);

        // Attach check details
        const casesWithDetails = await Promise.all(cases.map(async (c) => {
            const checks = await BGVCheck.find({ caseId: c._id }).select('type status').lean();
            const verifiedCount = checks.filter(ch => ch.status === 'VERIFIED').length;
            const failedCount = checks.filter(ch => ch.status === 'FAILED').length;

            return {
                ...c,
                candidateName: (c.candidateId && c.candidateId.name) ? c.candidateId.name : (c.employeeId && c.employeeId.firstName ? `${c.employeeId.firstName} ${c.employeeId.lastName}` : (c.applicationId && c.applicationId.name ? c.applicationId.name : "Unknown")),
                candidateEmail: (c.candidateId && c.candidateId.email) || (c.employeeId && c.employeeId.email) || (c.applicationId && c.applicationId.email) || null,
                jobTitle: (c.applicationId && c.applicationId.requirementId && c.applicationId.requirementId.jobTitle) || (c.employeeId ? "Existing Employee" : "N/A"),
                checks,
                checksProgress: {
                    total: checks.length,
                    verified: verifiedCount,
                    failed: failedCount,
                    pending: checks.length - verifiedCount - failedCount,
                    percentage: checks.length > 0 ? Math.round((verifiedCount / checks.length) * 100) : 0
                }
            };
        }));

        res.json({
            success: true,
            data: casesWithDetails,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (err) {
        console.error('[BGV_GET_ALL_ERROR]', err);
        next(err);
    }
};

/**
 * Get single BGV case detail
 * GET /api/bgv/case/:id
 */
exports.getCaseDetail = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { BGVCase, BGVCheck, BGVDocument, BGVTimeline } = await getBGVModels(req);

        const bgvCase = await BGVCase.findById(id)
            .populate({
                path: 'applicationId',
                select: 'name email mobile requirementId',
                populate: {
                    path: 'requirementId',
                    select: 'jobOpeningId jobTitle'
                }
            })
            .populate('employeeId', 'firstName lastName email contactNo employeeId dob permAddress')
            .populate('candidateId', 'name email mobile dob address')
            .populate('initiatedBy', 'name email')
            .populate('closedBy', 'name email')
            .lean();

        if (!bgvCase) {
            return res.status(404).json({ success: false, message: "BGV Case not found" });
        }

        let candidateName = "Unknown";
        let candidateEmail = null;
        let jobTitle = "N/A";

        if (bgvCase.candidateId && typeof bgvCase.candidateId === 'object' && bgvCase.candidateId.name) {
            candidateName = bgvCase.candidateId.name;
            candidateEmail = bgvCase.candidateId.email;
        } else if (bgvCase.employeeId && typeof bgvCase.employeeId === 'object' && bgvCase.employeeId.firstName) {
            candidateName = `${bgvCase.employeeId.firstName} ${bgvCase.employeeId.lastName}`;
            candidateEmail = bgvCase.employeeId.email;
            jobTitle = "Existing Employee";
        } else if (bgvCase.applicationId && typeof bgvCase.applicationId === 'object' && bgvCase.applicationId.name) {
            candidateName = bgvCase.applicationId.name;
            candidateEmail = bgvCase.applicationId.email;
            jobTitle = bgvCase.applicationId.requirementId?.jobTitle || "N/A";
        }

        // Get all checks
        const checks = await BGVCheck.find({ caseId: bgvCase._id })
            .populate('assignedTo', 'name email')
            .lean();

        // Get timeline
        const timeline = await BGVTimeline.find({ caseId: bgvCase._id })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();

        // Get documents
        const documents = await BGVDocument.find({ caseId: bgvCase._id, isDeleted: false })
            .sort({ uploadedAt: -1 })
            .lean();

        res.json({
            success: true,
            data: {
                ...bgvCase,
                candidateName: candidateName,
                candidateEmail: candidateEmail,
                jobTitle: jobTitle,
                checks,
                timeline,
                documents
            }
        });
    } catch (err) {
        console.error('[BGV_GET_DETAIL_ERROR]', err);
        next(err);
    }
};

/**
 * STEP 1: Candidate uploads documents
 * POST /api/bgv/case/:caseId/upload-document
 */
exports.uploadDocument = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { documentType, checkType } = req.body;
        const { BGVCase, BGVCheck, BGVDocument, BGVTimeline } = await getBGVModels(req);

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        // Verify case exists and populate candidate for OCR comparison
        const bgvCase = await BGVCase.findById(caseId).populate('candidateId');
        if (!bgvCase) {
            return res.status(404).json({ success: false, message: "BGV Case not found" });
        }

        // Check if case is closed
        if (bgvCase.isClosed) {
            return res.status(400).json({ success: false, message: "Cannot upload documents to a closed BGV case" });
        }

        // Cloudinary: Upload BGV document
        const CloudinaryService = require("../services/CloudinaryService");
        let finalPath = req.file.path;
        let relativeUrl = `/uploads/${req.file.filename}`; // Fallback local
        let isCloud = false;

        if (CloudinaryService.isConfigured()) {
            try {
                const cloudRes = await CloudinaryService.uploadFile(
                    req.file.path,
                    `hrms/${req.tenantId}/bgv/${caseId}`,
                    false // Don't delete yet, OCR needs it locally
                );
                relativeUrl = cloudRes.url;
                isCloud = true;
                // console.log(`✅ [BGV_CONTROLLER] Cloud upload success: ${relativeUrl}`);
            } catch (err) {
                console.warn("⚠️ [BGV_CONTROLLER] Cloudinary failed, falling back to local:", err.message);
            }
        }

        if (!isCloud) {
            // Move file to tenant directory (Legacy Local Logic)
            const tenantIdStr = req.tenantId.toString();
            const bgvDir = path.join(__dirname, '..', 'uploads', tenantIdStr, 'bgv', caseId.toString());

            if (!fs.existsSync(bgvDir)) {
                fs.mkdirSync(bgvDir, { recursive: true });
            }

            const ext = path.extname(req.file.originalname);
            const filename = `${documentType}_${Date.now()}${ext}`;
            finalPath = path.join(bgvDir, filename);
            relativeUrl = `/uploads/${tenantIdStr}/bgv/${caseId}/${filename}`;

            fs.renameSync(req.file.path, finalPath);
        } else {
            finalPath = req.file.path; // Use temp path for OCR
        }

        // Find related check
        let checkId = null;
        if (checkType) {
            const check = await BGVCheck.findOne({ caseId, type: checkType });
            if (check) {
                checkId = check._id;

                // Update check status to PENDING if NOT_STARTED
                if (check.status === 'NOT_STARTED') {
                    check.status = 'PENDING';
                    await check.save();
                }
            }
        }

        // Get version number
        const existingDocs = await BGVDocument.find({
            caseId,
            documentType,
            isDeleted: false
        });
        const version = existingDocs.length + 1;

        // 🔐 Generate document hash for integrity verification
        const BGVEvidenceValidator = require('../services/BGVEvidenceValidator');
        let documentHash = null;
        try {
            documentHash = await BGVEvidenceValidator.generateDocumentHash(finalPath);
        } catch (hashError) {
            console.error('[BGV_HASH_GENERATION_ERROR]', hashError);
        }

        // Create document record
        const document = await BGVDocument.create({
            tenant: req.tenantId,
            caseId,
            checkId,
            candidateId: bgvCase.candidateId,
            documentType,
            fileName: path.basename(finalPath),
            originalName: req.file.originalname,
            filePath: relativeUrl,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            version,
            documentHash, // 🔐 Store hash for tamper detection
            hashAlgorithm: 'SHA256',
            hashGeneratedAt: new Date(),
            uploadedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name || req.user?.email,
                userRole: req.user?.role
            }
        });

        // 🔍 STEP 2: Trigger Intelligent OCR Processing (Asynchronous)
        // We'll run this in "background" so the upload doesn't feel slow
        // but for this implementation we'll handle it and update the doc
        const processOCR = async (docId, filePath, mime, type, candidateData) => {
            try {
                const { BGVDocument } = await getBGVModels(req);
                await BGVDocument.findByIdAndUpdate(docId, {
                    'evidenceMetadata.ocrStatus': 'PROCESSING'
                });

                // 1. Extract raw text
                const absolutePath = path.join(__dirname, '..', filePath);
                const extraction = await BGVOCREngine.extractText(absolutePath, mime);

                // 2. Parse structured data
                const extractedFields = BGVDocumentParser.parse(extraction.text, type);

                // 3. Run validation against profile
                const validation = BGVOCRValidator.validate(extractedFields, candidateData, type);

                // 4. Update document with results
                await BGVDocument.findByIdAndUpdate(docId, {
                    'evidenceMetadata.extractedText': extraction.text,
                    'evidenceMetadata.ocrConfidence': extraction.confidence,
                    'evidenceMetadata.ocrStatus': 'COMPLETED',
                    'evidenceMetadata.processedAt': new Date(),
                    'evidenceMetadata.extractedFields': extractedFields,
                    'evidenceMetadata.validation': {
                        status: validation.status,
                        score: validation.score,
                        mismatchedFields: validation.mismatchedFields,
                        lastValidatedAt: new Date()
                    },
                    'evidenceMetadata.validationFlags': validation.flags
                });

                // console.log(`[BGV_OCR_COMPLETE] Document ${docId} processed with status: ${validation.status}`);

                // Cleanup local temp file if cloud was used
                if (isCloud && fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch (e) { }
                }
            } catch (ocrError) {
                console.error(`[BGV_OCR_FAILED] Document ${docId}:`, ocrError);
                await BGVDocument.findByIdAndUpdate(docId, {
                    'evidenceMetadata.ocrStatus': 'FAILED'
                });
                // Cleanup local temp file even on failure if cloud was used
                if (isCloud && fs.existsSync(filePath)) {
                    try { fs.unlinkSync(filePath); } catch (e) { }
                }
            }
        };

        // Trigger OCR process
        const candidateData = bgvCase.candidateId; // Populated in getBGVModels or earlier
        processOCR(document._id, relativeUrl, req.file.mimetype, documentType, candidateData);

        // 🔐 Update check evidence status after document upload
        if (checkId) {
            try {
                const { BGVEvidenceConfig } = await getBGVModels(req);
                const check = await BGVCheck.findById(checkId);

                if (check) {
                    // Get all documents for this check
                    const allCheckDocs = await BGVDocument.find({
                        checkId: check._id,
                        isDeleted: false
                    });

                    // Get evidence configuration
                    let evidenceConfig = await BGVEvidenceConfig.findOne({
                        tenant: req.tenantId,
                        checkType: check.type,
                        isActive: true
                    });

                    // Validate evidence
                    const validationResult = await BGVEvidenceValidator.validateCheckEvidence(
                        check,
                        allCheckDocs,
                        evidenceConfig
                    );

                    // Update check with evidence status
                    check.evidenceStatus = {
                        hasRequiredEvidence: validationResult.hasRequiredEvidence,
                        evidenceCompleteness: validationResult.evidenceCompleteness,
                        requiredDocumentTypes: validationResult.requiredDocumentTypes,
                        uploadedDocumentTypes: validationResult.uploadedDocumentTypes,
                        missingDocumentTypes: validationResult.missingDocuments,
                        lastEvidenceCheck: new Date()
                    };

                    check.evidenceValidation = {
                        isValid: validationResult.isValid,
                        validationErrors: validationResult.validationErrors,
                        validationWarnings: validationResult.validationWarnings,
                        lastValidatedAt: new Date()
                    };

                    // Update check status based on evidence
                    if (check.status === 'NOT_STARTED') {
                        check.status = 'DOCUMENTS_PENDING';
                    }

                    if (validationResult.hasRequiredEvidence && check.status === 'DOCUMENTS_PENDING') {
                        check.status = 'DOCUMENTS_UPLOADED';
                        check.verificationWorkflow = check.verificationWorkflow || {};
                        check.verificationWorkflow.workflowStatus = 'READY_FOR_VERIFICATION';
                    }

                    await check.save();
                }
            } catch (evidenceError) {
                console.error('[BGV_EVIDENCE_UPDATE_ERROR]', evidenceError);
                // Don't fail upload if evidence update fails
            }
        }

        // Create timeline entry
        await createTimelineEntry(BGVTimeline, {
            tenant: req.tenantId,
            caseId,
            checkId,
            eventType: 'DOCUMENT_UPLOADED',
            title: 'Document Uploaded',
            description: `${documentType} document uploaded (${req.file.originalname})${documentHash ? ' [Hash: ' + documentHash.substring(0, 8) + '...]' : ''}`,
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name || req.user?.email,
                userRole: req.user?.role
            },
            visibleTo: ['ALL'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata: { documentId: document._id, documentType, version, documentHash }
        });

        res.json({
            success: true,
            message: "Document uploaded successfully",
            data: document
        });


    } catch (err) {
        console.error('[BGV_UPLOAD_DOC_ERROR]', err);
        next(err);
    }
};

/**
 * STEP 4 & 5: Verify individual check
 * POST /api/bgv/check/:checkId/verify
 */
exports.verifyCheck = async (req, res, next) => {
    try {
        const { checkId } = req.params;
        const { status, internalRemarks, verificationMethod } = req.body;
        const { BGVCase, BGVCheck, BGVTimeline } = await getBGVModels(req);

        const check = await BGVCheck.findById(checkId);
        if (!check) {
            return res.status(404).json({ success: false, message: "Check not found" });
        }

        const oldStatus = check.status;
        check.status = status;
        if (internalRemarks) check.internalRemarks = internalRemarks;

        // Add verification details
        check.verificationDetails = {
            verifiedBy: req.user?._id || req.user?.id,
            verifiedAt: new Date(),
            verificationMethod: verificationMethod || 'MANUAL'
        };

        await check.save();

        // Create timeline entry
        await createTimelineEntry(BGVTimeline, {
            tenant: req.tenantId,
            caseId: check.caseId,
            checkId: check._id,
            eventType: status === 'VERIFIED' ? 'CHECK_VERIFIED' : status === 'FAILED' ? 'CHECK_FAILED' : 'CHECK_IN_PROGRESS',
            title: `${check.type} Check ${status}`,
            description: internalRemarks || `Check status updated to ${status}`,
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name || req.user?.email,
                userRole: req.user?.role
            },
            oldStatus,
            newStatus: status,
            visibleTo: status === 'FAILED' ? ['HR', 'ADMIN'] : ['ALL'],
            remarks: internalRemarks,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        // Update overall case status
        const bgvCase = await BGVCase.findById(check.caseId);
        addCaseLog(bgvCase, `CHECK_${status}_${check.type}`, req.user, req, oldStatus, status, internalRemarks);

        // Recalculate overall status
        const allChecks = await BGVCheck.find({ caseId: bgvCase._id });
        let overall = 'IN_PROGRESS';

        const failed = allChecks.some(c => c.status === 'FAILED');
        const allVerified = allChecks.every(c => c.status === 'VERIFIED');
        const hasDiscrepancy = allChecks.some(c => c.status === 'DISCREPANCY');
        const anyRemarks = allChecks.some(c => c.internalRemarks && c.status === 'VERIFIED');

        if (failed) {
            overall = 'FAILED';
        } else if (allVerified && (anyRemarks || hasDiscrepancy)) {
            overall = 'VERIFIED_WITH_DISCREPANCIES';
        } else if (allVerified) {
            overall = 'VERIFIED';
        }

        const oldOverallStatus = bgvCase.overallStatus;
        bgvCase.overallStatus = overall;

        if (['VERIFIED', 'VERIFIED_WITH_DISCREPANCIES', 'FAILED'].includes(overall)) {
            bgvCase.completedAt = new Date();
        }

        await bgvCase.save();

        // Auto-reject applicant if BGV failed
        if (overall === 'FAILED') {
            try {
                const { Applicant } = await getBGVModels(req);
                const applicant = await Applicant.findById(bgvCase.applicationId);
                if (applicant && applicant.status !== 'Rejected') {
                    applicant.status = 'Rejected';
                    applicant.timeline.push({
                        status: 'Rejected',
                        message: 'Candidate rejected due to Failed Background Verification (BGV).',
                        updatedBy: 'System (BGV Auto-Reject)',
                        timestamp: new Date()
                    });
                    await applicant.save();
                    // console.log(`[BGV_AUTO_REJECT] Applicant ${applicant._id} rejected.`);
                }
            } catch (err) {
                console.error('[BGV_AUTO_REJECT_ERROR]', err);
            }
        }

        res.json({
            success: true,
            message: "Check verified successfully",
            data: {
                check,
                overallStatus: overall,
                statusChanged: oldOverallStatus !== overall
            }
        });

    } catch (err) {
        console.error('[BGV_VERIFY_CHECK_ERROR]', err);
        next(err);
    }
};

/**
/**
 * STEP 7: Close & Approve BGV
 * POST /api/bgv/case/:id/close
 * Auto-generates and downloads report
 */
exports.closeBGV = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { decision, remarks } = req.body; // APPROVED, REJECTED, RECHECK_REQUIRED
        const { BGVCase, BGVCheck, BGVReport, BGVTimeline, Applicant } = await getBGVModels(req);
        const BGVReportService = require('../services/BGVReportService');

        const bgvCase = await BGVCase.findById(id);
        if (!bgvCase) {
            return res.status(404).json({ success: false, message: "BGV Case not found" });
        }

        if (bgvCase.isClosed) {
            return res.status(400).json({ success: false, message: "BGV Case is already closed" });
        }

        // Validate decision
        if (!['APPROVED', 'REJECTED', 'RECHECK_REQUIRED'].includes(decision)) {
            return res.status(400).json({ success: false, message: "Invalid decision. Must be APPROVED, REJECTED, or RECHECK_REQUIRED" });
        }

        // Update case using findByIdAndUpdate to bypass pre-save isClosed check
        const oldStatus = bgvCase.overallStatus;
        const updateData = {
            decision,
            decisionBy: req.user?._id || req.user?.id,
            decisionAt: new Date(),
            decisionRemarks: remarks || ''
        };

        if (decision !== 'RECHECK_REQUIRED') {
            updateData.isClosed = true;
            updateData.closedAt = new Date();
            updateData.closedBy = req.user?._id || req.user?.id;
            updateData.overallStatus = 'CLOSED';
            updateData.isImmutable = true;
        }

        // Push log entry to array using $push
        const logEntry = {
            action: 'CASE_CLOSED',
            performedBy: req.user?.name || req.user?.email || 'System',
            performedById: req.user?._id || req.user?.id || null,
            oldStatus,
            newStatus: decision !== 'RECHECK_REQUIRED' ? 'CLOSED' : oldStatus,
            remarks: `BGV closed with decision: ${decision}. ${remarks || ''}`,
            ip: req?.ip || null,
            userAgent: req?.get('user-agent') || null,
            timestamp: new Date()
        };

        const updatedCase = await BGVCase.findByIdAndUpdate(
            id,
            { $set: updateData, $push: { logs: logEntry } },
            { new: true }
        );

        if (!updatedCase) {
            return res.status(500).json({ success: false, message: 'Failed to update BGV case' });
        }

        // Create timeline entry
        await createTimelineEntry(BGVTimeline, {
            tenant: req.tenantId,
            caseId: updatedCase._id,
            eventType: 'CASE_CLOSED',
            title: `BGV Case ${decision}`,
            description: `Background verification closed with decision: ${decision}. ${remarks || ''}`,
            performedBy: {
                userId: req.user?._id || req.user?.id,
                userName: req.user?.name || req.user?.email,
                userRole: req.user?.role
            },
            oldStatus,
            newStatus: 'CLOSED',
            remarks,
            visibleTo: ['HR', 'ADMIN'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        // Update applicant status
        if (decision === 'APPROVED') {
            const applicant = await Applicant.findById(updatedCase.applicationId);
            if (applicant) {
                // Move to onboarding if BGV approved
                applicant.timeline.push({
                    status: 'BGV Cleared',
                    message: 'Background verification completed successfully. Ready for onboarding.',
                    updatedBy: req.user?.name || 'HR',
                    timestamp: new Date()
                });
                await applicant.save();
            }
        } else if (decision === 'REJECTED') {
            const applicant = await Applicant.findById(updatedCase.applicationId);
            if (applicant && applicant.status !== 'Rejected') {
                applicant.status = 'Rejected';
                applicant.timeline.push({
                    status: 'Rejected',
                    message: `Candidate rejected after BGV review. Reason: ${remarks || 'BGV not cleared'}`,
                    updatedBy: req.user?.name || 'HR',
                    timestamp: new Date()
                });
                await applicant.save();
            }
        }

        // Auto-generate report when case is closed
        let reportData = null;
        try {
            // console.log('[BGV_CLOSE] Auto-generating report for case:', updatedCase.caseId);

            // Fetch case with populated fields
            const populatedCase = await BGVCase.findById(id)
                .populate('candidateId', 'name email mobile dob address')
                .populate('applicationId', 'name email');

            const checks = await BGVCheck.find({ caseId: updatedCase._id }).lean();

            // Calculate summary
            const summary = {
                totalChecks: checks.length,
                verifiedChecks: checks.filter(c => c.status === 'VERIFIED').length,
                failedChecks: checks.filter(c => c.status === 'FAILED').length,
                discrepancyChecks: checks.filter(c => c.status === 'DISCREPANCY').length,
                overallDecision: decision,
                riskLevel: decision === 'APPROVED' ? 'LOW' : decision === 'REJECTED' ? 'HIGH' : 'MEDIUM'
            };

            // Generate PDF report
            const reportResult = await BGVReportService.generateBGVReport(
                populatedCase,
                checks,
                summary,
                req.tenantId
            );

            // Create report record in database
            const report = await BGVReport.create({
                tenant: req.tenantId,
                caseId: bgvCase._id,
                reportType: 'FINAL',
                fileName: reportResult.fileName,
                filePath: reportResult.filePath,
                fileFormat: 'PDF',
                summary,
                generatedBy: {
                    userId: req.user?._id || req.user?.id,
                    userName: req.user?.name || req.user?.email
                },
                status: 'GENERATED'
            });

            // Update case with final report
            await BGVCase.findByIdAndUpdate(id, {
                finalReport: {
                    id: report._id,
                    path: reportResult.filePath,
                    fileName: reportResult.fileName,
                    generatedAt: new Date(),
                    generatedBy: req.user?._id || req.user?.id
                }
            });

            // Create timeline entry for report generation
            await createTimelineEntry(BGVTimeline, {
                tenant: req.tenantId,
                caseId: bgvCase._id,
                eventType: 'REPORT_GENERATED',
                title: 'BGV Report Auto-Generated',
                description: 'Final background verification report generated automatically upon case closure',
                performedBy: {
                    userId: req.user?._id || req.user?.id,
                    userName: req.user?.name || req.user?.email,
                    userRole: req.user?.role
                },
                visibleTo: ['HR', 'ADMIN'],
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            reportData = {
                reportId: report._id,
                fileName: reportResult.fileName,
                filePath: reportResult.filePath,
                generatedAt: report.createdAt
            };

            // console.log('[BGV_CLOSE] Report generated successfully:', reportResult.fileName);
        } catch (reportErr) {
            console.error('[BGV_CLOSE] Report generation failed (non-blocking):', reportErr.message);
            // Don't fail the closure if report generation fails
        }

        res.json({
            success: true,
            message: `BGV case ${decision.toLowerCase()} successfully${reportData ? ' and report generated' : ''}`,
            data: {
                caseId: updatedCase._id,
                caseNo: updatedCase.caseId,
                decision,
                closedAt: updatedCase.closedAt,
                report: reportData
            }
        });

    } catch (err) {
        console.error('❌ [BGV_CLOSE_ERROR] Multi-tenant BGV Case Closure Failed:');
        console.error('ID:', req.params.id);
        console.error('Tenant:', req.tenantId);
        console.error('User:', req.user?._id || req.user?.id);
        console.error('Error Details:', err);
        if (err.stack) console.error('Stack Trace:', err.stack);

        // Pass to standard error handler
        next(err);
    }
};

/**
 * Get BGV status for candidate (limited view)
 * GET /api/bgv/candidate/:candidateId
 */
exports.getBGVStatus = async (req, res, next) => {
    try {
        const { candidateId } = req.params;
        const { BGVCase, BGVCheck, BGVTimeline } = await getBGVModels(req);

        const bgvCase = await BGVCase.findOne({ candidateId, tenant: req.tenantId }).lean();
        if (!bgvCase) {
            return res.status(404).json({ success: false, message: "No BGV case found for this candidate" });
        }

        const checks = await BGVCheck.find({ caseId: bgvCase._id })
            .select('-internalRemarks -verificationDetails') // Hide internal data
            .lean();

        // Get candidate-visible timeline only
        const timeline = await BGVTimeline.find({
            caseId: bgvCase._id,
            visibleTo: { $in: ['CANDIDATE', 'ALL'] }
        })
            .sort({ timestamp: -1 })
            .limit(20)
            .lean();

        // Remove sensitive logs
        delete bgvCase.logs;
        delete bgvCase.decisionRemarks;

        res.json({
            success: true,
            data: {
                ...bgvCase,
                checks,
                timeline
            }
        });

    } catch (err) {
        console.error('[BGV_GET_STATUS_ERROR]', err);
        next(err);
    }
};

/**
 * Generate BGV Report (PDF)
 * POST /api/bgv/case/:id/generate-report
 */
exports.generateReport = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { BGVCase, BGVCheck, BGVReport, BGVTimeline } = await getBGVModels(req);
        const BGVReportService = require('../services/BGVReportService');

        const bgvCase = await BGVCase.findById(id)
            .populate('candidateId', 'name email mobile dob address')
            .populate('applicationId', 'name email');

        if (!bgvCase) {
            return res.status(404).json({ success: false, message: "BGV Case not found" });
        }

        const checks = await BGVCheck.find({ caseId: bgvCase._id }).lean();

        // Calculate summary
        const summary = {
            totalChecks: checks.length,
            verifiedChecks: checks.filter(c => c.status === 'VERIFIED').length,
            failedChecks: checks.filter(c => c.status === 'FAILED').length,
            discrepancyChecks: checks.filter(c => c.status === 'DISCREPANCY').length,
            overallDecision: bgvCase.decision,
            riskLevel: bgvCase.decision === 'APPROVED' ? 'LOW' : bgvCase.decision === 'REJECTED' ? 'HIGH' : 'MEDIUM'
        };

        try {
            // Generate PDF report using BGVReportService
            const reportResult = await BGVReportService.generateBGVReport(
                bgvCase,
                checks,
                summary,
                req.tenantId
            );

            // Create report record in database
            const report = await BGVReport.create({
                tenant: req.tenantId,
                caseId: bgvCase._id,
                reportType: 'FINAL',
                fileName: reportResult.fileName,
                filePath: reportResult.filePath,
                fileFormat: 'PDF',
                fileSize: 0, // Will be updated when file is generated
                summary,
                generatedBy: {
                    userId: req.user?._id || req.user?.id,
                    userName: req.user?.name || req.user?.email
                },
                status: 'GENERATED'
            });

            // Update case with final report
            await BGVCase.findByIdAndUpdate(id, {
                finalReport: {
                    id: report._id,
                    path: reportResult.filePath,
                    fileName: reportResult.fileName,
                    generatedAt: new Date(),
                    generatedBy: req.user?._id || req.user?.id
                }
            });

            // Create timeline entry
            await createTimelineEntry(BGVTimeline, {
                tenant: req.tenantId,
                caseId: bgvCase._id,
                eventType: 'REPORT_GENERATED',
                title: 'BGV Report Generated',
                description: 'Final background verification report generated successfully',
                performedBy: {
                    userId: req.user?._id || req.user?.id,
                    userName: req.user?.name || req.user?.email,
                    userRole: req.user?.role
                },
                visibleTo: ['HR', 'ADMIN'],
                ipAddress: req.ip,
                userAgent: req.get('user-agent')
            });

            res.json({
                success: true,
                message: "Report generated successfully",
                data: {
                    reportId: report._id,
                    fileName: reportResult.fileName,
                    filePath: reportResult.filePath,
                    generatedAt: report.createdAt
                }
            });

        } catch (pdfErr) {
            console.error('[BGV_PDF_GENERATION_ERROR]', pdfErr);
            res.status(500).json({
                success: false,
                message: "Failed to generate PDF report",
                error: pdfErr.message
            });
        }

    } catch (err) {
        console.error('[BGV_GENERATE_REPORT_ERROR]', err);
        next(err);
    }
};

/**
 * Get BGV statistics (Dashboard)
 * GET /api/bgv/stats
 */
exports.getStats = async (req, res, next) => {
    try {
        const { BGVCase } = await getBGVModels(req);

        const tenantId = mongoose.isValidObjectId(req.tenantId)
            ? new mongoose.Types.ObjectId(req.tenantId)
            : req.tenantId;

        const stats = await BGVCase.aggregate([
            { $match: { tenant: tenantId } },
            {
                $group: {
                    _id: '$overallStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        const total = await BGVCase.countDocuments({ tenant: tenantId });
        const pending = await BGVCase.countDocuments({ tenant: tenantId, overallStatus: { $in: ['PENDING', 'IN_PROGRESS'] } });
        const verified = await BGVCase.countDocuments({ tenant: tenantId, overallStatus: 'VERIFIED' });
        const failed = await BGVCase.countDocuments({ tenant: tenantId, overallStatus: 'FAILED' });
        const overdue = await BGVCase.countDocuments({ tenant: tenantId, 'sla.isOverdue': true, isClosed: false });

        res.json({
            success: true,
            data: {
                total,
                pending,
                verified,
                failed,
                overdue,
                breakdown: stats
            }
        });

    } catch (err) {
        console.error('[BGV_STATS_ERROR]', err);
        next(err);
    }
};
/**
 * Download BGV Report
 * GET /api/bgv/report/:reportId/download
 */
exports.downloadReport = async (req, res, next) => {
    try {
        const { reportId } = req.params;
        const { BGVReport } = await getBGVModels(req);
        const BGVReportService = require('../services/BGVReportService');

        // Find report record
        const report = await BGVReport.findOne({
            _id: reportId,
            tenant: req.tenantId
        });

        if (!report) {
            return res.status(404).json({ success: false, message: "Report not found" });
        }

        // Get file path
        const filePath = await BGVReportService.getReportFile(report.filePath);

        // Send file
        res.download(filePath, report.fileName, (err) => {
            if (err) {
                console.error('[BGV_DOWNLOAD_ERROR]', err);
            }
        });

    } catch (err) {
        console.error('[BGV_DOWNLOAD_ERROR]', err);
        res.status(500).json({ success: false, message: "Failed to download report", error: err.message });
    }
};

/**
 * Download BGV Report by Case ID
 * GET /api/bgv/case/:caseId/report/download
 */
exports.downloadReportByCase = async (req, res, next) => {
    try {
        const { caseId } = req.params;
        const { BGVCase, BGVReport } = await getBGVModels(req);
        const BGVReportService = require('../services/BGVReportService');

        // Find case
        const bgvCase = await BGVCase.findById(caseId);
        if (!bgvCase) {
            return res.status(404).json({ success: false, message: "BGV Case not found" });
        }

        // Check if report exists
        if (!bgvCase.finalReport || !bgvCase.finalReport.id) {
            return res.status(404).json({ success: false, message: "No report generated for this case" });
        }

        // Find report
        const report = await BGVReport.findById(bgvCase.finalReport.id);
        if (!report) {
            return res.status(404).json({ success: false, message: "Report not found" });
        }

        // Get file path
        const filePath = await BGVReportService.getReportFile(report.filePath);

        // Send file
        res.download(filePath, report.fileName, (err) => {
            if (err) {
                console.error('[BGV_DOWNLOAD_ERROR]', err);
            }
        });

    } catch (err) {
        console.error('[BGV_DOWNLOAD_ERROR]', err);
        res.status(500).json({ success: false, message: "Failed to download report", error: err.message });
    }
};

/**
 * 🔍 Manual OCR Reprocess
 * POST /api/bgv/document/:documentId/reprocess-ocr
 */
exports.reprocessDocumentOCR = async (req, res, next) => {
    try {
        const { documentId } = req.params;
        const { BGVCase, BGVDocument } = await getBGVModels(req);

        const document = await BGVDocument.findById(documentId).populate('caseId');
        if (!document) {
            return res.status(404).json({ success: false, message: "Document not found" });
        }

        const bgvCase = await BGVCase.findById(document.caseId._id).populate('candidateId');

        // Use the same background process logic
        const processOCR = async (docId, filePath, mime, type, candidateData) => {
            try {
                const extraction = await BGVOCREngine.extractText(path.join(__dirname, '..', filePath), mime);
                const extractedFields = BGVDocumentParser.parse(extraction.text, type);
                const validation = BGVOCRValidator.validate(extractedFields, candidateData, type);

                await BGVDocument.findByIdAndUpdate(docId, {
                    'evidenceMetadata.extractedText': extraction.text,
                    'evidenceMetadata.ocrConfidence': extraction.confidence,
                    'evidenceMetadata.ocrStatus': 'COMPLETED',
                    'evidenceMetadata.processedAt': new Date(),
                    'evidenceMetadata.extractedFields': extractedFields,
                    'evidenceMetadata.validation': {
                        status: validation.status,
                        score: validation.score,
                        mismatchedFields: validation.mismatchedFields,
                        lastValidatedAt: new Date()
                    },
                    'evidenceMetadata.validationFlags': validation.flags
                });
            } catch (err) {
                console.error('[MANUAL_OCR_FAILED]', err);
                await BGVDocument.findByIdAndUpdate(docId, { 'evidenceMetadata.ocrStatus': 'FAILED' });
            }
        };

        // Trigger
        processOCR(document._id, document.filePath, document.mimeType, document.documentType, bgvCase.candidateId);

        res.json({
            success: true,
            message: "OCR reprocessing started in background",
            documentId: document._id
        });

    } catch (err) {
        console.error('[BGV_REPROCESS_OCR_ERROR]', err);
        next(err);
    }
};

/**
 * [BYPASS-FEATURE]: Manually Clear BGV for a candidate
 * Marks the case as VERIFIED and clears the path for employment
 */
exports.bypassBGV = async (req, res, next) => {
    try {
        const { id: applicantId } = req.params;
        const { BGVCase, BGVTimeline, Applicant } = await getBGVModels(req);

        // Find associated BGV case using applicationId within the same tenant.
        const bgvCase = await BGVCase.findOne({
            applicationId: applicantId,
            tenant: req.tenantId
        });

        if (!bgvCase) {
            const applicant = await Applicant.findById(applicantId);
            if (!applicant) {
                return res.status(404).json({ success: false, message: "Applicant not found" });
            }

            applicant.bgvStatus = 'VERIFIED';
            applicant.timeline = applicant.timeline || [];
            applicant.timeline.push({
                status: 'BGV Bypassed',
                message: `Background verification manually verified by ${req.user?.role || 'HR'} (${req.user?.name || req.user?.email || 'System'})`,
                updatedBy: req.user?.name || req.user?.email || 'System',
                timestamp: new Date()
            });
            await applicant.save();

            return res.json({
                success: true,
                message: "BGV bypassed successfully (Applicant status updated directly)"
            });
        }

        bgvCase.overallStatus = 'VERIFIED';
        bgvCase.decision = 'APPROVED';
        bgvCase.decisionRemarks = `Manual BGV bypass by ${req.user?.name || req.user?.email || 'System'}`;
        bgvCase.isClosed = true;
        bgvCase.closedAt = new Date();
        if (typeof bgvCase.riskScore === 'number') {
            bgvCase.riskScore = 100;
        }
        if ('riskLevel' in bgvCase) {
            bgvCase.riskLevel = 'LOW';
        }
        bgvCase.findings = bgvCase.findings || [];
        bgvCase.findings.push({
            type: 'INFO',
            title: 'Manual Bypass',
            description: `BGV process manually bypassed by authorized personnel: ${req.user.name || req.user.email}`,
            timestamp: new Date()
        });

        await bgvCase.save();

        await Applicant.findByIdAndUpdate(applicantId, {
            bgvStatus: 'VERIFIED',
            $push: {
                timeline: {
                    status: 'BGV Bypassed',
                    message: `Background verification manually verified by ${req.user.role} (${req.user.name || req.user.email})`,
                    updatedBy: req.user.name || req.user.email || 'System',
                    timestamp: new Date()
                }
            }
        });

        await createTimelineEntry(BGVTimeline, {
            tenant: req.tenantId,
            caseId: bgvCase._id,
            eventType: 'CASE_CLOSED',
            title: 'BGV Bypassed',
            description: `Verification manually cleared by ${req.user.name || req.user.email}`,
            performedBy: {
                userId: req.user.id,
                userName: req.user.name || req.user.email,
                userRole: req.user.role
            },
            newStatus: 'VERIFIED',
            visibleTo: ['HR', 'ADMIN'],
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({ 
            success: true, 
            message: "BGV case has been manually bypassed and marked as VERIFIED" 
        });

    } catch (err) {
        console.error('[BGV_BYPASS_FATAL]', err);
        next(err);
    }
};
