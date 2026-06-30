const mongoose = require('mongoose');
const crypto = require('crypto');
const emailService = require('../services/email.service');
const getTenantDB = require('../utils/tenantDB');

// Schemas
const CandidateDocumentRequestSchema = require('../models/CandidateDocumentRequest');
const ExternalEmployeeRecordSchema = require('../models/ExternalEmployeeRecord');
const ApplicantSchema = require('../models/Applicant');
const RequirementSchema = require('../models/Requirement');
const EmployeeSchema = require('../models/Employee');
const UserSchema = require('../models/User');
const NotificationSchema = require('../models/Notification');
const ApplicationSchema = require('../models/Application');
const CandidateSchema = require('../models/Candidate');
const AuditLogSchema = require('../models/AuditLog');
const { notifyDmsApplicantAndDocuments } = require('../services/dmsCandidateSync');

/**
 * resolveTenantDBForToken
 *
 * Primary path: return req.tenantDB if the tenant middleware already resolved it.
 * Fallback path: the token doesn't contain a tenantId prefix (old-format tokens).
 *   In that case we search all tenant databases until we find the CandidateDocumentRequest.
 *   Sets req.tenantDB and req.tenantId so subsequent helpers see the resolved connection.
 *
 * Returns the mongoose tenant Connection, or null if not found.
 */
async function resolveTenantDBForToken(req, token) {
    // Happy path – middleware already resolved it
    if (req.tenantDB) return req.tenantDB;

    console.warn(`[TENANT_FALLBACK] No tenantDB on req for token ${token ? token.slice(0, 12) : 'N/A'}... searching all tenants`);

    try {
        const TenantModel = mongoose.model('Tenant');
        const tenants = await TenantModel.find({}).select('_id code databaseName').lean();

        if (!tenants || tenants.length === 0) {
            console.warn('[TENANT_FALLBACK] No tenants found in main DB.');
            return null;
        }

        for (const tenant of tenants) {
            try {
                const db = await getTenantDB(tenant._id.toString());
                if (!db) continue;

                if (!db.models.CandidateDocumentRequest) {
                    db.model('CandidateDocumentRequest', CandidateDocumentRequestSchema);
                }
                const CDR = db.model('CandidateDocumentRequest');
                const found = await CDR.findOne({ token }).select('_id').lean();
                if (found) {
                    console.log(`[TENANT_FALLBACK] Token found in tenant: ${tenant.code || tenant._id}`);
                    req.tenantDB = db;
                    req.tenantId = tenant._id.toString();
                    return db;
                }
            } catch (innerErr) {
                // skip individual tenant errors (e.g. connection refused)
            }
        }

        console.warn('[TENANT_FALLBACK] Token not found in any tenant database.');
        return null;
    } catch (err) {
        console.error('[TENANT_FALLBACK_ERROR]', err.message);
        return null;
    }
}

function getModels(db) {
    if (!db) throw new Error('Tenant database connection not resolved.');
    
    if (!db.models.CandidateDocumentRequest) {
        db.model('CandidateDocumentRequest', CandidateDocumentRequestSchema);
    }
    if (!db.models.ExternalEmployeeRecord) {
        db.model('ExternalEmployeeRecord', ExternalEmployeeRecordSchema);
    }
    if (!db.models.Applicant) {
        db.model('Applicant', ApplicantSchema);
    }
    if (!db.models.Requirement) {
        db.model('Requirement', RequirementSchema);
    }
    if (!db.models.Employee) {
        db.model('Employee', EmployeeSchema);
    }
    if (!db.models.User) {
        db.model('User', UserSchema);
    }
    if (!db.models.Notification) {
        db.model('Notification', NotificationSchema);
    }
    if (!db.models.Application) {
        db.model('Application', ApplicationSchema);
    }
    if (!db.models.Candidate) {
        db.model('Candidate', CandidateSchema);
    }
    if (!db.models.AuditLog) {
        db.model('AuditLog', AuditLogSchema);
    }

    return {
        CandidateDocumentRequest: db.model('CandidateDocumentRequest'),
        ExternalEmployeeRecord: db.model('ExternalEmployeeRecord'),
        Applicant: db.model('Applicant'),
        Requirement: db.model('Requirement'),
        Employee: db.model('Employee'),
        User: db.model('User'),
        Notification: db.model('Notification'),
        Application: db.model('Application'),
        Candidate: db.model('Candidate'),
        AuditLog: db.model('AuditLog')
    };
}

const writeAuditLog = async (db, tenantId, entity, entityId, action, performedBy, changes = {}, meta = {}) => {
    try {
        const { AuditLog } = getModels(db);
        const log = new AuditLog({
            tenant: tenantId,
            entity,
            entityId,
            action,
            performedBy: mongoose.Types.ObjectId.isValid(String(performedBy)) ? performedBy : undefined,
            changes,
            meta
        });
        await log.save();
    } catch (e) {
        console.error('Failed to write audit log:', e.message);
    }
};

const notifyHrAdmins = async (db, tenantId, entityType, entityId, title, message) => {
    try {
        const { User, Notification } = getModels(db);
        const hrUsers = await User.find({ tenant: tenantId, role: { $in: ['hr', 'admin'] } });
        for (const user of hrUsers) {
            const notif = new Notification({
                tenant: tenantId,
                receiverId: user._id,
                receiverRole: 'hr',
                entityType,
                entityId,
                title,
                message
            });
            await notif.save();
        }
    } catch (e) {
        console.error('Failed to send notification to HR/Admins:', e.message);
    }
};

