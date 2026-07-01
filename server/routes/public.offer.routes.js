const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { getModels } = require('../utils/tenantUtils');
const { getWorkflowModels } = require('../services/workflowRuntimeCore.service');
const emailService = require('../services/email.service');
const crypto = require('crypto');

// Helpers
const getAssignmentByToken = async (req, res, token) => {
    const { WorkflowAssignment } = getWorkflowModels(req.tenantDB); // Usually public routes need to search across all tenants, but let's assume we decode tenant from a master DB, or we query the master DB if WorkflowAssignment is there.
    
    // Actually, in multi-tenant, if we don't have the tenant context, we have to find the tenant. 
    // We can inject `tenantId` in the magic token or just search all DBs.
    // For now, let's assume we use the default DB or tenant context is handled.
    // Wait, public routes might not have `req.tenantDB` initialized correctly.
    // Let's use the core DB to resolve the tenant if necessary, or just rely on a unified `WorkflowAssignment` if it's stored centrally.
    // For simplicity, assume `req.tenantDB` is available if we use the domain middleware, OR we search.
    
    if(!req.tenantDB) {
        throw new Error('Tenant DB context missing in public route.');
    }

    const assignment = await WorkflowAssignment.findOne({ magicToken: token }).lean();
    return assignment;
};

const ensureRequirementModel = (tenantDB) => {
    if (tenantDB && !tenantDB.models.Requirement) {
        tenantDB.model('Requirement', require('../models/Requirement'));
    }
};

const valueFromMap = (source, key) => {
    if (!source) return undefined;
    if (typeof source.get === 'function') return source.get(key);
    return source[key];
};

const pickFirst = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

const parseMoneyNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const numeric = Number(String(value).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(numeric) ? numeric : null;
};

const formatPercentageIncrease = (currentValue, offerValue) => {
    const current = parseMoneyNumber(currentValue);
    const offer = parseMoneyNumber(offerValue);
    if (!current || !offer) return null;
    const percentage = ((offer - current) / current) * 100;
    return `${percentage.toFixed(2)}%`;
};

const displayName = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    return value.name || value.departmentName || value.title || value.label || null;
};

const customValue = (applicant, key) => (
    applicant?.customData?.[key] ||
    applicant?.metadata?.[key] ||
    applicant?.aiParsedData?.[key]
);

const formatObjectId = (value) => value ? String(value) : null;

