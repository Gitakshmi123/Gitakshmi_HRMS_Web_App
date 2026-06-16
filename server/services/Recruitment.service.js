const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const { getBGVModels } = require('../utils/bgvModels');
const companyIdConfig = require('../controllers/companyIdConfig.controller');
const idGenerator = require('../utils/idGenerator');
const { resolveOrgAssignment } = require('./orgAssignment.service');

const stringifyId = (id) => {
    if (!id) return '';
    if (typeof id === 'string') return id;
    if (id instanceof mongoose.Types.ObjectId) return id.toHexString();
    if (typeof id === 'object') {
        if (id._id) return stringifyId(id._id);
        if (id.id) return stringifyId(id.id);
        if (id.toString && typeof id.toString === 'function') {
            const s = id.toString();
            return s === '[object Object]' ? '' : s;
        }
    }
    return String(id);
};

const cleanStringArray = (value) => (Array.isArray(value) ? value : [])
    .map(item => (typeof item === 'string' ? item.trim() : item))
    .filter(item => {
        if (!item) return false;
        if (typeof item === 'string') return item.length > 0;
        if (typeof item === 'object' && 'name' in item) return String(item.name || '').trim().length > 0;
        return true;
    });


class RecruitmentService {

    // Helper to resolve Tenant DB models dynamically
    async getModels(tenantId) {
        if (!tenantId) throw new Error("Tenant ID is required for Recruitment Service");
        const db = await getTenantDB(tenantId);

        // Ensure models are registered on this connection with their schemas if missing
        if (!db.models.Requirement) {
            db.model('Requirement', require('../models/Requirement'));
        }
        if (!db.models.RequirementDraft) {
            db.model('RequirementDraft', require('../models/RequirementDraft'));
        }
        if (!db.models.Applicant) {
            db.model('Applicant', require('../models/Applicant'));
        }
        if (!db.models.Position) {
            db.model('Position', require('../models/Position'));
        }
        if (!db.models.Application) {
            db.model('Application', require('../models/Application'));
        }
        if (!db.models.Employee) {
            db.model('Employee', require('../models/Employee'));
        }
        if (!db.models.Department) {
            db.model('Department', require('../models/Department'));
        }
        if (!db.models.Designation) {
            db.model('Designation', require('../models/Designation'));
        }
        if (!db.models.Grade) {
            db.model('Grade', require('../models/Grade'));
        }

        return {
            Requirement: db.model('Requirement'),
            RequirementDraft: db.model('RequirementDraft'),
            Applicant: db.model('Applicant'),
            Position: db.model('Position'),
            Employee: db.model('Employee'),
            Department: db.model('Department'),
            Designation: db.model('Designation'),
            Grade: db.model('Grade'),
            Application: db.model('Application')
        };
    }

    async resolveGradeSnapshot(tenantId, gradeId) {
        if (!gradeId) return null;
        const { Grade } = await this.getModels(tenantId);
        if (!mongoose.Types.ObjectId.isValid(String(gradeId))) {
            throw new Error("Invalid gradeId");
        }
        const grade = await Grade.findOne({
            _id: gradeId,
            tenant: tenantId,
            isDeleted: false,
            isActive: true
        }).lean();
        if (!grade) throw new Error("Grade not found or inactive");
        return {
            gradeId: grade._id,
            grade: grade.name,
            gradeSnapshot: {
                id: grade._id,
                name: grade.name,
                code: grade.code,
                level: grade.level
            }
        };
    }

    /**
     * Step-by-Step Draft Saving
     * Optimized to be more robust: updates any step for which data is provided in the payload.
     */
    async saveDraft(tenantId, step, data, userId, draftId = null) {
        const { RequirementDraft } = await this.getModels(tenantId);

        let draft;
        if (draftId && mongoose.Types.ObjectId.isValid(String(draftId))) {
            draft = await RequirementDraft.findOne({ _id: draftId, tenant: tenantId });
        }

        if (!draft) {
            draft = new RequirementDraft({
                tenant: tenantId,
                createdBy: userId
            });
        }

        // Helper to update step 1
        const updateStep1 = async (d) => {
            if (data.positionId || data.department || data.jobType) {
                const gradeSnapshot = data.gradeId ? await this.resolveGradeSnapshot(tenantId, data.gradeId) : null;
                d.step1 = {
                    positionId: data.positionId || d.step1?.positionId || undefined,
                    gradeId: gradeSnapshot?.gradeId || d.step1?.gradeId || undefined,
                    grade: gradeSnapshot?.grade || data.grade || d.step1?.grade || '',
                    department: data.department || d.step1?.department,
                    jobType: data.jobType || d.step1?.jobType,
                    workMode: data.workMode || d.step1?.workMode,
                    location: data.location || d.step1?.location,
                    vacancy: data.vacancy || d.step1?.vacancy
                };
            }
        };

        // Helper to update step 2
        const updateStep2 = (d) => {
            if (data.jobTitle || data.hiringManager) {
                d.step2 = {
                    jobTitle: data.jobTitle || d.step2?.jobTitle,
                    salaryMin: data.salaryMin !== undefined ? data.salaryMin : d.step2?.salaryMin,
                    salaryMax: data.salaryMax !== undefined ? data.salaryMax : d.step2?.salaryMax,
                    experienceMin: data.experienceMin !== undefined ? data.experienceMin : d.step2?.experienceMin,
                    experienceMax: data.experienceMax !== undefined ? data.experienceMax : d.step2?.experienceMax,
                    priority: data.priority || d.step2?.priority,
                    visibility: data.visibility || d.step2?.visibility || 'External',
                    hiringManager: data.hiringManager || d.step2?.hiringManager || undefined,
                    interviewPanel: (data.interviewPanel && data.interviewPanel.length > 0) ? data.interviewPanel : (d.step2?.interviewPanel || [])
                };
            }
        };

        // If a specific step is passed, we update it and set currentStep.
        // But we ALSO try to fill in Step 1 and 2 if they are missing and data is available,
        // which prevents the "400 Bad Request" during publish if a draft was started mid-way.
        if (step === 1) {
            await updateStep1(draft);
            draft.currentStep = 1;
        } else if (step === 2) {
            await updateStep1(draft); // Fill in step 1 if data is there
            updateStep2(draft);
            draft.currentStep = 2;
        } else if (step === 3) {
            await updateStep1(draft);
            updateStep2(draft);
            draft.step3 = {
                description: data.description || draft.step3?.description,
                responsibilities: data.responsibilities || draft.step3?.responsibilities,
                requiredSkills: data.requiredSkills || draft.step3?.requiredSkills,
                optionalSkills: data.optionalSkills || draft.step3?.optionalSkills,
                education: data.education || draft.step3?.education,
                certifications: data.certifications || draft.step3?.certifications,
                keywords: data.keywords || draft.step3?.keywords
            };
            draft.currentStep = 3;
        } else if (step === 4) {
            await updateStep1(draft);
            updateStep2(draft);
            draft.step4 = {
                pipelineStages: data.pipelineStages || data.workflow || draft.step4?.pipelineStages || []
            };
            draft.currentStep = 4;
        } else if (step === 5 || !step) {
            await updateStep1(draft);
            updateStep2(draft);
            draft.step5 = {
                bgvConfig: data.bgvConfig || draft.step5?.bgvConfig,
                onboardingConfig: data.onboardingConfig || draft.step5?.onboardingConfig
            };
            if (step) draft.currentStep = 5;
        }

        return await draft.save();
    }