const collectionExists = async (Model) => {
    try {
        const collectionName = Model.collection.collectionName;
        const result = await Model.db.db
            .listCollections({ name: collectionName }, { nameOnly: true })
            .toArray();
        return result.length > 0;
    } catch (error) {
        console.warn(`Unable to verify collection ${Model.collection.collectionName}:`, error.message);
        return true;
    }
};

const updateExistingCollection = async (Model, filter, update, options = {}) => {
    const exists = await collectionExists(Model);
    if (!exists) {
        console.warn(`Skipping update for missing collection ${Model.collection.collectionName}.`);
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0, skipped: true };
    }

    return Model.updateOne(filter, update, options);
};

const firstNonEmpty = (...values) => values.find((value) => typeof value === 'string' && value.trim());

const resolveCandidateProfilePic = (record, candidate) => firstNonEmpty(
    record?.personalDetails?.profilePic,
    record?.personalDetails?.profileImage,
    record?.personalDetails?.photo,
    record?.documentDetails?.profilePic,
    record?.documentDetails?.profileImage,
    record?.documentDetails?.photo,
    record?.documentDetails?.profilePhoto,
    candidate?.profilePic
);

/**
 * HR Endpoints
 */

// POST /api/recruitment/candidate-documents/request/:applicationId
exports.sendDocumentRequest = async (req, res) => {
    try {
        const db = req.tenantDB;
        const tenantId = req.tenantId;
        const { applicationId } = req.params;

        const { Application, Applicant, CandidateDocumentRequest, ExternalEmployeeRecord, Candidate } = getModels(db);

        // Find application or applicant
        let app = await Application.findById(applicationId).populate('jobId candidateId');
        let applicant;
        let candidateId;
        let jobId;
        let candidateEmail;
        let candidateName;

        if (app) {
            candidateId = app.candidateId?._id || app.candidateId;
            jobId = app.jobId?._id || app.jobId;
            candidateEmail = app.candidateId?.email || app.email;
            candidateName = app.candidateId?.name || app.name;
        } else {
            applicant = await Applicant.findById(applicationId).populate('requirementId candidateId');
            if (!applicant) {
                return res.status(404).json({ success: false, message: 'Application/Applicant not found' });
            }
            candidateId = applicant.candidateId?._id || applicant.candidateId;
            jobId = applicant.requirementId?._id || applicant.requirementId;
            candidateEmail = applicant.candidateId?.email || applicant.email;
            candidateName = applicant.candidateId?.name || applicant.name;
        }

        if (!candidateId) {
            // Check if candidate already exists in the tenant DB with this email
            let candidateDoc = await Candidate.findOne({ email: candidateEmail.toLowerCase().trim(), tenant: tenantId });
            if (!candidateDoc) {
                // Auto-create Candidate profile
                const companyIdConfig = require('./companyIdConfig.controller');
                const bcrypt = require('bcryptjs');
                const candIdResult = await companyIdConfig.generateIdInternal({
                    tenantId,
                    entityType: 'CANDIDATE',
                    increment: true
                });
                const hashedPassword = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
                candidateDoc = new Candidate({
                    tenant: tenantId,
                    candidateId: candIdResult.id,
                    name: candidateName,
                    email: candidateEmail.toLowerCase().trim(),
                    password: hashedPassword,
                    mobile: (app ? (app.mobile || app.phone) : (applicant ? applicant.mobile : '')) || ''
                });
                await candidateDoc.save();
            }
            candidateId = candidateDoc._id;
            
            // Save link to application / applicant
            if (app) {
                app.candidateId = candidateId;
                await app.save();
            } else {
                const appToUpdate = await Applicant.findById(applicationId);
                if (appToUpdate) {
                    appToUpdate.candidateId = candidateId;
                    await appToUpdate.save();
                }
            }
        }

        // Fetch populated candidate to get exact email/name
        const candidateDoc = await Candidate.findById(candidateId);
        if (candidateDoc) {
            candidateEmail = candidateDoc.email;
            candidateName = candidateDoc.name;
        }

        const requestToken = `${tenantId}_${crypto.randomBytes(24).toString('hex')}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

        const resolvedApplicantId = app ? app._id : (applicant ? applicant._id : applicationId);

        let docRequest = await CandidateDocumentRequest.findOne({ candidateId, jobId });
        if (docRequest) {
            docRequest.token = requestToken;
            docRequest.status = 'Pending';
            docRequest.expiresAt = expiresAt;
            docRequest.sentBy = req.user?.id || req.user?._id;
            docRequest.sentAt = new Date();
            docRequest.applicantId = resolvedApplicantId;
            await docRequest.save();
        } else {
            docRequest = new CandidateDocumentRequest({
                tenant: tenantId,
                candidateId,
                applicantId: resolvedApplicantId,
                jobId,
                token: requestToken,
                status: 'Pending',
                sentBy: req.user?.id || req.user?._id,
                sentAt: new Date(),
                expiresAt
            });
            await docRequest.save();
        }

        // Prefill details from Applicant
        const applicantData = await Applicant.findOne({
            $or: [
                { candidateId },
                { email: candidateEmail }
            ]
        });

        const personalDetails = {
            firstName: applicantData?.name?.split(' ')[0] || candidateName?.split(' ')[0] || '',
            lastName: applicantData?.name?.split(' ').slice(1).join(' ') || candidateName?.split(' ').slice(1).join(' ') || '',
            email: candidateEmail || applicantData?.email || '',
            contactNo: applicantData?.mobile || candidateDoc?.mobile || '',
            dob: applicantData?.dob || candidateDoc?.dob || '',
            fatherName: applicantData?.fatherName || candidateDoc?.fatherName || '',
            gender: applicantData?.gender || candidateDoc?.gender || '',
            address: applicantData?.address || candidateDoc?.address || '',
            maritalStatus: applicantData?.maritalStatus || '',
            nationality: applicantData?.nationality || 'Indian',
            emergencyContactName: applicantData?.emergencyContactName || '',
            emergencyContactNumber: applicantData?.emergencyContactNumber || ''
        };

        let externalRecord = await ExternalEmployeeRecord.findOne({ candidateId, jobId });
        if (externalRecord) {
            externalRecord.personalDetails = { ...personalDetails, ...externalRecord.personalDetails };
            externalRecord.status = 'Pending';
            await externalRecord.save();
        } else {
            externalRecord = new ExternalEmployeeRecord({
                tenant: tenantId,
                candidateId,
                jobId,
                personalDetails,
                status: 'Pending',
                createdBy: req.user?.id || req.user?._id
            });
            await externalRecord.save();
        }

        // Send Email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5176';
        const link = `${frontendUrl}/candidate/document-upload/${requestToken}`;
        const subject = 'Action Required: Complete Onboarding Profile & Document Upload';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #4f46e5; margin-bottom: 20px;">Onboarding Profile Request</h2>
                <p>Dear ${candidateName || 'Candidate'},</p>
                <p>Your application has been finalized for the onboarding stage. To proceed, please fill out your employee profile details and upload the required verification documents.</p>
                <p>We use a comprehensive 10-step form to collect essential background information (personal, academic, professional, bank, and reference details) to build your draft employee profile.</p>
                <div style="margin: 30px 0; text-align: center;">
                    <a href="${link}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Start Onboarding Profile</a>
                </div>
                <p style="font-size: 13px; color: #64748b;">This secure link is valid for 7 days and will expire on ${expiresAt.toDateString()}.</p>
                <p style="font-size: 13px; color: #64748b; margin-top: 15px;">If the button doesn't work, copy this link to your browser: <br/><a href="${link}">${link}</a></p>
                <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;"/>
                <p style="font-size: 12px; color: #94a3b8;">This is an automated notification from the HR Management System.</p>
            </div>
        `;

        try {
            await emailService.sendEmail(candidateEmail, subject, html, [], tenantId);
        } catch (emailErr) {
            console.error('Failed to send email to candidate:', emailErr.message);
        }

        // Log audit event
        await writeAuditLog(db, tenantId, 'CandidateDocumentRequest', docRequest._id, 'SEND_DOCUMENT_REQUEST', req.user?.id || req.user?._id, {}, { candidateId });

        res.json({
            success: true,
            message: 'Document request successfully initiated and sent to candidate.',
            data: {
                token: requestToken,
                status: 'Pending'
            }
        });
    } catch (err) {
        require('fs').writeFileSync('d:\\new hrms\\Gitakshmi_HRMS_Web_App\\server\\docs_err.log', err.stack);
        console.error('[SEND_DOC_REQ_ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to send document request', error: err.message });
    }
};