const buildCandidateDetails = (applicant, letter) => {
    const requirement = applicant?.requirementId || {};
    const salarySnapshot = applicant?.salarySnapshotId || applicant?.salarySnapshot || {};
    
    // Safely retrieve customData object and generatedVariables from letter snapshots
    let customDataObj = {};
    if (letter?.snapshotData) {
        if (typeof letter.snapshotData.get === 'function') {
            customDataObj = letter.snapshotData.get('customData') || {};
        } else {
            customDataObj = letter.snapshotData.customData || {};
        }
    }

    const val = (key) => {
        let res;
        // Search customDataObj first
        if (customDataObj) {
            if (typeof customDataObj.get === 'function') {
                res = customDataObj.get(key);
            } else {
                res = customDataObj[key];
            }
        }
        if (res !== undefined && res !== null && res !== '') return res;
        
        // Search generatedVariables
        if (letter?.generatedVariables) {
            if (typeof letter.generatedVariables.get === 'function') {
                res = letter.generatedVariables.get(key);
            } else {
                res = letter.generatedVariables[key];
            }
        }
        if (res !== undefined && res !== null && res !== '') return res;

        // Search snapshotData
        if (letter?.snapshotData) {
            if (typeof letter.snapshotData.get === 'function') {
                res = letter.snapshotData.get(key);
            } else {
                res = letter.snapshotData[key];
            }
        }
        if (res !== undefined && res !== null && res !== '') return res;

        // Search applicant document
        if (applicant) {
            res = applicant[key];
        }
        return res;
    };

    // Offered CTC
    const offeredCtc = pickFirst(
        salarySnapshot.annualCTC,
        salarySnapshot.ctc,
        salarySnapshot.ctcYearly,
        val('salary_ctc_yearly'),
        val('salary_ctc'),
        val('ctcYearly'),
        val('annualCTC'),
        val('ctc'),
        val('offer_ctc'),
        val('offerCTC'),
        val('offer ctc'),
        applicant?.ctcYearly,
        applicant?.expectedCTC,
        applicant?.currentCTC
    );

    // Current CTC
    const currentCtc = pickFirst(
        applicant?.currentCTC,
        val('current_ctc'),
        val('currentCTC'),
        val('current ctc'),
        customValue(applicant, 'currentCTC'),
        customValue(applicant, 'currentCtc'),
        customValue(applicant, 'current_ctc')
    );

    // Offered Department
    const offerDepartment = pickFirst(
        displayName(requirement?.department),
        displayName(applicant?.offerDepartment),
        val('department'),
        val('offerDepartment'),
        val('offer_department'),
        val('offer department'),
        customValue(applicant, 'offerDepartment'),
        customValue(applicant, 'department'),
        displayName(applicant?.department)
    );

    // Current Department
    const currentDepartment = pickFirst(
        displayName(applicant?.currentDepartment),
        val('current_department'),
        val('currentDepartment'),
        val('current department'),
        customValue(applicant, 'currentDepartment'),
        customValue(applicant, 'current_department')
    );

    // Offered Designation
    const offerDesignation = pickFirst(
        val('desingnation'), // handle typos in templates
        val('designation'),
        val('offerDesignation'),
        val('offer_designation'),
        val('offer designation'),
        requirement?.jobTitle,
        customValue(applicant, 'offerDesignation'),
        customValue(applicant, 'offer_designation'),
        applicant?.designation
    );

    // Current Designation
    const currentDesignation = pickFirst(
        applicant?.currentDesignation,
        val('current_designation'),
        val('currentDesignation'),
        val('current designation'),
        customValue(applicant, 'currentDesignation'),
        customValue(applicant, 'current_designation')
    );

    // Hike Percentage & CTC Normalization
    const currentCtcNum = parseMoneyNumber(currentCtc);
    const offeredCtcNum = parseMoneyNumber(offeredCtc);
    
    let displayCurrentCtc = currentCtc;
    let displayOfferedCtc = offeredCtc;
    let percentageIncrease = val('percentage_increase') || val('percentageIncrease') || val('% increase') || val('% increate');
    
    if (currentCtcNum && offeredCtcNum) {
        // Threshold: 150,000 to differentiate monthly vs yearly
        const isCurrentMonthly = currentCtcNum <= 150000;
        const isOfferYearly = offeredCtcNum > 150000;
        
        let normalizedCurrent = currentCtcNum;
        let normalizedOffer = offeredCtcNum;
        
        if (isCurrentMonthly && isOfferYearly) {
            normalizedOffer = Math.round(offeredCtcNum / 12);
            displayOfferedCtc = `₹${normalizedOffer.toLocaleString('en-IN')} / Month`;
            displayCurrentCtc = `₹${currentCtcNum.toLocaleString('en-IN')} / Month`;
        } else if (!isCurrentMonthly && !isOfferYearly) {
            normalizedOffer = Math.round(offeredCtcNum * 12);
            displayOfferedCtc = `₹${normalizedOffer.toLocaleString('en-IN')} / Year`;
            displayCurrentCtc = `₹${currentCtcNum.toLocaleString('en-IN')} / Year`;
        } else if (isCurrentMonthly && !isOfferYearly) {
            displayOfferedCtc = `₹${offeredCtcNum.toLocaleString('en-IN')} / Month`;
            displayCurrentCtc = `₹${currentCtcNum.toLocaleString('en-IN')} / Month`;
        } else {
            displayOfferedCtc = `₹${offeredCtcNum.toLocaleString('en-IN')} / Year`;
            displayCurrentCtc = `₹${currentCtcNum.toLocaleString('en-IN')} / Year`;
        }
        
        const percentage = ((normalizedOffer - normalizedCurrent) / normalizedCurrent) * 100;
        percentageIncrease = `${percentage.toFixed(2)}%`;
    } else {
        if ((!percentageIncrease || String(percentageIncrease).toUpperCase().trim() === 'N/A' || String(percentageIncrease).trim() === '') && currentCtc && offeredCtc) {
            percentageIncrease = formatPercentageIncrease(currentCtc, offeredCtc);
        }
    }

    return {
        id: formatObjectId(applicant?._id),
        applicationId: applicant?.applicationId || null,
        name: applicant?.name || 'Candidate',
        email: applicant?.email || null,
        mobile: applicant?.mobile || null,
        role: offerDesignation || currentDesignation || 'Role',
        designation: offerDesignation || currentDesignation || null,
        currentDepartment,
        department: offerDepartment,
        offerDepartment,
        grade: applicant?.gradeSnapshot?.name || applicant?.grade || requirement?.grade || null,
        jobCategory: applicant?.jobCategory || requirement?.jobDetails?.jobType || null,
        workLocation: applicant?.workLocation || applicant?.location || null,
        workMode: requirement?.jobDetails?.workMode || null,
        offeredCtc: displayOfferedCtc,
        offerCtc: displayOfferedCtc,
        percentageIncrease,
        ctcMonthly: pickFirst(salarySnapshot.monthlyCTC, salarySnapshot.ctcMonthly, val('salary_ctc_monthly'), val('ctcMonthly')),
        takeHomeMonthly: pickFirst(salarySnapshot.breakdown?.netPay, salarySnapshot.summary?.netPay, salarySnapshot.takeHomeMonthly, val('salary_take_home_monthly'), applicant?.takeHome),
        expectedCTC: applicant?.expectedCTC || null,
        currentCTC: displayCurrentCtc || null,
        experience: applicant?.relevantExperience || applicant?.experience || null,
        currentCompany: applicant?.currentCompany || null,
        currentDesignation: currentDesignation || null,
        offerDesignation,
        noticePeriod: applicant?.noticePeriod ? 'Yes' : 'No',
        joiningDate: applicant?.joiningDate || val('joining_date') || val('joiningDate') || null,
        status: applicant?.status || null,
        offerStatus: applicant?.offerStatus || null
    };
};

