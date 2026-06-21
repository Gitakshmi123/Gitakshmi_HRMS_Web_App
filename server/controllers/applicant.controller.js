const mongoose = require('mongoose');
const Tesseract = require('tesseract.js'); // For OCR
const path = require('path');
const pdfParse = require('pdf-parse');

// AI PROMPT
const RESUME_PARSER_PROMPT = `You are an AI assistant used in an HRMS system. 

Your job is to read raw OCR resume text and extract correct candidate details.

Rules:
- Extract only what is clearly present in the text
- Do not guess or invent any information
- If a value is missing, return null
- Return ONLY valid JSON
- No explanation, no extra text
`;
const EmailService = require('../services/email.service');
const SalaryEngine = require('../services/salaryEngine');
const fs = require('fs');
const dayjs = require('dayjs');
const { syncToTracker } = require('../utils/trackerSync');
const ResumeParserService = require('../services/ResumeParser.service');
const companyIdConfig = require('./companyIdConfig.controller');

function getModels(req) {
    if (!req.tenantDB) throw new Error("Tenant database connection not available");
    const db = req.tenantDB;
    
    const safeGetModel = (modelName, modelPath) => {
        return db.models[modelName] || db.model(modelName, require(`../models/${modelPath || modelName}`));
    };

    return {
        Applicant: safeGetModel("Applicant"),
        SalaryTemplate: safeGetModel("SalaryTemplate"),
        CompanyProfile: safeGetModel("CompanyProfile"),
        TrackerCandidate: safeGetModel("TrackerCandidate"),
        CandidateStatusLog: safeGetModel("CandidateStatusLog"),
        Requirement: safeGetModel("Requirement"),
        Employee: safeGetModel("Employee")
    };
}