// GET /api/recruitment/candidate-documents/records
exports.getRecords = async (req, res) => {
    try {
        const db = req.tenantDB;
        const tenantId = req.tenantId;
        const { ExternalEmployeeRecord } = getModels(db);

        const { status, search, page = 1, limit = 10 } = req.query;
        const query = { tenant: tenantId };

        if (status) {
            query.status = status;
        }

        let records = await ExternalEmployeeRecord.find(query)
            .populate('candidateId', 'name email mobile')
            .populate('jobId', 'jobTitle jobOpeningId department')
            .sort({ updatedAt: -1 })
            .lean();

        if (search) {
            const searchLower = search.toLowerCase();
            records = records.filter(r => {
                const candidateName = r.candidateId?.name?.toLowerCase() || '';
                const candidateEmail = r.candidateId?.email?.toLowerCase() || '';
                const personalName = `${r.personalDetails?.firstName || ''} ${r.personalDetails?.lastName || ''}`.toLowerCase();
                return candidateName.includes(searchLower) || candidateEmail.includes(searchLower) || personalName.includes(searchLower);
            });
        }

        const total = records.length;
        const startIndex = (page - 1) * limit;
        const paginatedRecords = records.slice(startIndex, startIndex + Number(limit));

        res.json({
            success: true,
            data: paginatedRecords,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('[GET_RECORDS_ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve records', error: err.message });
    }
};

// GET /api/recruitment/candidate-documents/records/:id
exports.getRecordDetails = async (req, res) => {
    try {
        const db = req.tenantDB;
        const { id } = req.params;
        const { ExternalEmployeeRecord } = getModels(db);

        const record = await ExternalEmployeeRecord.findById(id)
            .populate('candidateId', 'name email mobile')
            .populate('jobId', 'jobTitle jobOpeningId department');

        if (!record) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        res.json({ success: true, data: record });
    } catch (err) {
        console.error('[GET_RECORD_DETAILS_ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve record details', error: err.message });
    }
};