const getOfferBundle = async (req, token) => {
    if (!req.tenantDB) {
        const error = new Error('Tenant DB context missing in public route.');
        error.status = 400;
        throw error;
    }

    ensureRequirementModel(req.tenantDB);

    const { WorkflowAssignment, WorkflowInstance } = getWorkflowModels(req.tenantDB);
    const { GeneratedLetter, Applicant } = getModels(req);

    const assignment = await WorkflowAssignment.findOne({ magicToken: token });
    if (!assignment) {
        const error = new Error('Invalid or expired link.');
        error.status = 404;
        throw error;
    }

    const instance = await WorkflowInstance.findById(assignment.instanceId);
    if (!instance) {
        const error = new Error('Workflow instance not found.');
        error.status = 404;
        throw error;
    }

    const letter = await GeneratedLetter.findById(instance.entityId);
    if (!letter) {
        const error = new Error('Offer letter not found.');
        error.status = 404;
        throw error;
    }

    const applicantId = instance.contextSnapshot?.applicantId || letter.applicantId;
    const applicant = applicantId
        ? await Applicant.findById(applicantId).populate('requirementId').populate('salarySnapshotId')
        : null;

    return { assignment, instance, letter, applicant };
};

const resolveOfferDocumentPath = (letter) => {
    const candidates = [
        letter?.pdfPath,
        letter?.generatedPdf,
        letter?.pdfUrl,
        letter?.htmlPath,
        letter?.generatedHtml,
        letter?.docxPath,
        letter?.generatedDocx
    ].filter(Boolean);

    const uploadRoot = path.resolve(__dirname, '../uploads');
    const allowedRoots = [
        uploadRoot,
        path.resolve(__dirname, '../uploads/offers'),
        path.resolve(__dirname, '../uploads/letter-cache')
    ];

    for (const rawPath of candidates) {
        let candidate = String(rawPath).trim();
        if (!candidate || /^https?:\/\//i.test(candidate)) continue;

        candidate = candidate.split('#')[0].split('?')[0].replace(/\\/g, path.sep);
        candidate = candidate.replace(/^\/+/, '');
        candidate = candidate.replace(/^uploads[\\/]/i, '');

        const resolved = path.isAbsolute(candidate)
            ? path.resolve(candidate)
            : path.resolve(uploadRoot, candidate);

        const insideAllowedRoot = allowedRoots.some((root) => {
            const relative = path.relative(root, resolved);
            return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
        });

        if (insideAllowedRoot && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
            return resolved;
        }
    }

    return null;
};

// 1. Pixel Tracking Endpoint
router.get('/pixel/:assignmentId.png', async (req, res) => {
    try {
        if (req.tenantDB) {
            const { WorkflowAssignment } = getWorkflowModels(req.tenantDB);
            await WorkflowAssignment.updateOne(
                { _id: req.params.assignmentId, emailOpenedAt: null },
                { $set: { emailOpenedAt: new Date() } }
            );
        }
    } catch (e) {
        console.error('Pixel tracking error:', e);
    }
    
    // Return a 1x1 transparent GIF
    const img = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': img.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private'
    });
    res.end(img);
});