    /**
     * Final Transition from Draft to Requirement
     */
    async publishJob(tenantId, draftId, userId) {
        const { Requirement, Position, RequirementDraft, Department, Designation } = await this.getModels(tenantId);

        const draft = await RequirementDraft.findById(draftId).lean();
        if (!draft) throw new Error("Draft session expired or not found. Please try saving as draft again.");

        // Defensive: Ensure all steps have at least an empty object to prevent "cannot read property of undefined"
        const s1 = draft.step1 || {};
        const s2 = draft.step2 || {};
        const s3 = draft.step3 || {};
        const s4 = draft.step4 || {};
        const s5 = draft.step5 || {};

        if (!s1.department || !s2.jobTitle) {
            console.error('[publishJob] Missing required fields:', { dept: s1.department, title: s2.jobTitle });
            throw new Error("Job Title and Department are required to publish. Please go back to steps 1 and 2 and ensure they are filled.");
        }

        // 1. Generate ID
        const jobId = await this.generateJobId(tenantId);

        // 2. Validate and sanitize interviewer ObjectIds
        const validateObjectId = (id) => {
            if (!id || id === "" || id === "null" || id === "undefined") return null;
            if (typeof id === 'string' && mongoose.Types.ObjectId.isValid(id)) {
                return new mongoose.Types.ObjectId(id);
            }
            if (id instanceof mongoose.Types.ObjectId) return id;
            if (typeof id === 'object' && id._id) return validateObjectId(id._id);
            return null;
        };

        const sanitizedPositionId = validateObjectId(s1.positionId);
        const sanitizedHiringManager = validateObjectId(s2.hiringManager);
        const sanitizedInterviewPanel = (s2.interviewPanel || [])
            .map(validateObjectId)
            .filter(id => id !== null);

        const linkedPosition = sanitizedPositionId
            ? await Position.findById(sanitizedPositionId).lean().catch(() => null)
            : null;
        const orgAssignment = await resolveOrgAssignment({
            models: { Department, Designation },
            tenantId,
            subCompanyId: s1.subCompanyId || linkedPosition?.subCompanyId,
            branchId: s1.branchId || linkedPosition?.branchId,
            divisionId: s1.divisionId || linkedPosition?.divisionId,
            departmentId: s1.departmentId || linkedPosition?.departmentId,
            designationId: s2.designationId || linkedPosition?.designationId,
            department: s1.department || linkedPosition?.department,
            designation: s2.designation || s2.jobTitle || linkedPosition?.jobTitle,
            jobTitle: s2.jobTitle || linkedPosition?.jobTitle,
            managerId: sanitizedHiringManager || linkedPosition?.reportingTo,
            reportingTo: linkedPosition?.reportingTo,
        });

        const allowedStageTypes = new Set(['Screening', 'Interview', 'Assessment', 'HR', 'Offer', 'Custom', 'Finalized', 'Round', 'Technical', 'Management', 'System']);
        const allowedStageModes = new Set(['Online', 'Offline', 'Telephonic', 'Virtual', 'In-person']);
        const sanitizedPipelineStages = (s4.pipelineStages || []).map((stage, index) => ({
            stageId: String(stage.stageId || `stage_${Date.now()}_${index}`).trim(),
            stageName: String(stage.stageName || 'Interview').trim() || 'Interview',
            stageType: allowedStageTypes.has(stage.stageType) ? stage.stageType : 'Interview',
            mode: allowedStageModes.has(stage.mode) ? stage.mode : 'Online',
            durationMinutes: Number(stage.durationMinutes) > 0 ? Number(stage.durationMinutes) : 30,
            feedbackFormId: validateObjectId(stage.feedbackFormId),
            evaluationCriteria: stage.evaluationCriteria || [],
            orderIndex: index + 1,
            isSystemStage: stage.isSystemStage || false,
            assignedInterviewers: (stage.assignedInterviewers || [])
                .map(validateObjectId)
                .filter(id => id !== null)
        }));

        const roleOverview = String(s3.description || '').trim()
            || `${s2.jobTitle} role in ${s1.department}.`;
        const requiredSkills = cleanStringArray(s3.requiredSkills).map(s => (
            typeof s === 'string' ? { name: s, weight: 40 } : { ...s, name: String(s.name || '').trim() }
        ));
        const preferredSkills = cleanStringArray(s3.optionalSkills).map(s => (
            typeof s === 'string' ? { name: s, weight: 10 } : { ...s, name: String(s.name || '').trim() }
        ));

        // 3. Map data to Requirement Model (matching Requirement.js schema)
        const requirement = new Requirement({
            tenant: tenantId,
            jobOpeningId: jobId,
            positionId: sanitizedPositionId,
            subCompanyId: orgAssignment.subCompanyId || undefined,
            branchId: orgAssignment.branchId || undefined,
            divisionId: orgAssignment.divisionId || undefined,
            departmentId: orgAssignment.departmentId || undefined,
            designationId: orgAssignment.designationId || undefined,
            department: orgAssignment.department || s1.department,
            jobTitle: s2.jobTitle,

            jobDetails: {
                salaryMin: s2.salaryMin,
                salaryMax: s2.salaryMax,
                experienceMin: s2.experienceMin,
                experienceMax: s2.experienceMax,
                priority: s2.priority || 'Medium',
                visibility: s2.visibility || 'External',
                workMode: s1.workMode || 'On-site',
                jobType: s1.jobType || 'Full-Time',
                hiringManager: sanitizedHiringManager || orgAssignment.managerId || undefined,
                reportingTo: orgAssignment.managerId || linkedPosition?.reportingTo || undefined,
                interviewPanel: sanitizedInterviewPanel
            },
            isInternal: ['Internal', 'Both'].includes(s2.visibility),
            visibility: s2.visibility || 'External',

            jobDescription: {
                roleOverview,
                responsibilities: cleanStringArray(s3.responsibilities),
                keywords: cleanStringArray(s3.keywords),
                education: s3.education || '',
                certifications: cleanStringArray(s3.certifications)
            },

            requiredSkills,
            preferredSkills,

            // Initialize matchingConfig with default weights
            matchingConfig: {
                skillWeight: 40,
                experienceWeight: 20,
                educationWeight: 10,
                similarityWeight: 20,
                preferredBonus: 10
            },

            pipelineStages: sanitizedPipelineStages,

            vacancy: s1.vacancy || 1,
            bgvConfig: s5.bgvConfig || { isEnabled: false, triggerStage: 'POST_OFFER', checks: [] },
            onboardingConfig: {
                templateId: validateObjectId(s5.onboardingConfig?.templateId)
            },
            status: 'Open',
            publishedAt: new Date(),
            hiringStatus: 'Open', // Sync for both fields
            createdBy: userId
        });

        const saved = await requirement.save();

        // 4. Update Position status (if linked to a position master)
        if (s1 && s1.positionId) {
            await Position.findByIdAndUpdate(s1.positionId, { 
                hiringStatus: 'Open',
                status: 'Active' // Ensure it's not 'Vacant' or 'Cancelled' if that matters
            });
        }

        // 5. Cleanup Draft
        await RequirementDraft.deleteOne({ _id: draftId });

        // 6. Audit Log
        try {
            const db = await getTenantDB(tenantId);
            if (!db.models.AuditLog) {
                db.model('AuditLog', require('../models/AuditLog'));
            }
            const AuditLog = db.model('AuditLog');
            await AuditLog.create({
                tenant: tenantId,
                entity: 'Requirement',
                entityId: saved._id,
                action: 'JOB_PUBLISHED',
                performedBy: userId,
                changes: {
                    before: null,
                    after: {
                        jobOpeningId: saved.jobOpeningId,
                        jobTitle: saved.jobTitle,
                        department: saved.department
                    }
                },
                meta: {
                    draftId,
                    jobTitle: saved.jobTitle
                }
            });
        } catch (auditErr) {
            console.error('Failed to write job publish audit log:', auditErr.message);
        }

        // 7. Email Trigger to HR Head and Managers
        try {
            const db = await getTenantDB(tenantId);
            if (!db.models.User) {
                db.model('User', require('../models/User'));
            }
            const User = db.model('User');
            const { Employee } = await this.getModels(tenantId);
            
            const users = await User.find({
                mainCompanyId: tenantId,
                role: { $in: ['SUPER_ADMIN', 'MAIN_COMPANY_ADMIN', 'main_company_admin', 'hr', 'HR', 'human_resource', 'Admin', 'admin', 'manager'] },
                isActive: true
            }).select('email name').lean();

            const employees = await Employee.find({
                tenant: tenantId,
                status: { $regex: /^active$/i }
            }).lean();

            const hrAndManagers = [];
            const seenEmails = new Set();

            for (const u of users) {
                if (u.email && !seenEmails.has(u.email.toLowerCase())) {
                    seenEmails.add(u.email.toLowerCase());
                    hrAndManagers.push({ email: u.email, name: u.name });
                }
            }

            for (const emp of employees) {
                const isHrOrManager = 
                    ['hr', 'HR', 'human_resource', 'manager', 'admin'].includes(String(emp.role).toLowerCase()) ||
                    String(emp.designation || '').toLowerCase().includes('hr') ||
                    String(emp.designation || '').toLowerCase().includes('manager') ||
                    String(emp.designation || '').toLowerCase().includes('head');

                if (isHrOrManager && emp.email && !seenEmails.has(emp.email.toLowerCase())) {
                    seenEmails.add(emp.email.toLowerCase());
                    hrAndManagers.push({
                        email: emp.email,
                        name: [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.fullName || emp.email
                    });
                }
            }

            const emailService = require('../services/email.service');
            const subject = `[New Job Requisition Published] ${saved.jobTitle} - ${saved.jobOpeningId}`;
            const html = `
                <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                    <div style="background: #1e3a8a; color: #fff; padding: 18px 22px;">
                        <h2 style="margin: 0; font-size: 18px;">New Job Requisition Published</h2>
                    </div>
                    <div style="padding: 22px; color: #111827;">
                        <p>Dear Team,</p>
                        <p>A new job requisition has been successfully created and published in the system.</p>
                        <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 14px 16px; margin: 18px 0;">
                            <p style="margin: 6px 0;"><strong>Job ID:</strong> ${saved.jobOpeningId}</p>
                            <p style="margin: 6px 0;"><strong>Job Title:</strong> ${saved.jobTitle}</p>
                            <p style="margin: 6px 0;"><strong>Department:</strong> ${saved.department}</p>
                            <p style="margin: 6px 0;"><strong>Location:</strong> ${saved.location || s1.location || 'HQ'}</p>
                            <p style="margin: 6px 0;"><strong>Vacancies:</strong> ${saved.vacancy || 1}</p>
                        </div>
                        <p>Please log in to the HRMS portal to review candidates or update requirements.</p>
                        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">This is an automated system notification.</p>
                    </div>
                </div>
            `;

            for (const recipient of hrAndManagers) {
                try {
                    await emailService.sendEmail(recipient.email, subject, html);
                } catch (emailErr) {
                    console.error(`Failed to send job publish email to ${recipient.email}:`, emailErr.message);
                }
            }
        } catch (emailGroupErr) {
            console.error('Failed to notify HR/managers of new job requisition:', emailGroupErr.message);
        }

        return saved;
    }



    // Helper to generate next Job ID
    async generateJobId(tenantId) {
        try {
            const db = await getTenantDB(tenantId);
            const jobIdResult = await companyIdConfig.generateIdInternal({
                tenantId: db.tenantId || db.name, // Assuming db has tenant info
                entityType: 'JOB_REQUISITION',
                increment: true
            });
            return jobIdResult.id;
        } catch (err) {
            console.error('Error generating Job ID:', err);
            return `JOB-${Date.now()}`;
        }
    }

    async createRequirement(tenantId, data, userId) {
        try {
            console.log('[DEBUG] createRequirement START', { tenantId, userId });
            const { Requirement, Position, Department, Designation } = await this.getModels(tenantId);

            // 1. Resolve Position details if positionId provided
            let finalData = { ...data };
            let pos = null;
            if (data.positionId) {
                pos = await Position.findById(data.positionId).lean();
                if (pos) {
                    finalData.position = pos.jobTitle;
                    finalData.jobTitle = pos.jobTitle;
                    finalData.department = pos.department;
                    finalData.departmentId = finalData.departmentId || pos.departmentId;
                    finalData.reportingTo = finalData.reportingTo || pos.reportingTo;
                    // Auto-link hiring status?
                    await Position.findByIdAndUpdate(data.positionId, { hiringStatus: 'Open' });
                }
            }
            if (finalData.gradeId) {
                const gradeSnapshot = await this.resolveGradeSnapshot(tenantId, finalData.gradeId);
                finalData.gradeId = gradeSnapshot.gradeId;
                finalData.grade = gradeSnapshot.grade;
            }

            // 2. Auto-generate Job ID via helper
            const jobOpeningId = await this.generateJobId(tenantId, finalData);
            console.log('[DEBUG] Generated Job ID:', jobOpeningId);

            const isInternal = ['Internal', 'Both'].includes(finalData.visibility);
            const orgAssignment = await resolveOrgAssignment({
                models: { Department, Designation },
                tenantId,
                subCompanyId: finalData.subCompanyId || pos?.subCompanyId,
                branchId: finalData.branchId || pos?.branchId,
                divisionId: finalData.divisionId || pos?.divisionId,
                departmentId: finalData.departmentId || pos?.departmentId,
                designationId: finalData.designationId || pos?.designationId,
                department: finalData.department || pos?.department,
                designation: finalData.designation || finalData.jobTitle || pos?.jobTitle,
                jobTitle: finalData.jobTitle || pos?.jobTitle,
                managerId: finalData.hiringManager || finalData.jobDetails?.hiringManager || finalData.reportingTo || pos?.reportingTo,
                reportingTo: finalData.reportingTo || finalData.jobDetails?.reportingTo || pos?.reportingTo,
            });

            const requirement = new Requirement({
                ...finalData,
                tenant: tenantId,
                jobOpeningId,
                subCompanyId: orgAssignment.subCompanyId || finalData.subCompanyId,
                branchId: orgAssignment.branchId || finalData.branchId,
                divisionId: orgAssignment.divisionId || finalData.divisionId,
                departmentId: orgAssignment.departmentId || finalData.departmentId,
                designationId: orgAssignment.designationId || finalData.designationId,
                department: orgAssignment.department || finalData.department,
                jobDetails: {
                    ...(finalData.jobDetails || {}),
                    hiringManager: finalData.jobDetails?.hiringManager || finalData.hiringManager || orgAssignment.managerId || undefined,
                    reportingTo: finalData.jobDetails?.reportingTo || finalData.reportingTo || orgAssignment.managerId || undefined,
                },
                isInternal,
                createdBy: userId
            });
            return await requirement.save();

        } catch (err) {
            console.error('[CRITICAL ERROR] createRequirement failed:', err);
            throw err; // Re-throw to controller
        }
    }

    async getRequirements(tenantId, query) {
        const { Requirement } = await this.getModels(tenantId);
        const tenantObjectId = mongoose.Types.ObjectId.isValid(String(tenantId))
            ? new mongoose.Types.ObjectId(String(tenantId))
            : tenantId;
        const filter = { tenant: { $in: [tenantObjectId, String(tenantId)] } };

        // Enhance safe filtering logic...
        if (query.status) filter.status = query.status;
        if (query.visibility) filter.visibility = query.visibility;

        if (query && (query.$or || query.visibility || query.status)) {
            Object.assign(filter, query);
            filter.tenant = { $in: [tenantObjectId, String(tenantId)] };
        }

        // Pagination Logic
        const page = parseInt(query.page) || 1;
        const limit = parseInt(query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await Requirement.countDocuments(filter);
        const requirements = await Requirement.find(filter)
            .populate('gradeId', 'name code level')
            .populate('pipelineStages.assignedInterviewers', 'name firstName lastName employeeName employeeId email')
            .sort({ updatedAt: -1 }) // Sort by last updated, newest first
            .skip(skip)
            .limit(limit);

        // Auto-patch missing Job IDs and hydrate pipelineStages for legacy data
        try {
            const updates = requirements.map(async (req) => {
                try {
                    let changed = false;

                    if (!req.jobOpeningId) {
                        console.log(`[Backfill] Generating ID for Requirement ${req._id}`);
                        req.jobOpeningId = await this.generateJobId(tenantId);
                        changed = true;
                    }

                    // Hydrate pipelineStages from workflow if missing
                    if ((!req.pipelineStages || req.pipelineStages.length === 0) && req.workflow && req.workflow.length > 0) {
                        console.log(`[Migration] Hydrating pipelineStages for Requirement ${req._id}`);
                        req.pipelineStages = req.workflow
                            .filter(stage => !['Applied', 'Finalized', 'Rejected'].includes(stage))
                            .map((stage, idx) => {
                                const stageName = String(stage || '').trim();
                                return {
                                    stageId: `stage_${idx + 1}_${stageName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                                    stageName,
                                    stageType: stageName.toLowerCase().includes('interview') ? 'Interview' : 'Round',
                                    orderIndex: idx + 1,
                                    durationMinutes: 30,
                                    mode: 'In-person'
                                };
                            });
                        changed = true;
                    }

                    if (changed) {
                        await req.save();
                    }
                } catch (err) {
                    console.error(`[getRequirements] Failed to patch requirement ${req._id}:`, err.message);
                    // Continue with other requirements even if one fails
                }
            });
            await Promise.all(updates);
        } catch (err) {
            console.error('[getRequirements] Auto-patch failed, continuing anyway:', err.message);
            // Don't throw - return requirements even if patching fails
        }
        // Optimized Bulk Count using Aggregation
        const { Application, Applicant } = await this.getModels(tenantId);
        const requirementIds = requirements.map(r => r._id);

        const [applicantCounts, applicationCounts] = await Promise.all([
            Applicant.aggregate([
                { $match: { requirementId: { $in: requirementIds }, tenant: tenantId } },
                { $group: { _id: "$requirementId", count: { $sum: 1 } } }
            ]),
            Application.aggregate([
                { $match: { jobId: { $in: requirementIds }, tenant: tenantId } },
                { $group: { _id: "$jobId", count: { $sum: 1 } } }
            ])
        ]);

        const appCountMap = new Map(applicantCounts.map(c => [String(c._id), c.count]));
        const applicationCountMap = new Map(applicationCounts.map(c => [String(c._id), c.count]));

        const requirementsWithStats = requirements.map(req => {
            const reqIdStr = String(req._id);
            const count1 = appCountMap.get(reqIdStr) || 0;
            const count2 = applicationCountMap.get(reqIdStr) || 0;
            
            const reqObj = { ...req.toObject(), _id: reqIdStr };
            reqObj.applicantsCount = count1 + count2;
            return reqObj;
        });

        return {
            requirements: requirementsWithStats,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    async getRequirementById(tenantId, id) {
        const { Requirement } = await this.getModels(tenantId);
        return await Requirement.findOne({ _id: id, tenant: tenantId })
            .populate('gradeId', 'name code level')
            .populate('pipelineStages.assignedInterviewers', 'name firstName lastName employeeName employeeId email');
    }

    async updateRequirement(tenantId, id, data, userId) {
        const { Requirement } = await this.getModels(tenantId);
        const reqDoc = await Requirement.findOne({ _id: id, tenant: tenantId });

        if (!reqDoc) {
            throw new Error("Requirement not found");
        }

        if (data.status === 'Closed' && reqDoc.positionId) {
            const { Position } = await this.getModels(tenantId);
            await Position.findByIdAndUpdate(reqDoc.positionId, { hiringStatus: 'Closed' });
        }
        if (data.gradeId) {
            const gradeSnapshot = await this.resolveGradeSnapshot(tenantId, data.gradeId);
            data.gradeId = gradeSnapshot.gradeId;
            data.grade = gradeSnapshot.grade;
        }

        // Use findByIdAndUpdate to perform partial update without validating unrelated fields
        const updates = { ...data, updatedBy: userId };
        delete updates._id;
        delete updates.tenant;
        delete updates.jobCode;
        delete updates.createdAt;
        delete updates.jobOpeningId; // immutable

        return await Requirement.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );
    }

    async submitForApproval(tenantId, id, userId) {
        const { Requirement } = await this.getModels(tenantId);
        const req = await Requirement.findOne({ _id: id, tenant: tenantId });
        if (!req) throw new Error("Requirement not found");

        req.approvalStatus = 'Pending';
        req.status = 'PendingApproval';
        return await req.save();
    }

    async approveReject(tenantId, id, status, remarks, userId) {
        const { Requirement } = await this.getModels(tenantId);
        const req = await Requirement.findOne({ _id: id, tenant: tenantId });
        if (!req) throw new Error("Requirement not found");

        if (status === 'Approved') {
            req.approvalStatus = 'Approved';
            req.approvedBy = userId;
            // Do we auto-open? Maybe not.
        } else if (status === 'Rejected') {
            req.approvalStatus = 'Rejected';
            // req.remarks = remarks;
        }
        return await req.save();
    }

    async publish(tenantId, id, userId) {
        const { Requirement } = await this.getModels(tenantId);
        const req = await Requirement.findOne({ _id: id, tenant: tenantId });
        if (!req) throw new Error("Requirement not found");
        // if (req.approvalStatus !== 'Approved') throw new Error("Job must be approved before publishing");

        req.status = 'Open';
        req.publishedAt = new Date();
        return await req.save();
    }

    async close(tenantId, id, userId) {
        const { Requirement, Position } = await this.getModels(tenantId);
        const req = await Requirement.findOne({ _id: id, tenant: tenantId });
        if (!req) throw new Error("Requirement not found");

        req.status = 'Closed';
        req.closedAt = new Date();
        req.closedBy = userId;
        const saved = await req.save();

        if (req.positionId) {
            await Position.findByIdAndUpdate(req.positionId, { hiringStatus: 'Closed' });
        }
        return saved;
    }

    async deleteRequirement(tenantId, id) {
        const { Requirement } = await this.getModels(tenantId);
        return await Requirement.deleteOne({ _id: id, tenant: tenantId });
    }

    // --- Applicants ---

    async getTenantApplications(tenantId, filters = {}) {
        const { Applicant } = await this.getModels(tenantId);
        const db = await getTenantDB(tenantId);
        const requirementId = String(filters.requirementId || '').trim();
        const hasRequirementFilter = mongoose.Types.ObjectId.isValid(requirementId);

        // Auto-expire offers on every fetch (backend-controlled)
        const now = new Date();
        try {
            await Applicant.updateMany(
                {
                    tenant: tenantId,
                    offerStatus: 'SENT',
                    offerExpiryAt: { $exists: true, $ne: null, $lt: now }
                },
                {
                    $set: { offerStatus: 'EXPIRED', status: 'Offer Expired' },
                    $push: {
                        timeline: {
                            status: 'Offer Expired',
                            message: 'Offer expired automatically (system).',
                            updatedBy: 'System',
                            timestamp: now
                        }
                    }
                }
            );
        } catch (e) {
            console.warn('[RecruitmentService.getTenantApplications] Auto-expiry skipped:', e.message);
        }

        // Defensive: Ensure EmployeeSalarySnapshot is registered for populate to work
        if (!db.models.EmployeeSalarySnapshot) {
            try { db.model('EmployeeSalarySnapshot', require('../models/EmployeeSalarySnapshot')); } catch (e) { }
        }

        const applicantQuery = { tenant: tenantId };
        if (hasRequirementFilter) {
            applicantQuery.requirementId = requirementId;
        }

        // Need to populate correctly
        const applicantData = await Applicant.find(applicantQuery)
            .populate('requirementId', 'jobTitle jobOpeningId visibility department')
            .populate('candidateId', 'name email mobile')
            .populate('salarySnapshotId')
            .sort({ createdAt: -1 })
            .lean();

        let applicationData = [];
        try {
            const { Application } = await this.getModels(tenantId);
            const applicationQuery = { tenant: tenantId };
            if (hasRequirementFilter) {
                applicationQuery.jobId = requirementId;
            }

            const apps = await Application.find(applicationQuery)
                .populate('jobId', 'jobTitle jobOpeningId visibility department')
                .populate('candidateId', 'name email mobile')
                .sort({ createdAt: -1 })
                .lean();

            applicationData = apps.map(app => {
                // Normalize status from NEW model (UPPERCASE) to LEGACY model (Title Case)
                let status = app.status;
                
                // Priority Check: If offer is accepted, we must show it as 'Offer Accepted' regardless of base status (usually OFFERED)
                if (app.offerStatus === 'ACCEPTED') {
                    status = 'Offer Accepted';
                } else {
                    const statusMap = {
                        'APPLIED': 'Applied',
                        'SHORTLISTED': 'Shortlisted',
                        'INTERVIEW': 'Interview',
                        'SELECTED': 'Selected',
                        'OFFERED': 'Offer Issued',
                        'OFFER_PENDING': 'Selected',
                        'OFFER_ACCEPTED': 'Offer Accepted',
                        'JOINED': 'Joined',
                        'REJECTED': 'Rejected',
                        'WITHDRAWN': 'Rejected'
                    };
                    if (statusMap[status]) status = statusMap[status];
                }

                const candidateInfo = app.candidateInfo || {};
                return {
                    ...app,
                    _id: stringifyId(app._id || app.id),
                    requirementId: app.jobId ? {
                        _id: stringifyId(app.jobId),
                        jobTitle: app.jobId.jobTitle,
                        jobOpeningId: app.jobId.jobOpeningId,
                        visibility: app.jobId.visibility,
                        department: app.jobId.department
                    } : stringifyId(app.requirementId),
                    name: app.name || candidateInfo.name,
                    email: app.email || candidateInfo.email,
                    mobile: app.mobile || candidateInfo.mobile,
                    phone: app.phone || candidateInfo.mobile,
                    fatherName: app.fatherName || candidateInfo.fatherName,
                    dob: app.dob || candidateInfo.dob,
                    address: app.address || candidateInfo.address,
                    experience: app.experience || candidateInfo.experience,
                    currentCompany: app.currentCompany || candidateInfo.currentCompany,
                    currentDesignation: app.currentDesignation || candidateInfo.currentDesignation,
                    currentCTC: app.currentCTC || candidateInfo.currentCTC,
                    expectedCTC: app.expectedCTC || candidateInfo.expectedCTC,
                    noticePeriod: app.noticePeriod ?? candidateInfo.noticePeriod,
                    resume: app.resume || candidateInfo.resume,
                    customData: app.customData || candidateInfo.customData || {},
                    status: status // Use normalized status
                };
            });
        } catch (err) {
            console.warn("[RecruitmentService] ApplicationFetch failed:", err.message);
        }

        const applicants = [...applicantData, ...applicationData];

        // Attach BGV status to each applicant.
        // Some BGV cases are employee-linked only and may have null applicationId.
        let bgvByApplicationId = new Map();
        try {
            const { BGVCase } = await getBGVModels(tenantId);
            const bgvCases = await BGVCase.find({
                tenant: tenantId,
                applicationId: { $exists: true, $ne: null }
            })
                .select('_id applicationId overallStatus')
                .lean();

            bgvByApplicationId = new Map(
                bgvCases
                    .filter((b) => b && b.applicationId)
                    .map((b) => [String(b.applicationId), b])
            );
        } catch (e) {
            // Do not fail applicant listing due to optional BGV linkage issues.
            console.warn('[RecruitmentService.getTenantApplications] BGV lookup skipped:', e.message);
        }

        const applicantsWithBGV = applicants.map((app) => {
            const bgv = bgvByApplicationId.get(String(app._id));
            return {
                ...app,
                bgvStatus: bgv ? bgv.overallStatus : 'NOT_INITIATED',
                bgvId: bgv ? bgv._id : null
            };
        });

        return applicantsWithBGV;
    }

    async applyForJob(jobId, candidateId, data) {
        // ... existing legacy code ...
        throw new Error("applyForJob in Service requires tenantId refactoring. Use public controller logic.");
    }

    async applyInternal(tenantId, requirementId, userTokenPayload, referralPayload = null, applicantPayload = null) {
        const db = await getTenantDB(tenantId);
        const Applicant = db.model('Applicant');
        const Requirement = db.model('Requirement');
        if (!db.models.ReferralCode) {
            db.model('ReferralCode', require('../models/ReferralCode'));
        }
        const ReferralCode = db.model('ReferralCode');

        let employeeData = null;

        // 1. Fetch Employee Details if Role is Employee
        if (userTokenPayload.role === 'employee' || userTokenPayload.employeeId) {
            const Employee = db.model('Employee');
            const emp = await Employee.findById(userTokenPayload.id);
            if (!emp) throw new Error("Employee profile not found");

            employeeData = {
                name: `${emp.firstName} ${emp.lastName}`,
                email: emp.email,
                mobile: emp.mobile || 'N/A',
                employeeId: emp.employeeId
            };
        } else {
            // Fallback for non-employees (e.g. Admin testing) - requires email in token
            if (!userTokenPayload.email) throw new Error("User email not found for application");
            employeeData = {
                name: userTokenPayload.name || 'Unknown User',
                email: userTokenPayload.email,
                mobile: 'N/A',
                employeeId: null
            };
        }

        // 2. Check Requirement
        const job = await Requirement.findOne({ _id: requirementId, tenant: tenantId });
        if (!job) throw new Error("Job not found");
        if (job.status !== 'Open') throw new Error("Job is not open");
        if (!['Internal', 'Both'].includes(job.visibility)) throw new Error("This job is not open for internal application");

        // 3. Check Duplicate (Safe layer before index)
        const existing = await Applicant.findOne({
            tenant: tenantId,
            requirementId: requirementId,
            employeeId: userTokenPayload.id
        });
        if (existing) throw new Error("You have already applied for this position");

        // 4. Create Applicant
        const applicationId = await idGenerator.generateApplicationId(db);

        // Default to 'Applied' if no pipeline is defined, else use first stage
        const defaultStatus = (job.pipelineStages && job.pipelineStages.length > 0)
            ? job.pipelineStages[0].stageName
            : 'Applied';

        const firstStageInterviewer = (job.pipelineStages?.[0]?.assignedInterviewers?.[0])
            || job.pipelineStages?.[0]?.assignedInterviewer
            || null;

        const applicant = new Applicant({
            applicationId,
            tenant: tenantId,
            requirementId: requirementId,
            gradeId: job.gradeId || null,
            gradeSnapshot: job.gradeId ? {
                id: job.gradeId,
                name: job.grade || '',
                code: '',
                level: null
            } : undefined,
            employeeId: userTokenPayload.id,
            name: employeeData.name,
            email: employeeData.email,
            mobile: employeeData.mobile,
            status: defaultStatus,
            timeline: [{
                status: defaultStatus,
                message: `Application submitted via Internal Channel (Role: ${userTokenPayload.role})`,
                timestamp: new Date()
            }],
            currentStage: (job.pipelineStages && job.pipelineStages.length > 0) ? {
                stageId: '0',
                stageName: job.pipelineStages[0].stageName,
                stageType: job.pipelineStages[0].stageType,
                enteredAt: new Date(),
                assignedInterviewer: firstStageInterviewer
            } : {
                stageId: '0',
                stageName: 'Applied',
                stageType: 'Screening',
                enteredAt: new Date(),
                assignedInterviewer: null
            },
            pipelineProgress: (job.pipelineStages && job.pipelineStages.length > 0)
                ? job.pipelineStages.map((stage, index) => ({
                    stageId: String(index),
                    stageName: stage.stageName,
                    stageType: stage.stageType,
                    status: index === 0 ? 'In Progress' : 'Pending',
                    assignedInterviewer: (stage.assignedInterviewers?.[0]) || stage.assignedInterviewer || null,
                    enteredAt: index === 0 ? new Date() : null
                }))
                : [{
                    stageId: '0',
                    stageName: 'Applied',
                    stageType: 'Screening',
                    status: 'In Progress',
                    enteredAt: new Date(),
                    assignedInterviewer: null
                }],
            intro: `Internal Application (ID: ${employeeData.employeeId || 'N/A'})`,
            source: 'Internal',
            referral: {
                usedCode: referralPayload?.usedCode ? String(referralPayload.usedCode).trim() : null,
                myCode: referralPayload?.myCode ? String(referralPayload.myCode).trim() : null,
                source: referralPayload?.source ? String(referralPayload.source).trim() : null,
                capturedAt: (referralPayload?.usedCode || referralPayload?.myCode || referralPayload?.source) ? new Date() : null,
                referrerEmployeeId: null,
                referrerName: ''
            }
        });

        // Resolve used referral code -> referrer info
        try {
            const used = applicant.referral?.usedCode ? String(applicant.referral.usedCode).trim().toUpperCase() : '';
            if (used) {
                const refDoc = await ReferralCode.findOne({ tenant: tenantId, code: used })
                    .select('referrerEmployeeId referrerName')
                    .lean();
                if (refDoc?.referrerEmployeeId) {
                    applicant.referral.referrerEmployeeId = refDoc.referrerEmployeeId;
                    applicant.referral.referrerName = String(refDoc.referrerName || '').trim();
                }
            }
        } catch (e) {
            // Never fail applying due to referral resolution
        }

        // Optional extra data from Apply Form (stored on Applicant for HR visibility)
        if (applicantPayload && typeof applicantPayload === 'object') {
            const safeStr = (v) => (v === null || v === undefined) ? '' : String(v).trim();
            const safeBool = (v) => Boolean(v);

            applicant.currentlyWorking = safeBool(applicantPayload.currentlyWorking);
            applicant.isFresher = safeBool(applicantPayload.isFresher);

            if (!applicant.isFresher) {
                applicant.experience = safeStr(applicantPayload.experience);
                applicant.relevantExperience = safeStr(applicantPayload.relevantExperience);
                applicant.currentCompany = safeStr(applicantPayload.currentCompany);
                applicant.currentDesignation = safeStr(applicantPayload.currentDesignation);
                applicant.noticePeriod = safeBool(applicantPayload.noticePeriod);
                applicant.currentCTC = safeStr(applicantPayload.currentCTC);
                applicant.expectedCTC = safeStr(applicantPayload.expectedCTC);
                applicant.takeHome = safeStr(applicantPayload.takeHome);
                applicant.reasonForChange = safeStr(applicantPayload.reasonForChange);
            } else {
                // Fresher: clear experience-like fields so HR doesn't see stale values
                applicant.experience = '';
                applicant.relevantExperience = '';
                applicant.currentCompany = '';
                applicant.currentDesignation = '';
                applicant.noticePeriod = false;
                applicant.currentCTC = '';
                applicant.expectedCTC = safeStr(applicantPayload.expectedCTC);
                applicant.takeHome = '';
                applicant.reasonForChange = safeStr(applicantPayload.reasonForChange);
                applicant.noReferenceReason = 'Fresher - No Work Experience';
            }
        }

        try {
            return await applicant.save();
        } catch (saveErr) {
            if (saveErr.code === 11000) {
                throw new Error("You have already applied for this position");
            }
            throw saveErr;
        }
    }


    async getApplicantApplications(tenantId, userTokenPayload, options = {}) {
        const db = await getTenantDB(tenantId);
        const Applicant = db.model('Applicant');
        const summaryOnly = Boolean(options.summary);
        const normalizedRole = String(userTokenPayload?.role || '').trim().toLowerCase();

        // Resolve Email
        let emailToSearch = String(userTokenPayload?.email || '').trim().toLowerCase();

        // If no email in token (employee case), fetch from DB
        if (
            !emailToSearch &&
            ['employee', 'manager'].includes(normalizedRole || '') &&
            mongoose.Types.ObjectId.isValid(String(userTokenPayload?.id || ''))
        ) {
            const Employee = db.model('Employee');
            const emp = await Employee.findById(userTokenPayload.id);
            if (emp?.email) emailToSearch = String(emp.email).trim().toLowerCase();
        }

        const matchers = [];
        if (emailToSearch) {
            matchers.push({ email: emailToSearch });
        }

        if (
            mongoose.Types.ObjectId.isValid(String(userTokenPayload?.id || '')) &&
            ['employee', 'manager'].includes(normalizedRole)
        ) {
            matchers.push({ employeeId: userTokenPayload.id });
        }

        if (matchers.length === 0) {
            return summaryOnly ? { count: 0 } : [];
        }

        const filter = {
            tenant: tenantId,
            $or: matchers
        };

        if (summaryOnly) {
            const count = await Applicant.countDocuments(filter).maxTimeMS(4000);
            return { count };
        }

        // Only return lightweight fields that ESS screens actually render.
        return await Applicant.find(filter)
            .select('applicationId requirementId status createdAt updatedAt offerStatus offerExpiryAt joiningLetterStatus joiningLetterExpiryAt source referral')
            .populate('requirementId', 'jobTitle department location status jobOpeningId employmentType')
            .sort({ createdAt: -1 })
            .lean()
            .maxTimeMS(4000);
    }

    /**
     * Fetch applicants referred by a specific employee
     */
    async getMyReferrals(tenantId, userTokenPayload) {
        const { Applicant, Employee } = await this.getModels(tenantId);
        const referrerId = userTokenPayload.id;

        if (!mongoose.Types.ObjectId.isValid(referrerId)) {
            return { referrals: [], points: 0 };
        }

        const [referrals, employee] = await Promise.all([
            Applicant.find({
                tenant: tenantId,
                'referral.referrerEmployeeId': referrerId
            })
                .select('name email status createdAt requirementId referral applicationId')
                .populate('requirementId', 'jobTitle department jobOpeningId')
                .sort({ createdAt: -1 })
                .lean(),
            Employee.findById(referrerId).select('referralPoints').lean()
        ]);

        return {
            referrals,
            points: employee?.referralPoints || 0
        };
    }
}

module.exports = new RecruitmentService();