// POST /api/recruitment/candidate-documents/approve/:id
exports.approveRecord = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const db = req.tenantDB;
        const tenantId = req.tenantId;
        const { id } = req.params;

        const { ExternalEmployeeRecord, CandidateDocumentRequest, Employee, Applicant, Application, Candidate } = getModels(db);

        const record = await ExternalEmployeeRecord.findById(id);
        if (!record) {
            await session.abortTransaction();
            return res.status(404).json({ success: false, message: 'External record not found' });
        }

        if (record.status === 'Approved') {
            await session.abortTransaction();
            return res.status(400).json({ success: false, message: 'Record already approved.' });
        }

        // Check if employee with Draft status already exists for this candidate
        let employee = await Employee.findOne({ 'meta.candidateId': record.candidateId });
        const dept = record.personalDetails?.department || record.jobId?.department || 'GEN';
        const desig = record.personalDetails?.designation || record.jobId?.jobTitle || 'Trainee';
        const candidate = await Candidate.findById(record.candidateId).select('profilePic').lean();
        const profilePic = resolveCandidateProfilePic(record, candidate);

        if (!employee) {
            employee = new Employee({
                tenant: tenantId,
                mainCompanyId: tenantId,
                employeeId: `DRAFT-${record.candidateId}`,
                status: 'Draft',
                firstName: record.personalDetails?.firstName,
                middleName: record.personalDetails?.middleName || '',
                lastName: record.personalDetails?.lastName,
                dob: record.personalDetails?.dob,
                contactNo: record.personalDetails?.contactNo,
                personalEmail: record.personalDetails?.email,
                email: record.personalDetails?.email,
                profilePic,
                gender: record.personalDetails?.gender,
                maritalStatus: record.personalDetails?.maritalStatus,
                bloodGroup: record.personalDetails?.bloodGroup,
                nationality: record.personalDetails?.nationality,
                placeOfBirth: record.personalDetails?.placeOfBirth,
                hobbies: record.personalDetails?.hobbies,
                height: record.personalDetails?.height,
                weight: record.personalDetails?.weight,
                cast: record.personalDetails?.cast,
                physicalDisabilityOrSickness: record.personalDetails?.physicalDisabilityOrSickness,
                physicalDisabilityDetails: record.personalDetails?.physicalDisabilityDetails,
                fatherName: record.personalDetails?.fatherName,
                
                emergencyContactName: record.personalDetails?.emergencyContactName,
                emergencyContactNumber: record.personalDetails?.emergencyContactNumber,
                
                commAddress: record.communicationDetails?.commAddress || record.communicationDetails || {},
                tempAddress: record.communicationDetails?.tempAddress || {},
                permAddress: record.communicationDetails?.permAddress || {},
                
                education: record.educationDetails?.education || record.educationDetails || {},
                academicQualifications: record.educationDetails?.academicQualifications || [],
                
                experience: record.experienceDetails?.experience || record.experienceDetails || [],
                jobHistoryAnnexure: record.experienceDetails?.jobHistoryAnnexure || [],
                
                bankDetails: record.bankDetails || {},
                documents: record.documentDetails || {},
                
                department: dept,
                designation: desig,
                joiningDate: record.personalDetails?.joiningDate || new Date(),
                
                meta: {
                    createdFrom: 'EXTERNAL_RECORD',
                    candidateId: record.candidateId,
                    jobId: record.jobId
                }
            });
            await employee.save({ session });
        } else if (profilePic && !employee.profilePic) {
            employee.profilePic = profilePic;
            await employee.save({ session });
        }

        record.status = 'Approved';
        record.approvedAt = new Date();
        await record.save({ session });

        await CandidateDocumentRequest.updateOne(
            { candidateId: record.candidateId, jobId: record.jobId },
            { $set: { status: 'Approved', approvedAt: new Date() } },
            { session }
        );

        // Link in Applicant and Application
        await Applicant.updateOne(
            { candidateId: record.candidateId, requirementId: record.jobId },
            { $set: { employeeId: employee._id } },
            { session }
        );

        await updateExistingCollection(
            Application,
            { candidateId: record.candidateId, jobId: record.jobId },
            { $set: { employeeId: employee._id } },
            { session }
        );

        await session.commitTransaction();

        // Write audit log
        await writeAuditLog(db, tenantId, 'ExternalEmployeeRecord', record._id, 'APPROVE_PROFILE', req.user?.id || req.user?._id, {}, { employeeId: employee._id });

        // Send email to candidate
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #10b981; margin-bottom: 20px;">Onboarding Profile Approved</h2>
                <p>Dear ${record.personalDetails?.firstName || 'Candidate'},</p>
                <p>We are pleased to inform you that your onboarding profile and verification documents have been successfully reviewed and approved by our HR team.</p>
                <p>We are now preparing your official offer letter. You will receive another notification once the offer letter is ready for your signature.</p>
                <br/>
                <p>Best regards,<br/>HR Team</p>
            </div>
        `;
        try {
            await emailService.sendEmail(record.personalDetails?.email, 'Onboarding Profile & Documents Approved', html, [], tenantId);
        } catch (err) {
            console.error('Failed to send approval email:', err.message);
        }

        res.json({
            success: true,
            message: 'Candidate profile successfully approved and converted into a Draft Employee record.',
            data: {
                employeeId: employee.employeeId,
                _id: employee._id
            }
        });
    } catch (err) {
        await session.abortTransaction();
        console.error('[APPROVE_RECORD_ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to approve record', error: err.message });
    } finally {
        session.endSession();
    }
};

// POST /api/recruitment/candidate-documents/reject/:id
exports.rejectRecord = async (req, res) => {
    try {
        const db = req.tenantDB;
        const tenantId = req.tenantId;
        const { id } = req.params;
        const { remarks } = req.body;

        const { ExternalEmployeeRecord, CandidateDocumentRequest } = getModels(db);

        const record = await ExternalEmployeeRecord.findById(id);
        if (!record) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        record.status = 'Rejected';
        record.remarks = remarks;
        record.rejectedAt = new Date();
        await record.save();

        await CandidateDocumentRequest.updateOne(
            { candidateId: record.candidateId, jobId: record.jobId },
            { $set: { status: 'Rejected', remarks, rejectedAt: new Date() } }
        );

        // Write Audit Log
        await writeAuditLog(db, tenantId, 'ExternalEmployeeRecord', record._id, 'REJECT_PROFILE', req.user?.id || req.user?._id, {}, { remarks });

        // Notify Candidate
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #ef4444; margin-bottom: 20px;">Onboarding Profile Rejected</h2>
                <p>Dear ${record.personalDetails?.firstName || 'Candidate'},</p>
                <p>We regret to inform you that your onboarding profile/document submission was not approved by the HR team.</p>
                <p><strong>HR Comments / Reason:</strong></p>
                <blockquote style="background: #f8fafc; border-left: 4px solid #ef4444; padding: 10px 15px; margin: 15px 0;">${remarks || 'No remarks provided.'}</blockquote>
                <p>Please contact your HR representative to address the discrepancy.</p>
                <br/>
                <p>Best regards,<br/>HR Team</p>
            </div>
        `;
        try {
            await emailService.sendEmail(record.personalDetails?.email, 'Onboarding Profile Rejected', html, [], tenantId);
        } catch (err) {
            console.error('Failed to send rejection email:', err.message);
        }

        res.json({ success: true, message: 'Record successfully rejected.' });
    } catch (err) {
        console.error('[REJECT_RECORD_ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to reject record', error: err.message });
    }
};