exports.applyJob = async (req, res) => {
    try {
        const { jobId } = req.body;
        // Check file
        if (!req.file) return res.status(400).json({ message: "Resume file is required" });
        if (!jobId) return res.status(400).json({ message: "Job ID is required" });

        // console.log(`[APPLY_JOB] Processing application for Job ${jobId}`);

        // 2. Get Tenant Context & Fetch Job Details
        const { Applicant, Requirement } = getModels(req);
        const job = await Requirement.findById(jobId).select('jobTitle description skills minExperience education preferredSkills');
        const jobTitle = job?.jobTitle || "";
        const jobDesc = job?.description || "";

        // 1. Parse Resume (OCR / Text)
        let rawText = "";
        try {
            rawText = await ResumeParserService.parseResume(req.file.path, req.file.mimetype);
        } catch (e) {
            console.error("[APPLY_JOB] Resume Parsing Failed:", e.message);
            // We continue? If parsing fails, we can't do much. But maybe we save file and manual entry.
            // Let's allow rawText to be empty but log error.
        }

        // 2. AI Extraction
        const AIExtractionService = require('../services/AIExtraction.service'); // Lazy load
        let structuredData = {};
        try {
            structuredData = await AIExtractionService.extractData(rawText, jobTitle, jobDesc);
        } catch (e) {
            console.error("[APPLY_JOB] AI Extraction Failed:", e.message);
        }

        // 3. Calculate Match Score
        const MatchingEngine = require('../services/MatchingEngine.service');
        let matchResult = { totalScore: 0, breakdown: {}, matchedSkills: [], missingSkills: [] };
        try {
            matchResult = await MatchingEngine.calculateMatchScore(job, structuredData);
        } catch (e) {
            console.error("[APPLY_JOB] Matching Engine Failed:", e.message);
        }

        // 4. Create Applicant
        const appIdResult = await companyIdConfig.generateIdInternal({
            tenantId: req.tenantId,
            entityType: 'APPLICATION',
            increment: true
        });

        // Cloudinary: Upload resume
        let resumeUrl = req.file.filename; // default to local filename
        const CloudinaryService = require("../services/CloudinaryService");
        if (CloudinaryService.isConfigured()) {
            try {
                const cloudRes = await CloudinaryService.uploadFile(
                    req.file.path,
                    `hrms/${req.tenantId}/resumes/${jobId}`,
                    false // Don't cleanup yet if other logic needs the local file (like OCR)
                );
                resumeUrl = cloudRes.url;
            } catch (err) {
                console.error("[APPLY_JOB] Resume cloud upload failed:", err.message);
            }
        }

        const applicant = new Applicant({
            applicationId: appIdResult.id,
            requirementId: jobId,
            gradeId: job.gradeId || null,
            gradeSnapshot: job.gradeId ? {
                id: job.gradeId,
                name: job.grade || '',
                code: '',
                level: null
            } : undefined,
            tenant: req.tenantId,
            name: structuredData.fullName || "Unknown Candidate",
            email: structuredData.email || "unknown@email.com",
            mobile: structuredData.phone || "",
            resume: resumeUrl,

            // AI Fields
            rawOCRText: rawText,
            aiParsedData: structuredData,
            parsedSkills: structuredData.skills || [],
            parsingStatus: rawText ? 'Completed' : 'Failed',

            // MATCHING ENGINE RESULTS
            matchScore: matchResult.totalScore,
            matchBreakdown: matchResult.breakdown,
            matchedSkills: matchResult.matchedSkills,
            missingSkills: matchResult.missingSkills,

            // Manual/Defaults
            experience: structuredData.totalExperience || "",
            currentCompany: structuredData.currentCompany || "", // AI should return this if possible, else "N/A"

            status: 'Applied',
            source: 'External',
        });

        await applicant.save();

        // Cleanup local file AFTER save if cloud was used
        if (CloudinaryService.isConfigured()) {
            try { fs.unlinkSync(req.file.path); } catch (e) { }
        }

        res.status(201).json({
            success: true,
            message: "Application submitted successfully",
            applicantId: applicant._id,
            profile: structuredData,
            matchPercent: matchResult.totalScore,
            matchBreakdown: matchResult.breakdown
        });


    } catch (error) {
        console.error("[APPLY_JOB] Error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.updateApplicantStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rating, feedback } = req.body;
        if (!status) return res.status(400).json({ message: "Status is required" });

        const { Applicant, TrackerCandidate, CandidateStatusLog, Employee } = getModels(req);
        const applicant = await Applicant.findById(id).populate('requirementId', 'jobTitle');
        if (!applicant) return res.status(404).json({ message: "Applicant not found" });

        const oldStatus = applicant.status;
        applicant.status = status;

        if (!applicant.timeline) applicant.timeline = [];

        // --- REFERRAL POINTS LOGIC ---
        if (status === 'Hired' && oldStatus !== 'Hired' && applicant.referral?.referrerEmployeeId) {
            try {
                const pointsToGive = 1000;
                const referrer = await Employee.findById(applicant.referral.referrerEmployeeId);
                if (referrer) {
                    referrer.referralPoints = (referrer.referralPoints || 0) + pointsToGive;
                    await referrer.save();

                    applicant.timeline.push({
                        status: 'Referral Reward',
                        message: `Referrer ${referrer.firstName} ${referrer.lastName} earned ${pointsToGive} points!`,
                        updatedBy: 'System',
                        timestamp: new Date()
                    });
                }
            } catch (err) {
                console.error("Failed to credit referral points:", err.message);
            }
        }

        const autoMessages = {
            'Shortlisted': 'Candidate has been shortlisted for further rounds.',
            'Interview': 'Candidate moved to interview stage.',
            'HR Round': 'Candidate has been moved to HR interview round.',
            'Selected': 'Candidate has been selected for the position.',
            'Rejected': 'Application has been rejected.',
            'Finalized': 'Application has been finalized.',
            'Hired': 'Candidate has joined the company.'
        };

        applicant.timeline.push({
            status: status,
            message: feedback || autoMessages[status] || `Application status updated to ${status}`,
            updatedBy: req.user?.name || "HR",
            timestamp: new Date()
        });

        // --- SYNC TO TRACKER ---
        try {
            let tc = await TrackerCandidate.findOne({ email: applicant.email, tenant: req.tenantId });
            if (tc) {
                tc.currentStatus = status;
                // Simple stage mapping
                if (status === 'Selected') tc.currentStage = 'Final';
                else if (status.includes('Interview')) tc.currentStage = 'Technical';
                await tc.save();

                // Add log to tracker
                await new CandidateStatusLog({
                    candidateId: tc._id,
                    status: status,
                    stage: tc.currentStage,
                    actionBy: req.user?.name || 'HR',
                    remarks: feedback || `Status synchronized from Applicant list: ${status}`,
                    actionDate: new Date()
                }).save();
            }
        } catch (trackerErr) {
            console.error("Tracker sync failed:", trackerErr.message);
        }

        if (rating || feedback) {
            applicant.reviews.push({
                stage: status,
                rating: rating,
                feedback: feedback,
                interviewerName: req.user?.name || 'HR Team',
                createdAt: new Date()
            });
        }

        await applicant.save();

        const skipGenericEmailStatuses = ['Interview Scheduled', 'Interview Rescheduled'];
        if (oldStatus !== status && !skipGenericEmailStatuses.includes(status) && !req.body.skipEmail) {
            try {
                await EmailService.sendApplicationStatusEmail(
                    applicant.email,
                    applicant.name,
                    applicant.requirementId?.jobTitle || 'Job Application',
                    applicant._id,
                    status,
                    feedback,
                    rating,
                    req.tenantId
                );
            } catch (emailErr) {
                console.error("Email failed", emailErr.message);
            }
        }

        res.json({
            success: true,
            message: `Status updated to ${status}`,
            timeline: applicant.timeline
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.scheduleInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, time, mode, location, meetingLink, interviewerName, interviewerEmail, isExternalInterviewer, notes, stage } = req.body;
        const { Applicant, TrackerCandidate, CandidateStatusLog, Employee } = getModels(req);

        // console.log(`[SCHEDULE_INTERVIEW] Attempting to schedule for ID: ${id}`);
        // console.log(`[SCHEDULE_INTERVIEW] Body:`, req.body);

        let applicant = await Applicant.findById(id).populate('requirementId', 'jobTitle');

        // Robustness: If ID not found as Applicant, maybe it's a TrackerCandidate ID?
        if (!applicant) {
            // console.log(`[SCHEDULE_INTERVIEW] ID ${id} not found in Applicant collection. Checking TrackerCandidate fallback...`);
            const tc = await TrackerCandidate.findById(id);
            if (tc) {
                // console.log(`[SCHEDULE_INTERVIEW] ID ${id} found as TrackerCandidate. Looking up Applicant by email: ${tc.email}`);
                applicant = await Applicant.findOne({ email: tc.email, requirementId: { $exists: true } }).populate('requirementId', 'jobTitle');
            }
        }

        if (!applicant) {
            console.warn(`[SCHEDULE_INTERVIEW] Applicant not found for ID or email fallback. ID: ${id}`);
            return res.status(404).json({
                message: "Applicant not found",
                details: `ID ${id} did not match any Applicant or associated TrackerCandidate.`
            });
        }

        // console.log(`[SCHEDULE_INTERVIEW] Found applicant: ${applicant.name} (${applicant.email})`);

        applicant.interview = {
            date,
            time,
            mode,
            location,
            meetingLink,
            interviewerName,
            notes,
            completed: false,
            stage: stage || applicant.status // Use stage from body if provided
        };

        if (!applicant.timeline) applicant.timeline = [];
        applicant.timeline.push({
            status: 'Interview Scheduled',
            message: `Interview scheduled on ${dayjs ? dayjs(date).format('DD MMM YYYY') : new Date(date).toLocaleDateString()} at ${time} (${mode})`,
            updatedBy: req.user?.name || "HR",
            timestamp: new Date()
        });

        await applicant.save();

        // --- SYNC TO TRACKER ---
        try {
            let tc = await TrackerCandidate.findOne({ email: applicant.email, tenant: req.tenantId });
            if (tc) {
                tc.currentStatus = 'Interview Scheduled';
                tc.currentStage = 'Technical';
                await tc.save();

                await new CandidateStatusLog({
                    candidateId: tc._id,
                    status: 'Interview Scheduled',
                    stage: 'Technical',
                    actionBy: req.user?.name || 'HR',
                    remarks: `Interview scheduled for ${new Date(date).toLocaleDateString()} at ${time}. Interviewer: ${interviewerName}. Mode: ${mode}`,
                    actionDate: new Date()
                }).save();
            }
        } catch (trackerErr) {
            console.error("[SCHEDULE_INTERVIEW] Tracker sync failed:", trackerErr.message);
        }

        // --- DUAL EMAIL NOTIFICATIONS (Candidate & Interviewer) ---
        try {
            // Notify Candidate
            await EmailService.sendInterviewScheduledEmail(
                applicant.email,
                applicant.name,
                applicant.requirementId?.jobTitle || 'Job Role',
                applicant.interview,
                false,
                req.tenantId
            );

            // Lookup Interviewer Email and Notify
            if (interviewerName) {
                let finalInterviewerEmail = interviewerEmail;
                
                // If it's not external and no direct email was provided, try to lookup Employee by name
                if (!isExternalInterviewer && !finalInterviewerEmail) {
                    const parts = interviewerName.trim().split(/\s+/);
                    const query = {};
                    if (parts.length === 1) {
                        query.$or = [
                            { firstName: { $regex: new RegExp(`^${parts[0]}$`, 'i') } },
                            { lastName: { $regex: new RegExp(`^${parts[0]}$`, 'i') } }
                        ];
                    } else if (parts.length > 1) {
                        query.firstName = { $regex: new RegExp(`^${parts[0]}$`, 'i') };
                        query.lastName = { $regex: new RegExp(`^${parts.slice(1).join(' ')}$`, 'i') };
                    }
                    const emp = await Employee.findOne(query);
                    if (emp && emp.email) {
                        finalInterviewerEmail = emp.email;
                    }
                }

                if (finalInterviewerEmail) {
                    await EmailService.sendInterviewScheduledEmail(
                        finalInterviewerEmail,
                        applicant.name,
                        applicant.requirementId?.jobTitle || 'Job Role',
                        applicant.interview,
                        true,
                        req.tenantId
                    );
                }
            }
        } catch (e) {
            console.warn("[SCHEDULE_INTERVIEW] Email notification failed:", e.message);
        }

        res.json({ success: true, message: "Interview scheduled successfully" });
    } catch (error) {
        console.error("[SCHEDULE_INTERVIEW] FATAL ERROR:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.rescheduleInterview = async (req, res) => {
    try {
        const { id } = req.params;
        const { date, time, mode, location, meetingLink, interviewerName, interviewerEmail, isExternalInterviewer, notes } = req.body;
        const { Applicant, TrackerCandidate, CandidateStatusLog, Employee } = getModels(req);

        // console.log(`[RESCHEDULE_INTERVIEW] Attempting to reschedule for ID: ${id}`);

        let applicant = await Applicant.findById(id).populate('requirementId', 'jobTitle');

        // Fallback
        if (!applicant) {
            const tc = await TrackerCandidate.findById(id);
            if (tc) {
                applicant = await Applicant.findOne({ email: tc.email }).populate('requirementId', 'jobTitle');
            }
        }

        if (!applicant) return res.status(404).json({ message: "Applicant not found" });

        applicant.interview = { date, time, mode, location, meetingLink, interviewerName, notes, completed: false, stage: applicant.status };

        if (!applicant.timeline) applicant.timeline = [];
        applicant.timeline.push({
            status: 'Interview Rescheduled',
            message: `Interview rescheduled to ${new Date(date).toLocaleDateString()} at ${time}`,
            updatedBy: req.user?.name || "HR",
            timestamp: new Date()
        });

        await applicant.save();

        // Tracker Sync
        try {
            let tc = await TrackerCandidate.findOne({ email: applicant.email, tenant: req.tenantId });
            if (tc) {
                await new CandidateStatusLog({
                    candidateId: tc._id,
                    status: 'Interview Rescheduled',
                    stage: tc.currentStage || 'Technical',
                    actionBy: req.user?.name || 'HR',
                    remarks: `Interview rescheduled to ${new Date(date).toLocaleDateString()} at ${time}`,
                    actionDate: new Date()
                }).save();
            }
        } catch (e) { }

        // --- DUAL EMAIL NOTIFICATIONS (Candidate & Interviewer) ---
        try {
            // Notify Candidate
            await EmailService.sendInterviewRescheduledEmail(
                applicant.email,
                applicant.name,
                applicant.requirementId?.jobTitle || 'Job Role',
                applicant.interview,
                false,
                req.tenantId
            );

            // Lookup Interviewer Email and Notify
            if (interviewerName) {
                let finalInterviewerEmail = interviewerEmail;

                // If it's not external and no direct email was provided, try to lookup Employee by name
                if (!isExternalInterviewer && !finalInterviewerEmail) {
                    const parts = interviewerName.trim().split(/\s+/);
                    const query = {};
                    if (parts.length === 1) {
                        query.$or = [
                            { firstName: { $regex: new RegExp(`^${parts[0]}$`, 'i') } },
                            { lastName: { $regex: new RegExp(`^${parts[0]}$`, 'i') } }
                        ];
                    } else if (parts.length > 1) {
                        query.firstName = { $regex: new RegExp(`^${parts[0]}$`, 'i') };
                        query.lastName = { $regex: new RegExp(`^${parts.slice(1).join(' ')}$`, 'i') };
                    }
                    const emp = await Employee.findOne(query);
                    if (emp && emp.email) {
                        finalInterviewerEmail = emp.email;
                    }
                }

                if (finalInterviewerEmail) {
                    await EmailService.sendInterviewRescheduledEmail(
                        finalInterviewerEmail,
                        applicant.name,
                        applicant.requirementId?.jobTitle || 'Job Role',
                        applicant.interview,
                        true,
                        req.tenantId
                    );
                }
            }
        } catch (e) { }
        res.json({ success: true, message: "Interview rescheduled successfully" });
    } catch (error) {
        console.error("[RESCHEDULE_INTERVIEW] Error:", error);
        res.status(500).json({ message: error.message });
    }
};

exports.markInterviewCompleted = async (req, res) => {
    try {
        const { id } = req.params;
        const { Applicant } = getModels(req);
        const applicant = await Applicant.findById(id);
        if (!applicant) return res.status(404).json({ message: "Applicant not found" });

        if (applicant.interview) {
            applicant.interview.completed = true;
            applicant.markModified('interview');
            if (!applicant.timeline) applicant.timeline = [];
            applicant.timeline.push({
                status: 'Interview Completed',
                message: `Interview session with ${applicant.interview.interviewerName} completed.`,
                updatedBy: req.user?.name || "HR",
                timestamp: new Date()
            });
        }
        await applicant.save();

        await syncToTracker(req, {
            applicant,
            status: 'Interview Completed',
            stage: 'Technical',
            remarks: `Interview session with ${applicant.interview?.interviewerName} completed.`,
            actionBy: req.user?.name
        });
        res.json({ success: true, message: "Interview completed" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getApplicantById = async (req, res) => {
    try {
        const { id } = req.params;
        const db = req.tenantDB;

        // Ensure all possible hiring models are registered on this tenant connection
        const ApplicantModel = db.models?.Applicant || db.model('Applicant', require('../models/Applicant'));
        const ApplicationModel = db.models?.Application || db.model('Application', require('../models/Application'));
        const TrackerCandidateModel = db.models?.TrackerCandidate || db.model('TrackerCandidate', require('../models/TrackerCandidate'));

        // 1. Primary lookup: Applicant collection (Legacy/HR module)
        let applicant = await ApplicantModel.findById(id)
            .populate('requirementId', 'jobTitle department')
            .populate('salaryTemplateId')
            .populate('employeeId') // Include full profile/onboarding data
            .populate('onboardingInstanceId'); // Include onboarding status/tasks

        // 2. Secondary lookup: Application collection (New Workflow module)
        if (!applicant) {
            // console.log(`[getApplicantById] ID ${id} not found in Applicant. Checking Application collection...`);
            const applicationDoc = await ApplicationModel.findById(id)
                .populate('jobId', 'jobTitle department')
                .populate('salaryTemplateId')
                .populate('employeeId')
                .populate('onboardingInstanceId');

            if (applicationDoc) {
                // Normalize for frontend (Map jobId -> requirementId)
                const appObj = applicationDoc.toObject();
                appObj.requirementId = appObj.jobId;
                // Normalize email/name if nested
                if (appObj.candidateInfo) {
                    appObj.name = appObj.name || appObj.candidateInfo.name;
                    appObj.email = appObj.email || appObj.candidateInfo.email;
                    appObj.phone = appObj.phone || appObj.candidateInfo.mobile;
                }
                applicant = appObj;
            }
        }

        // 3. Robust fallback: TrackerCandidate (Candidate Tracking module)
        if (!applicant) {
            // console.log(`[getApplicantById] ID ${id} not found in core collections. Checking TrackerCandidate fallback...`);
            const tc = await TrackerCandidateModel.findById(id).lean();
            if (tc) {
                // console.log(`[getApplicantById] ID ${id} is a TrackerCandidate. Locating linked Applicant via email: ${tc.email}`);
                const linkedApp = await ApplicantModel.findOne({
                    email: { $regex: new RegExp(`^${tc.email}$`, 'i') },
                    tenant: req.tenantId
                }).populate('requirementId', 'jobTitle department').populate('salaryTemplateId').lean();

                if (linkedApp) {
                    applicant = linkedApp;
                } else {
                    // Normalize TrackerCandidate to look like Applicant for the UI
                    // console.log(`[getApplicantById] No linked Applicant found for email ${tc.email}. Returning normalized TrackerCandidate data.`);
                    applicant = {
                        ...tc,
                        mobile: tc.phone, // Map phone to mobile/phone for consistency
                        phone: tc.phone,
                        status: tc.currentStatus, // Use currentStatus from tracker
                        requirementId: { jobTitle: tc.requirementTitle }, // Map requirementTitle to jobTitle nested object
                        source: 'TrackerCandidate'
                    };
                }
            }
        }

        if (!applicant) {
            console.warn(`[getApplicantById] Application details NOT found in ANY collection for ID: ${id}`);
            return res.status(404).json({ success: false, error: 'Application record not found across all recruitment modules.' });
        }

        res.json({ success: true, data: applicant });
    } catch (error) {
        console.error("[getApplicantById] Fatal Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.getSalary = async (req, res) => {
    try {
        const { Applicant } = getModels(req);
        const applicant = await Applicant.findById(req.params.id).select('salaryTemplateId salarySnapshot name');
        if (!applicant) return res.status(404).json({ success: false, error: 'Not found' });
        res.json({ success: true, data: applicant });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

exports.uploadDocuments = async (req, res) => {
    try {
        const { id } = req.params;
        const { Applicant } = getModels(req);
        const applicant = await Applicant.findById(id);
        if (!applicant) return res.status(404).json({ message: 'Not found' });
        const CloudinaryService = require("../services/CloudinaryService");
        const docs = await Promise.all(req.files.map(async (f, i) => {
            let fileUrl = `/uploads/documents/${f.filename}`;
            if (CloudinaryService.isConfigured()) {
                try {
                    const result = await CloudinaryService.uploadFile(
                        f.path,
                        `hrms/${req.tenantId}/applicants/${id}/docs`,
                        true
                    );
                    fileUrl = result.url;
                } catch (err) {
                    console.warn(`Doc upload failed for ${f.originalname}, using local:`, err.message);
                }
            }
            return {
                name: req.body[`documentNames[${i}]`] || f.originalname,
                fileName: f.filename,
                filePath: fileUrl,
                fileSize: f.size,
                fileType: f.mimetype,
                verified: false,
                uploadedAt: new Date(),
                uploadedBy: req.user?.name || 'HR'
            };
        }));
        if (!applicant.customDocuments) applicant.customDocuments = [];
        applicant.customDocuments.push(...docs);

        if (!applicant.timeline) applicant.timeline = [];
        applicant.timeline.push({
            status: 'Documents Uploaded',
            message: `${docs.length} document(s) uploaded for verification.`,
            updatedBy: req.user?.name || "HR",
            timestamp: new Date()
        });
        await applicant.save();

        await syncToTracker(req, {
            applicant,
            status: applicant.status,
            stage: 'HR',
            remarks: `${docs.length} document(s) uploaded for verification.`,
            actionBy: req.user?.name
        });
        res.json({ success: true, documents: applicant.customDocuments });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.verifyDocument = async (req, res) => {
    try {
        const { id, docIndex } = req.params;
        const { Applicant } = getModels(req);
        const applicant = await Applicant.findById(id);
        if (!applicant || !applicant.customDocuments[docIndex]) return res.status(404).json({ message: 'Not found' });
        applicant.customDocuments[docIndex].verified = true;
        applicant.customDocuments[docIndex].verifiedAt = new Date();
        applicant.customDocuments[docIndex].verifiedBy = req.user?.name || 'HR';

        if (!applicant.timeline) applicant.timeline = [];
        applicant.timeline.push({
            status: 'Document Verified',
            message: `Document "${applicant.customDocuments[docIndex].name}" has been verified.`,
            updatedBy: req.user?.name || "HR",
            timestamp: new Date()
        });
        await applicant.save();

        await syncToTracker(req, {
            applicant,
            status: applicant.status,
            stage: 'HR',
            remarks: `Document "${applicant.customDocuments[docIndex].name}" has been verified.`,
            actionBy: req.user?.name
        });
        res.json({ success: true, document: applicant.customDocuments[docIndex] });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/* ------------------------------------------------
   RESUME PARSING (OCR + AI)
   ------------------------------------------------ */
exports.parseResume = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No resume file uploaded" });

        const filePath = req.file.path;
        const originalName = req.file.originalname;
        const ext = path.extname(originalName).toLowerCase();
        let extractedText = "";

        // 1. OCR / Text Extraction
        // console.log(`[RESUME_PARSE] Processing ${originalName}...`);

        try {
            extractedText = await ResumeParserService.parseResume(filePath, req.file.mimetype);
        } catch (ocrErr) {
            console.error("OCR Error:", ocrErr);
            return res.status(500).json({ message: "Extraction failed", error: ocrErr.message });
        }

        // 2. AI Extraction
        const AIExtractionService = require('../services/AIExtraction.service');
        let parsedData = {};
        try {
            parsedData = await AIExtractionService.extractData(extractedText);
        } catch (aiErr) {
            console.error("AI Error:", aiErr);
            parsedData = { error: aiErr.message };
        }

        res.json({ success: true, parsed: parsedData, rawText: extractedText });

        // Cleanup
        try { fs.unlinkSync(filePath); } catch (e) { }

    } catch (e) {
        console.error("Parse Resume Error:", e);
        res.status(500).json({ message: e.message });
    }
};

async function callGeminiAI(text) {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{
            parts: [{ text: RESUME_PARSER_PROMPT + "\n\nREST OF TEXT:\n" + text }]
        }]
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
}

exports.getResumeFile = async (req, res) => {
    try {
        const { filename } = req.params;
        if (!filename) return res.status(400).json({ message: "Filename required" });

        // console.log('📥 [RESUME DOWNLOAD] Filename requested:', filename);

        const safeFilename = path.basename(filename);
        const resumePath = path.join(__dirname, '../uploads/resumes', safeFilename);
        const legacyPath = path.join(__dirname, '../uploads', safeFilename);
        const resumesDir = path.join(__dirname, '../uploads/resumes');

        // 1. Primary path
        if (fs.existsSync(resumePath)) {
            // console.log('✅ [RESUME DOWNLOAD] Found in resumes folder:', resumePath);
            return res.sendFile(resumePath);
        }

        // 2. Legacy path
        if (fs.existsSync(legacyPath)) {
            // console.log('✅ [RESUME DOWNLOAD] Found in legacy path:', legacyPath);
            return res.sendFile(legacyPath);
        }

        // 3. Fallback: Serve any PDF
        if (fs.existsSync(resumesDir)) {
            const files = fs.readdirSync(resumesDir).filter(f => f.endsWith('.pdf'));
            if (files.length > 0) {
                const fallbackPath = path.join(resumesDir, files[0]);
                // console.log(`✅ [RESUME DOWNLOAD] Using fallback resume: ${files[0]}`);
                return res.sendFile(fallbackPath);
            }
        }

        return res.status(404).json({ message: "Resume file not found" });

    } catch (error) {
        console.error("❌ [RESUME DOWNLOAD] Fatal Error:", error);
        res.status(500).json({ message: "Failed to load resume", error: error.message });
    }
};

/**
 * Helper: Try to get resume text — from stored rawOCRText OR re-read from disk file
 */
async function getResumeText(applicant) {
    // 1. Use stored OCR text if available and substantial
    if (applicant.rawOCRText && applicant.rawOCRText.length > 100) {
        // console.log(`[RESCORE] Using stored rawOCRText (${applicant.rawOCRText.length} chars) for ${applicant.name}`);
        return { text: applicant.rawOCRText, source: 'stored' };
    }

    // 2. Try to re-read from disk
    if (applicant.resume) {
        const resumesDir = path.join(__dirname, '..', 'uploads', 'resumes');
        const possiblePaths = [
            path.join(resumesDir, applicant.resume),
            path.join(__dirname, '..', 'uploads', applicant.resume),
            applicant.resume // absolute path
        ];

        for (const filePath of possiblePaths) {
            if (fs.existsSync(filePath)) {
                try {
                    // console.log(`[RESCORE] Re-reading resume from disk: ${filePath}`);
                    const text = await ResumeParserService.parseResume(filePath, 'application/pdf');
                    if (text && text.length > 50) {
                        return { text, source: 'disk', filePath };
                    }
                } catch (e) {
                    console.warn(`[RESCORE] Failed to parse ${filePath}:`, e.message);
                }
            }
        }
    }

    return { text: null, source: 'none' };
}

/**
 * Re-score a single applicant using stored rawOCRText + fixed MatchingEngine
 * POST /hr/applicants/:id/rescore
 */
exports.rescoreApplicant = async (req, res) => {
    try {
        const { Applicant, Requirement } = getModels(req);
        const applicant = await Applicant.findById(req.params.id);
        if (!applicant) return res.status(404).json({ error: "Applicant not found" });

        const requirement = await Requirement.findById(applicant.requirementId);
        if (!requirement) return res.status(404).json({ error: "Requirement not found" });

        const AIExtractionService = require('../services/AIExtraction.service');
        const MatchingEngine = require('../services/MatchingEngine.service');

        const jobDescText = requirement.jobDescription?.roleOverview || requirement.jobTitle || '';

        // Step 1: Get resume text (from DB or re-read from disk)
        const { text: resumeText, source, filePath } = await getResumeText(applicant);

        let structuredData = {};

        if (resumeText) {
            // Step 2: Run full AI extraction with job context
            try {
                structuredData = await AIExtractionService.extractData(
                    resumeText,
                    requirement.jobTitle,
                    jobDescText
                );
                // console.log(`✅ [RESCORE] AI extracted for ${applicant.name} (source: ${source}) — Skills: ${structuredData.skills?.length || 0}, Score: ${structuredData.matchPercentage}%`);

                // Store the text back if it was re-read from disk
                if (source === 'disk') {
                    applicant.rawOCRText = resumeText;
                    applicant.parsingStatus = 'Completed';
                }
            } catch (aiErr) {
                console.warn(`⚠️ [RESCORE] AI extraction failed for ${applicant.name}:`, aiErr.message);
                structuredData = applicant.aiParsedData || {};
            }
        } else {
            // No resume text at all — use whatever was stored
            console.warn(`⚠️ [RESCORE] No resume text for ${applicant.name} — using stored aiParsedData`);
            structuredData = applicant.aiParsedData || {
                fullName: applicant.name,
                totalExperience: applicant.experience || '0',
                skills: applicant.parsedSkills || [],
                education: []
            };
        }

        // Step 3: Run matching engine
        const matchResult = await MatchingEngine.calculateMatchScore(requirement, structuredData);
        // console.log(`✅ [RESCORE] ${applicant.name}: ${applicant.matchScore}% → ${matchResult.totalScore}%`);

        // Step 4: Save everything back
        applicant.matchScore = matchResult.totalScore;
        applicant.matchBreakdown = matchResult.breakdown;
        applicant.matchedSkills = matchResult.matchedSkills;
        applicant.missingSkills = matchResult.missingSkills;
        applicant.aiParsedData = {
            ...structuredData,
            summary: structuredData.summary || structuredData.experienceSummary || null
        };
        if (Array.isArray(structuredData.skills) && structuredData.skills.length > 0) {
            applicant.parsedSkills = structuredData.skills;
        }
        await applicant.save();

        res.json({
            success: true,
            applicantId: applicant._id,
            name: applicant.name,
            resumeSource: source,
            skillsFound: structuredData.skills?.length || 0,
            newScore: matchResult.totalScore,
            breakdown: matchResult.breakdown,
            matchedSkills: matchResult.matchedSkills,
            missingSkills: matchResult.missingSkills
        });

    } catch (err) {
        console.error("❌ [RESCORE] Error:", err);
        res.status(500).json({ error: "Re-scoring failed", details: err.message });
    }
};

/**
 * Re-score ALL applicants for a specific job requirement
 * POST /hr/requirements/:requirementId/rescore-all
 */
exports.rescoreAllApplicants = async (req, res) => {
    try {
        const { Applicant, Requirement } = getModels(req);
        const { requirementId } = req.params;

        const requirement = await Requirement.findById(requirementId);
        if (!requirement) return res.status(404).json({ error: "Requirement not found" });

        const applicants = await Applicant.find({ requirementId });
        if (!applicants.length) return res.json({ success: true, message: "No applicants found", updated: 0 });

        const AIExtractionService = require('../services/AIExtraction.service');
        const MatchingEngine = require('../services/MatchingEngine.service');
        const jobDescText = requirement.jobDescription?.roleOverview || requirement.jobTitle || '';

        let updated = 0;
        const results = [];

        for (const applicant of applicants) {
            try {
                const oldScore = applicant.matchScore;

                // Step 1: Get resume text (stored or re-read from disk)
                const { text: resumeText, source } = await getResumeText(applicant);

                let structuredData = {};

                if (resumeText) {
                    try {
                        structuredData = await AIExtractionService.extractData(
                            resumeText,
                            requirement.jobTitle,
                            jobDescText
                        );
                        // console.log(`✅ [RESCORE-ALL] ${applicant.name} (${source}): Skills=${structuredData.skills?.length || 0}, AI Score=${structuredData.matchPercentage}%`);

                        // Store text back if re-read from disk
                        if (source === 'disk') {
                            applicant.rawOCRText = resumeText;
                            applicant.parsingStatus = 'Completed';
                        }
                    } catch (e) {
                        console.warn(`⚠️ [RESCORE-ALL] AI failed for ${applicant.name}:`, e.message);
                        structuredData = applicant.aiParsedData || {};
                    }
                } else {
                    console.warn(`⚠️ [RESCORE-ALL] No resume for ${applicant.name} — using stored data`);
                    structuredData = applicant.aiParsedData || {
                        fullName: applicant.name,
                        totalExperience: applicant.experience || '0',
                        skills: applicant.parsedSkills || [],
                        education: []
                    };
                }

                // Step 2: Run matching
                const matchResult = await MatchingEngine.calculateMatchScore(requirement, structuredData);

                // Step 3: Save
                applicant.matchScore = matchResult.totalScore;
                applicant.matchBreakdown = matchResult.breakdown;
                applicant.matchedSkills = matchResult.matchedSkills;
                applicant.missingSkills = matchResult.missingSkills;
                applicant.aiParsedData = {
                    ...structuredData,
                    summary: structuredData.summary || structuredData.experienceSummary || null
                };
                if (Array.isArray(structuredData.skills) && structuredData.skills.length > 0) {
                    applicant.parsedSkills = structuredData.skills;
                }
                await applicant.save();

                updated++;
                results.push({
                    name: applicant.name,
                    resumeSource: source,
                    skillsFound: structuredData.skills?.length || 0,
                    oldScore,
                    newScore: matchResult.totalScore,
                    matchedSkills: matchResult.matchedSkills,
                    missingSkills: matchResult.missingSkills
                });
                // console.log(`✅ [RESCORE-ALL] ${applicant.name}: ${oldScore}% → ${matchResult.totalScore}%`);

            } catch (e) {
                console.error(`❌ [RESCORE-ALL] Failed for ${applicant.name}:`, e.message);
                results.push({ name: applicant.name, error: e.message });
            }
        }

        res.json({ success: true, updated, total: applicants.length, results });

    } catch (err) {
        console.error("❌ [RESCORE-ALL] Fatal Error:", err);
        res.status(500).json({ error: "Batch re-scoring failed", details: err.message });
    }
};



exports.requestDocuments = async (req, res) => { try { const Applicant = req.tenantDB.model('Applicant'); const app = await Applicant.findById(req.params.id); if (!app) return res.status(404).json({success: false, message: 'Application not found'}); app.status = 'Document Requested'; await app.save(); res.json({success: true, message: 'Documents requested successfully', application: app}); } catch (err) { res.status(500).json({success: false, message: err.message}); } };

exports.approveProfile = async (req, res) => { 
    try { 
        const Applicant = req.tenantDB.model('Applicant'); 
        const app = await Applicant.findById(req.params.id); 
        if (!app) return res.status(404).json({success: false, message: 'Application not found'}); 
        app.status = 'Document Verified'; 
        if (!app.timeline) app.timeline = [];
        app.timeline.push({
            status: 'Document Verified',
            message: 'HR has approved your profile and documents.',
            updatedBy: req.user?.name || "HR",
            timestamp: new Date()
        });
        await app.save(); 
        res.json({success: true, message: 'Profile approved successfully', application: app}); 
    } catch (err) { 
        res.status(500).json({success: false, message: err.message}); 
    } 
};

exports.requestReupload = async (req, res) => { 
    try { 
        const Applicant = req.tenantDB.model('Applicant'); 
        const app = await Applicant.findById(req.params.id); 
        if (!app) return res.status(404).json({success: false, message: 'Application not found'}); 
        const { reason } = req.body;
        app.status = 'Re-upload Required'; 
        app.rejectionReason = reason;
        if (!app.timeline) app.timeline = [];
        app.timeline.push({
            status: 'Re-upload Required',
            message: `HR requested document re-upload. Reason: ${reason || 'Not specified'}`,
            updatedBy: req.user?.name || "HR",
            timestamp: new Date()
        });
        await app.save(); 
        res.json({success: true, message: 'Re-upload requested successfully', application: app}); 
    } catch (err) { 
        res.status(500).json({success: false, message: err.message}); 
    } 
};

exports.convertToEmployee = async (req, res) => {
    try {
        const { Applicant, Employee } = getModels(req);
        const app = await Applicant.findById(req.params.id);
        if (!app) return res.status(404).json({ success: false, message: 'Application not found' });
        
        if (app.employeeId) {
            return res.status(400).json({ success: false, message: 'Candidate already converted to employee.' });
        }

        const employeeData = app.customData?.employeeData || {};
        const personalInfo = employeeData.personalInfo || {};

        const firstName = personalInfo.firstName || app.name.split(' ')[0] || '';
        const lastName = personalInfo.lastName || app.name.split(' ').slice(1).join(' ') || '';

        const count = await Employee.countDocuments({ tenant: req.tenantId });
        const employeeCode = `EMP-${Math.floor(Math.random() * 10000)}-${count + 1}`;

        const newEmployee = new Employee({
            tenant: req.tenantId,
            mainCompanyId: req.tenantId,
            firstName,
            lastName,
            email: personalInfo.email || app.email,
            contactNo: personalInfo.mobile || app.mobile,
            gender: personalInfo.gender || 'Other',
            dob: personalInfo.dob,
            bloodGroup: personalInfo.bloodGroup,
            maritalStatus: personalInfo.maritalStatus,
            fatherName: personalInfo.fatherName,
            emergencyContactName: personalInfo.emergencyContactName,
            emergencyContactNumber: personalInfo.emergencyContactNumber,
            employeeId: employeeCode,
            employeeCode: employeeCode,
            status: 'Active',
            joiningDate: new Date()
        });

        await newEmployee.save();

        app.employeeId = newEmployee._id;
        app.status = 'Hired';
        if (!app.timeline) app.timeline = [];
        app.timeline.push({
            status: 'Hired',
            message: 'Candidate converted to Employee automatically.',
            updatedBy: req.user?.name || "System",
            timestamp: new Date()
        });

        await app.save();

        res.json({ success: true, message: 'Candidate successfully converted to Employee.', employee: newEmployee });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