// 1b. Candidate Pixel Tracking Endpoint
router.get('/candidate-pixel/:applicantId.png', async (req, res) => {
    try {
        if (req.tenantDB) {
            const { Applicant } = getModels(req);
            const applicant = await Applicant.findById(req.params.applicantId);
            if (applicant && !applicant.offerEmailOpenedAt) {
                applicant.offerEmailOpenedAt = new Date();
                if (!applicant.timeline) applicant.timeline = [];
                applicant.timeline.push({
                    status: 'Offer Email Opened',
                    message: 'Candidate opened the offer letter email.',
                    updatedBy: 'System',
                    timestamp: new Date()
                });
                await applicant.save();
                
                const { syncToTracker } = require('../utils/trackerSync');
                await syncToTracker(req, {
                    applicant,
                    status: applicant.status,
                    stage: 'Offer',
                    remarks: 'Candidate opened the offer letter email.',
                    actionBy: 'System'
                });
            }
        }
    } catch (e) {
        console.error('Candidate pixel tracking error:', e);
    }
    
    // Return a 1x1 transparent GIF
    const img = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': img.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private'
    });
    res.end(img);
});

// 2. Get Offer Details via Magic Token
router.get('/:token', async (req, res) => {
    try {
        const { assignment, instance, letter, applicant } = await getOfferBundle(req, req.params.token);
        
        let sidebarVisibility = null;
        try {
            if (assignment && assignment.stepName) {
                const mongoose = require('mongoose');
                const EmailTemplate = mongoose.model('EmailTemplate');
                const triggerType = `OFFER_APPROVAL_${assignment.stepName.toUpperCase().replace(/\s+/g, '_')}`;
                let template = await EmailTemplate.findOne({ 
                    tenantId: assignment.tenantId, 
                    triggerType, 
                    isActive: true 
                }).lean();
                
                if (!template) {
                    template = await EmailTemplate.findOne({
                        tenantId: assignment.tenantId,
                        name: new RegExp(assignment.stepName.trim(), 'i'),
                        isActive: true
                    }).lean();
                }
                
                if (!template) {
                    template = await EmailTemplate.findOne({
                        tenantId: assignment.tenantId,
                        customTriggerName: assignment.stepName.trim(),
                        isActive: true
                    }).lean();
                }
                
                if (template && template.sidebarVisibility) {
                    sidebarVisibility = template.sidebarVisibility;
                }
            }
        } catch (err) {
            console.error('Error resolving template sidebar visibility:', err);
        }
        
        let documentUrl = null;
        let documentAvailable = false;
        
        const candidates = [
            letter?.pdfPath,
            letter?.generatedPdf,
            letter?.pdfUrl,
            letter?.htmlPath,
            letter?.generatedHtml,
            letter?.docxPath,
            letter?.generatedDocx
        ].filter(Boolean);

        for (const rawPath of candidates) {
            if (/^https?:\/\//i.test(rawPath)) {
                documentUrl = rawPath;
                documentAvailable = true;
                break;
            }
        }
        
        if (!documentAvailable) {
            const localPath = resolveOfferDocumentPath(letter);
            if (localPath) {
                documentUrl = `/api/public/offer/${req.params.token}/document`;
                documentAvailable = true;
            }
        }

        res.json({
            success: true,
            assignment: {
                id: assignment._id,
                status: assignment.status,
                stepName: assignment.stepName,
                role: assignment.stepName
            },
            offer: {
                id: letter._id,
                documentUrl: documentUrl || `/api/public/offer/${req.params.token}/document`,
                pdfUrl: documentUrl || `/api/public/offer/${req.params.token}/document`,
                status: letter.approvalStatus,
                workflowStatus: letter.workflowStatus,
                generatedAt: letter.createdAt,
                documentAvailable
            },
            candidate: buildCandidateDetails(applicant, letter),
            workflow: {
                currentStep: instance.currentStepKey,
                currentStepOrder: instance.currentStepOrder,
                status: instance.status
            },
            sidebarVisibility
        });

    } catch (error) {
        console.error('Error fetching public offer:', error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
});

// 2b. Public offer document preview through a token-scoped API endpoint.
router.get('/:token/document', async (req, res) => {
    try {
        const { letter } = await getOfferBundle(req, req.params.token);
        const documentPath = resolveOfferDocumentPath(letter);

        if (!documentPath) {
            return res.status(404).json({ success: false, message: 'Offer document file not found.' });
        }

        const extension = path.extname(documentPath).toLowerCase();
        const contentType = extension === '.html'
            ? 'text/html; charset=utf-8'
            : extension === '.docx'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'application/pdf';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${path.basename(documentPath)}"`);
        return res.sendFile(documentPath);
    } catch (error) {
        console.error('Error serving public offer document:', error);
        res.status(error.status || 500).json({ success: false, message: error.message });
    }
});

// 3. Approve / Reject Action
router.post('/:token/action', async (req, res) => {
    try {
        const { action, remark } = req.body;
        if (!['APPROVED', 'REJECTED'].includes(action)) {
            return res.status(400).json({ success: false, message: 'Invalid action.' });
        }
        if (action === 'REJECTED' && !remark) {
            return res.status(400).json({ success: false, message: 'Remark is required for rejection.' });
        }

        const { WorkflowAssignment, WorkflowInstance } = getWorkflowModels(req.tenantDB);
        const { GeneratedLetter, Applicant } = getModels(req);

        const assignment = await WorkflowAssignment.findOne({ magicToken: req.params.token, status: 'PENDING' });
        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Link expired or already actioned.' });
        }

        assignment.status = action;
        assignment.comment = remark;
        if (action === 'REJECTED') {
            assignment.rejectReason = remark;
        }
        assignment.actionAt = new Date();
        await assignment.save();

        const instance = await WorkflowInstance.findById(assignment.instanceId);
        const letter = await GeneratedLetter.findById(instance.entityId);

        if (action === 'REJECTED') {
            instance.status = 'FAILED';
            await instance.save();

            letter.workflowStatus = 'REJECTED';
            letter.approvalStatus = 'REJECTED';
            await letter.save();

            const applicant = await Applicant.findById(instance.contextSnapshot.applicantId).populate('requirementId');
            if (applicant) {
                if (!applicant.timeline) applicant.timeline = [];
                applicant.timeline.push({
                    status: 'Offer Rejected',
                    message: `Offer approval rejected by ${assignment.stepName}. Reason: ${remark}`,
                    updatedBy: 'System',
                    timestamp: new Date()
                });
                await applicant.save();
                
                const { syncToTracker } = require('../utils/trackerSync');
                await syncToTracker(req, {
                    applicant,
                    status: 'Offer Rejected',
                    stage: 'Offer',
                    remarks: `Offer approval rejected by ${assignment.stepName}.`,
                    actionBy: assignment.stepName
                });
            }

            return res.json({ success: true, message: 'Offer has been rejected.' });
        }

        // APPROVED
        // Check if there are more steps in custom workflow
        const customDef = instance.contextSnapshot?.customDefinition;
        if (customDef && customDef.steps) {
            const currentIndex = customDef.steps.findIndex(s => s.key === assignment.stepKey);
            const nextStep = customDef.steps[currentIndex + 1];

            if (nextStep) {
                // Assign next step
                const magicToken = `${instance.tenantId}_${crypto.randomBytes(16).toString('hex')}`;
                const nextAssignment = await WorkflowAssignment.create({
                    tenantId: instance.tenantId,
                    instanceId: instance._id,
                    stepKey: nextStep.key,
                    stepName: nextStep.name,
                    stepOrder: nextStep.order,
                    assigneeEmail: nextStep.approverEmail,
                    magicToken: magicToken,
                    status: 'PENDING',
                    dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                });

                instance.currentStepKey = nextStep.key;
                instance.currentStepOrder = nextStep.order;
                await instance.save();

                // Send email to next approver
                const approvalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/public/offer-approval/${magicToken}`;
                const applicant = await Applicant.findById(instance.contextSnapshot.applicantId).populate('requirementId');
                
                if (applicant) {
                    if (!applicant.timeline) applicant.timeline = [];
                    applicant.timeline.push({
                        status: 'Offer Approval In Progress',
                        message: `Offer approved by ${assignment.stepName}. Forwarded to ${nextStep.name}.`,
                        updatedBy: 'System',
                        timestamp: new Date()
                    });
                    await applicant.save();

                    const { syncToTracker } = require('../utils/trackerSync');
                    await syncToTracker(req, {
                        applicant,
                        status: 'Offer Approval In Progress',
                        stage: 'Offer',
                        remarks: `Offer approved by ${assignment.stepName}. Forwarded to ${nextStep.name}.`,
                        actionBy: assignment.stepName
                    });
                }

                const { CompanyProfile, EmailTemplate } = getModels(req);
                const companyProfile = await CompanyProfile.findOne({ tenantId: instance.tenantId });
                const companyName = companyProfile?.companyName || 'Our Company';

                const pdfPath = path.isAbsolute(letter.pdfPath) ? letter.pdfPath : path.join(__dirname, '../uploads', letter.pdfPath);

                let customTemplate = null;
                if (EmailTemplate) {
                    try {
                        const triggerType = `OFFER_APPROVAL_${nextStep.name.toUpperCase().replace(/\s+/g, '_')}`;
                        let template = await EmailTemplate.findOne({ tenantId: instance.tenantId, triggerType, isActive: true });
                        if (!template) {
                            template = await EmailTemplate.findOne({
                                tenantId: instance.tenantId,
                                name: new RegExp(nextStep.name.trim(), 'i'),
                                isActive: true
                            });
                        }
                        if (!template) {
                            template = await EmailTemplate.findOne({
                                tenantId: instance.tenantId,
                                customTriggerName: nextStep.name.trim(),
                                isActive: true
                            });
                        }
                        if (template) customTemplate = template;
                    } catch (e) {}
                }

                await emailService.sendOfferApprovalRequestEmail(
                    nextStep.approverEmail,
                    applicant?.name || 'Candidate',
                    applicant?.requirementId?.jobTitle || 'Role',
                    companyName,
                    pdfPath,
                    approvalUrl,
                    nextAssignment._id,
                    {
                        ctcYearly: applicant?.ctcYearly || applicant?.expectedCTC || applicant?.currentCTC,
                        department: applicant?.department || applicant?.requirementId?.department,
                        joiningDate: applicant?.joiningDate,
                        applicant: applicant
                    },
                    nextStep.name, // approverRole
                    instance.tenantId, // tenantId
                    customTemplate
                );

                return res.json({ success: true, message: 'Approved. Forwarded to next approver.' });
            }
        }

        // Final step approved (CEO)
        instance.status = 'APPROVED';
        await instance.save();

        letter.workflowStatus = 'APPROVED';
        letter.approvalStatus = 'APPROVED';
        letter.status = 'generated'; // Set status to generated so it is active
        await letter.save();

        // Send the final letter to candidate automatically!
        const applicant = await Applicant.findById(instance.contextSnapshot.applicantId).populate('requirementId');
        if (applicant) {
            // Update applicant status and details
            applicant.status = 'Offer Issued';
            applicant.offerStatus = 'SENT'; // Mark as sent to candidate
            if (!applicant.timeline) applicant.timeline = [];
            applicant.timeline.push({
                status: 'Offer Issued',
                message: 'Offer letter has been approved by CEO and sent to candidate.',
                updatedBy: 'System',
                timestamp: new Date()
            });
            await applicant.save();
            
            const { syncToTracker } = require('../utils/trackerSync');
            await syncToTracker(req, {
                applicant,
                status: 'Offer Issued',
                stage: 'Offer',
                remarks: 'Offer letter has been approved by CEO and sent to candidate.',
                actionBy: 'System'
            });

            // Fetch company profile for company name
            const { CompanyProfile, Notification, EmailTemplate } = getModels(req);
            const companyProfile = await CompanyProfile.findOne({ tenantId: instance.tenantId });
            const companyName = companyProfile?.companyName || 'Gitakshmi Technologies';
            
            const pdfPath = path.isAbsolute(letter.pdfPath) ? letter.pdfPath : path.join(__dirname, '../uploads', letter.pdfPath);

            if (applicant.email) {
                let customHtml = null;
                try {
                    const template = await EmailTemplate.findOne({ tenantId: instance.tenantId, triggerType: 'OFFER_LETTER', isActive: true });
                    if (template) customHtml = template.bodyHtml;
                } catch (e) {}

                await emailService.sendOfferLetterEmail(
                    applicant.email,
                    applicant.name,
                    applicant.requirementId?.jobTitle || 'Role',
                    companyName,
                    pdfPath,
                    customHtml,
                    applicant,
                    instance.tenantId
                );
            }

            // Create notification for candidate
            if (applicant.candidateId && Notification) {
                await Notification.create({
                    tenant: instance.tenantId,
                    receiverId: applicant.candidateId,
                    receiverRole: 'candidate',
                    entityType: 'OfferLetter',
                    entityId: letter._id,
                    title: 'Offer Letter Issued',
                    message: `Congratulations! Your offer letter for ${applicant.requirementId?.jobTitle || 'Role'} has been issued. Please check your email or download it from here.`,
                    isRead: false
                });
            }
        }

        res.json({ success: true, message: 'Offer fully approved and sent to candidate!' });

    } catch (error) {
        console.error('Error in public offer action:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