// POST /api/recruitment/candidate-documents/request-changes/:id
exports.requestChanges = async (req, res) => {
    try {
        const db = req.tenantDB;
        const tenantId = req.tenantId;
        const { id } = req.params;
        const { remarks } = req.body;

        if (!remarks) {
            return res.status(400).json({ success: false, message: 'Remarks are required for change request' });
        }

        const { ExternalEmployeeRecord, CandidateDocumentRequest } = getModels(db);

        const record = await ExternalEmployeeRecord.findById(id);
        if (!record) {
            return res.status(404).json({ success: false, message: 'Record not found' });
        }

        // Set record status back to Pending (so candidate can edit)
        record.status = 'Pending';
        record.remarks = remarks;
        await record.save();

        const docReq = await CandidateDocumentRequest.findOne({ candidateId: record.candidateId, jobId: record.jobId });
        if (docReq) {
            docReq.status = 'Pending';
            docReq.remarks = remarks;
            await docReq.save();
        }

        // Write Audit Log
        await writeAuditLog(db, tenantId, 'ExternalEmployeeRecord', record._id, 'REQUEST_CHANGES', req.user?.id || req.user?._id, {}, { remarks });

        // Send Email
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5176';
        const link = `${frontendUrl}/candidate/document-upload/${docReq.token}`;
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #f59e0b; margin-bottom: 20px;">Revision Required: Onboarding Profile Details</h2>
                <p>Dear ${record.personalDetails?.firstName || 'Candidate'},</p>
                <p>During the review of your onboarding profile, the HR team requested that you make some changes/corrections before we proceed.</p>
                <p><strong>Remarks from HR:</strong></p>
                <blockquote style="background: #f8fafc; border-left: 4px solid #f59e0b; padding: 10px 15px; margin: 15px 0;">${remarks}</blockquote>
                <p>Please click the button below to log back in, review your previous inputs, and make the requested corrections.</p>
                <div style="margin: 30px 0; text-align: center;">
                    <a href="${link}" style="background-color: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Revise Onboarding Profile</a>
                </div>
                <p style="font-size: 13px; color: #64748b;">If the button doesn't work, copy this link to your browser: <br/><a href="${link}">${link}</a></p>
                <br/>
                <p>Best regards,<br/>HR Team</p>
            </div>
        `;
        try {
            await emailService.sendEmail(record.personalDetails?.email, 'Action Required: Revision of Onboarding Profile', html, [], tenantId);
        } catch (err) {
            console.error('Failed to send revision email:', err.message);
        }

        res.json({ success: true, message: 'Revision remarks successfully sent to candidate.' });
    } catch (err) {
        console.error('[REQUEST_CHANGES_ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to request changes', error: err.message });
    }
};

/**
 * Public Candidate-Facing Endpoints
 */

// GET /api/public/candidate-documents/token/:token
exports.getPrefilledDetails = async (req, res) => {
    try {
        const db = req.tenantDB;
        const { token } = req.params;
        const { CandidateDocumentRequest, ExternalEmployeeRecord } = getModels(db);

        const crypto = require('crypto');
        const tokenHash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
        
        console.log(`[DEBUG] getPrefilledDetails - Token: ${token}, Hash: ${tokenHash}`);
        const request = await CandidateDocumentRequest.findOne({ 
            $or: [{ token: token }, { token: tokenHash }] 
        }).populate('candidateId jobId');
        
        console.log(`[DEBUG] getPrefilledDetails - Found Request:`, request ? request._id : 'null');

        if (!request) {
            console.log(`[DEBUG] getPrefilledDetails - Querying ALL tokens to see if it exists...`);
            const allReqs = await CandidateDocumentRequest.find({}, 'token');
            console.log(`[DEBUG] getPrefilledDetails - Total doc reqs in DB: ${allReqs.length}. Tokens:`, allReqs.map(r => r.token));
            return res.status(404).json({ success: false, message: 'Invalid onboarding document token.' });
        }

        if (!['Submitted', 'Approved'].includes(request.status)) {
            if (request.expiresAt && request.expiresAt < new Date()) {
                return res.status(400).json({ success: false, message: 'This secure document link has expired.' });
            }
        }

        const externalRecord = await ExternalEmployeeRecord.findOne({ candidateId: request.candidateId, jobId: request.jobId });

        res.json({
            success: true,
            data: {
                request: {
                    id: request._id,
                    status: request.status,
                    expiresAt: request.expiresAt,
                    remarks: request.remarks
                },
                candidate: {
                    id: request.candidateId?._id,
                    name: request.candidateId?.name,
                    email: request.candidateId?.email,
                    mobile: request.candidateId?.mobile,
                },
                job: {
                    id: request.jobId?._id,
                    title: request.jobId?.jobTitle || request.jobId?.title,
                    department: request.jobId?.department,
                    designation: request.jobId?.designation || request.jobId?.jobTitle,
                },
                record: externalRecord || {}
            }
        });
    } catch (err) {
        console.error('[GET_PREFILLED_DETAILS_ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve details', error: err.message });
    }
};

// POST /api/public/candidate-documents/save-draft/:token
// Also handles PUT requests via the /draft/:token alias route
exports.saveCandidateDraft = async (req, res) => {
    try {
        const db = req.tenantDB;
        const { token } = req.params;
        const { CandidateDocumentRequest, ExternalEmployeeRecord } = getModels(db);

        const crypto = require('crypto');
        const tokenHash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
        const request = await CandidateDocumentRequest.findOne({ 
            $or: [{ token: token }, { token: tokenHash }], 
            status: { $ne: 'Approved' } 
        });
        if (!request) {
            return res.status(404).json({ success: false, message: 'Invalid onboarding document token.' });
        }

        if (request.expiresAt < new Date()) {
            return res.status(400).json({ success: false, message: 'Onboarding link has expired.' });
        }

        let externalRecord = await ExternalEmployeeRecord.findOne({ candidateId: request.candidateId, jobId: request.jobId });
        if (!externalRecord) {
            externalRecord = new ExternalEmployeeRecord({
                tenant: request.tenant,
                candidateId: request.candidateId,
                jobId: request.jobId
            });
        }

        // Normalise flat EmployeeForm payload → nested ExternalEmployeeRecord structure
        const normalised = normaliseCandidatePayload(req.body);
        const {
            personalDetails,
            familyDetails,
            communicationDetails,
            educationDetails,
            experienceDetails,
            documentDetails,
            bankDetails,
            statutoryDetails,
            salaryDetails,
            completionPercentage
        } = normalised;

        if (personalDetails) externalRecord.personalDetails = personalDetails;
        if (familyDetails) externalRecord.familyDetails = familyDetails;
        if (communicationDetails) externalRecord.communicationDetails = communicationDetails;
        if (educationDetails) externalRecord.educationDetails = educationDetails;
        if (experienceDetails) externalRecord.experienceDetails = experienceDetails;
        if (documentDetails) externalRecord.documentDetails = documentDetails;
        if (bankDetails) externalRecord.bankDetails = bankDetails;
        if (statutoryDetails) externalRecord.statutoryDetails = statutoryDetails;
        if (salaryDetails) externalRecord.salaryDetails = salaryDetails;
        if (completionPercentage !== undefined) externalRecord.completionPercentage = completionPercentage;

        externalRecord.status = 'Pending';
        await externalRecord.save();

        res.json({ success: true, message: 'Draft onboarding profile saved successfully.', data: externalRecord });
    } catch (err) {
        console.error('[SAVE_CANDIDATE_DRAFT_ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to save draft details', error: err.message });
    }
};

/**
 * Normalise a flat EmployeeForm payload (sent by the candidate portal) into
 * the nested ExternalEmployeeRecord structure that all downstream logic expects.
 * If the caller already sent nested objects (e.g. { personalDetails: {...} }) this
 * function returns them unchanged, so it is safe to call in both cases.
 */
function normaliseCandidatePayload(body) {
    // If nested keys already present, return as-is
    if (body.personalDetails || body.familyDetails || body.communicationDetails ||
        body.educationDetails || body.experienceDetails || body.documentDetails) {
        return body;
    }

    // Flat-to-nested mapping (matches EmployeeForm.jsx payload keys)
    const {
        // personal
        firstName, middleName, lastName, dob, gender, maritalStatus, bloodGroup,
        nationality, placeOfBirth, contactNo, personalEmail, email,
        fatherName, fatherFirstName, fatherLastName, fatherBloodGroup, fatherAadhaar,
        motherName, motherFirstName, motherLastName, motherBloodGroup, motherAadhaar,
        emergencyContactName, emergencyContactNumber,
        profilePic, hobbies, height, weight, cast,
        physicalDisabilityOrSickness, physicalDisabilityDetails,
        religion, caste, customFields,
        // family / dependents
        spouseDetails, children, brothers, sisters,
        // address
        tempAddress, permAddress, commAddress,
        // education
        education, academicQualifications, highestQualification,
        // experience
        experience, jobHistoryAnnexure,
        // documents
        documents,
        // bank
        bankDetails,
        // statutory / salary / job info
        department, departmentId, designation, role, manager, joiningDate,
        gradeId, grade, band, salaryTemplateId, payrollTemplateId,
        leavePolicy, shiftId, status, employeeType,
        departmentHead, salaryAssigned, perquisites, relatedEmployee, references,
        // languages, previousInterview etc.
        languages, previousInterview, previousInterviewDate,
        previousInterviewDeptLocation, previousInterviewedBy,
        completionPercentage,
        ...rest
    } = body;

    return {
        personalDetails: {
            firstName, middleName, lastName, dob, gender, maritalStatus, bloodGroup,
            nationality, placeOfBirth, contactNo, personalEmail, email,
            fatherName: fatherName || [fatherFirstName, fatherLastName].filter(Boolean).join(' ') || undefined,
            fatherFirstName, fatherLastName, fatherBloodGroup, fatherAadhaar,
            motherName: motherName || [motherFirstName, motherLastName].filter(Boolean).join(' ') || undefined,
            motherFirstName, motherLastName, motherBloodGroup, motherAadhaar,
            emergencyContactName, emergencyContactNumber,
            profilePic, hobbies, height, weight, cast,
            physicalDisabilityOrSickness, physicalDisabilityDetails,
            religion, caste,
            department, departmentId, designation, role, manager, joiningDate,
            gradeId, grade, band, salaryTemplateId, payrollTemplateId,
            leavePolicy, shiftId, status, employeeType, departmentHead,
            salaryAssigned, customFields,
            languages, previousInterview, previousInterviewDate,
            previousInterviewDeptLocation, previousInterviewedBy,
            perquisites, relatedEmployee, references
        },
        familyDetails: {
            spouseDetails: spouseDetails || {},
            children: children || [],
            brothers: brothers || [],
            sisters: sisters || []
        },
        communicationDetails: {
            tempAddress: tempAddress || {},
            permAddress: permAddress || {},
            commAddress: commAddress || {}
        },
        educationDetails: {
            education: education || {},
            academicQualifications: academicQualifications || [],
            highestQualification
        },
        experienceDetails: {
            experience: experience || [],
            jobHistoryAnnexure: jobHistoryAnnexure || []
        },
        documentDetails: documents || {},
        bankDetails: bankDetails || {},
        completionPercentage,
        ...rest
    };
}

// POST /api/public/candidate-documents/submit/:token
exports.submitCandidateProfile = async (req, res) => {
    try {
        const db = req.tenantDB;
        const { token } = req.params;
        const { CandidateDocumentRequest, ExternalEmployeeRecord } = getModels(db);

        const crypto = require('crypto');
        const tokenHash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
        const request = await CandidateDocumentRequest.findOne({ 
            $or: [{ token: token }, { token: tokenHash }], 
            status: { $ne: 'Approved' } 
        });
        if (!request) {
            return res.status(404).json({ success: false, message: 'Invalid onboarding document token.' });
        }

        if (request.expiresAt < new Date()) {
            return res.status(400).json({ success: false, message: 'Onboarding link has expired.' });
        }

        let externalRecord = await ExternalEmployeeRecord.findOne({ candidateId: request.candidateId, jobId: request.jobId });
        if (!externalRecord) {
            externalRecord = new ExternalEmployeeRecord({
                tenant: request.tenant,
                candidateId: request.candidateId,
                jobId: request.jobId
            });
        }

        // Normalise flat EmployeeForm payload → nested ExternalEmployeeRecord structure
        const normalised = normaliseCandidatePayload(req.body);
        const {
            personalDetails,
            familyDetails,
            communicationDetails,
            educationDetails,
            experienceDetails,
            documentDetails,
            bankDetails,
            statutoryDetails,
            salaryDetails,
            completionPercentage
        } = normalised;

        if (personalDetails) externalRecord.personalDetails = personalDetails;
        if (familyDetails) externalRecord.familyDetails = familyDetails;
        if (communicationDetails) externalRecord.communicationDetails = communicationDetails;
        if (educationDetails) externalRecord.educationDetails = educationDetails;
        if (experienceDetails) externalRecord.experienceDetails = experienceDetails;
        if (documentDetails) externalRecord.documentDetails = documentDetails;
        if (bankDetails) externalRecord.bankDetails = bankDetails;
        if (statutoryDetails) externalRecord.statutoryDetails = statutoryDetails;
        if (salaryDetails) externalRecord.salaryDetails = salaryDetails;
        if (completionPercentage !== undefined) externalRecord.completionPercentage = completionPercentage;

        externalRecord.status = 'Submitted';
        externalRecord.submittedAt = new Date();
        await externalRecord.save();

        request.status = 'Submitted';
        request.submittedAt = new Date();
        await request.save();

        // Write Audit Log
        await writeAuditLog(db, request.tenant, 'ExternalEmployeeRecord', externalRecord._id, 'SUBMIT_PROFILE', request.candidateId, {}, { source: 'CANDIDATE_PORTAL' });

        // Notify HR
        const candidateName = personalDetails?.firstName ? `${personalDetails.firstName} ${personalDetails.lastName || ''}` : 'A candidate';
        await notifyHrAdmins(
            db,
            request.tenant,
            'ExternalEmployeeRecord',
            externalRecord._id,
            'Onboarding Profile Submitted',
            `${candidateName} has submitted their onboarding details. Please review.`
        );

        // Sync with DMS (Create candidate folder and upload ALL documents)
        // Enrich externalRecord with applicantId so offer/joining letters can be found
        const tenantDbName = db.name || (db.client && db.name);
        (async () => {
            try {
                // Fetch applicantId if not already set on the record
                if (!externalRecord.applicantId) {
                    const applicant = await db.collection('applicants').findOne({ candidateId: request.candidateId });
                    if (applicant) {
                        externalRecord.applicantId = applicant._id;
                    }
                }
                await notifyDmsApplicantAndDocuments(externalRecord, request, tenantDbName);
            } catch (err) {
                console.error('[DMS_SYNC_ERROR] Async DMS candidate sync failed:', err);
            }
        })();

        res.json({ success: true, message: 'Onboarding profile details submitted successfully.', data: externalRecord });
    } catch (err) {
        console.error('[SUBMIT_CANDIDATE_PROFILE_ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to submit profile details', error: err.message });
    }
};

// GET /api/public/candidate-documents/reference-data/:token
// Returns departments, grades, shifts, leave policies and salary templates
// so the external candidate form can populate dropdowns.
exports.getCandidateReferenceData = async (req, res) => {
    try {
        const db = req.tenantDB;
        const { token } = req.params;
        const { CandidateDocumentRequest } = getModels(db);

        // Validate token so we don't leak tenant data to unauthorised callers
        const request = await CandidateDocumentRequest.findOne({ token });
        if (!request) {
            return res.status(404).json({ success: false, message: 'Invalid onboarding document token.' });
        }
        if (request.expiresAt < new Date()) {
            return res.status(400).json({ success: false, message: 'Onboarding link has expired.' });
        }

        // Lazy-register lightweight schemas so we don't bloat getModels()
        const registerIfAbsent = (name, schema, collection) => {
            if (!db.models[name]) db.model(name, schema, collection);
            return db.model(name);
        };

        const { Schema } = require('mongoose');
        const lean = { lean: true };

        const DepartmentModel  = registerIfAbsent('Department',     new Schema({}, { strict: false }), 'departments');
        const GradeModel       = registerIfAbsent('Grade',          new Schema({}, { strict: false }), 'grades');
        const ShiftModel       = registerIfAbsent('Shift',          new Schema({}, { strict: false }), 'shifts');
        const LeavePolicyModel = registerIfAbsent('LeavePolicy',    new Schema({}, { strict: false }), 'leavepolicies');
        const SalaryTplModel   = registerIfAbsent('SalaryTemplate', new Schema({}, { strict: false }), 'salarytemplates');
        const EmployeeModel    = db.models.Employee || db.model('Employee', require('../models/Employee'));
        const RoleModel        = registerIfAbsent('Role',           new Schema({}, { strict: false }), 'roles');

        const [departments, grades, shifts, policies, salaryTemplates, managers, roles] = await Promise.all([
            DepartmentModel.find({}, { name: 1, _id: 1 }).lean(),
            GradeModel.find({}, { name: 1, band: 1, _id: 1 }).lean(),
            ShiftModel.find({}, { name: 1, shiftName: 1, startTime: 1, endTime: 1, _id: 1 }).lean(),
            LeavePolicyModel.find({}, { name: 1, policyName: 1, _id: 1 }).lean(),
            SalaryTplModel.find({}, { name: 1, templateName: 1, _id: 1 }).lean(),
            EmployeeModel.find(
                { status: { $in: ['Active', 'active'] } },
                { firstName: 1, lastName: 1, designation: 1, _id: 1 }
            ).lean(),
            RoleModel.find({}, { name: 1, roleName: 1, _id: 1 }).lean()
        ]);

        return res.json({
            success: true,
            data: { departments, grades, shifts, policies, salaryTemplates, managers, roles }
        });
    } catch (err) {
        console.error('[GET_CANDIDATE_REFERENCE_DATA_ERROR]', err);
        res.status(500).json({ success: false, message: 'Failed to load reference data', error: err.message });
    }
};
