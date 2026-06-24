const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const Tenant = require('../models/Tenant');
const { getBGVModels } = require('../utils/bgvModels');
const companyIdConfig = require('./companyIdConfig.controller');
const onboardingCtrl = require('./onboarding.controller');
const path = require('path');
const fs = require('fs');
const { createBGVCaseWithUniqueId } = require('../utils/bgvCaseId');
const EmailService = require('../services/email.service');

// In-memory OTP store for candidate registration
const candidateOtpEntries = new Map();

function getCookieOptions(overrides = {}) {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        ...overrides,
    };
}

async function resolveTenantObjectId(tenantIdentifier, tenantDB) {
    // Prefer the resolved tenantDB.tenantId (set by utils/tenantDB) when it's a valid ObjectId.
    const fromDb = tenantDB?.tenantId ? String(tenantDB.tenantId) : null;
    if (fromDb && mongoose.Types.ObjectId.isValid(fromDb)) return fromDb;

    // If request provided an ObjectId, accept it.
    const fromReq = tenantIdentifier ? String(tenantIdentifier) : null;
    if (fromReq && mongoose.Types.ObjectId.isValid(fromReq)) return fromReq;

    // Otherwise treat it as a public tenant key and resolve via central Tenant collection.
    if (fromReq) {
        const escaped = fromReq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(`^${escaped}$`, 'i');
        const t = await Tenant.findOne({
            $or: [
                { code: rx },
                { tenantId: rx },
                { companyCode: rx }
            ]
        }).select('_id code tenantId').lean();
        if (t?._id) return String(t._id);
    }

    return null;
}

// Update candidate profile
exports.updateCandidateProfile = async (req, res) => {
    try {
        const { id, tenantId } = req.candidate;
        const { name, email, phone, professionalTier } = req.body;
        const tenantDB = await getTenantDB(tenantId);
        const Candidate = tenantDB.model("Candidate");

        const update = {
            name,
            email,
            mobile: phone,
            professionalTier,
        };

        // If a new profile image was uploaded
        if (req.file) {
            const CloudinaryService = require("../services/CloudinaryService");
            if (CloudinaryService.isConfigured()) {
                try {
                    const result = await CloudinaryService.uploadFile(
                        req.file.path,
                        `hrms/${tenantId}/candidates/${id}`,
                        true
                    );
                    update.profilePic = result.url;
                } catch (cloudErr) {
                    console.warn("Cloudinary upload failed for candidate profile, using local:", cloudErr.message);
                    update.profilePic = `uploads/profile-pics/${req.file.filename}`;
                }
            } else {
                update.profilePic = `uploads/profile-pics/${req.file.filename}`;
            }
        }

        const candidate = await Candidate.findByIdAndUpdate(id, update, { new: true });
        if (!candidate) return res.status(404).json({ error: "Candidate not found" });

        res.json({ success: true, candidate });
    } catch (err) {
        console.error("Profile update error:", err);
        res.status(500).json({ error: "Failed to update profile", details: err.message });
    }
};

// Get candidate profile
exports.getCandidateProfile = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const tenantDB = await getTenantDB(tenantId);
        const Applicant = tenantDB.model("Applicant");
        const Candidate = tenantDB.model("Candidate");

        const candidate = await Candidate.findById(id).select('-password');
        if (!candidate) {
            return res.status(404).json({ error: "Candidate not found" });
        }

        const acceptedApp = await Applicant.findOne({
            candidateId: id,
            status: { $in: ['Offer Accepted', 'Joining Letter Issued', 'Hired'] }
        });

        // Auto-expire offers on every fetch (backend-controlled)
        const now = new Date();
        try {
            await Applicant.updateMany(
                {
                    tenant: tenantId,
                    candidateId: id,
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

            // Auto-expire joining letters
            await Applicant.updateMany(
                {
                    tenant: tenantId,
                    candidateId: id,
                    joiningLetterStatus: 'SENT',
                    joiningLetterExpiryAt: { $exists: true, $ne: null, $lt: now }
                },
                {
                    $set: { joiningLetterStatus: 'EXPIRED' },
                    $push: {
                        timeline: {
                            status: 'Joining Letter Expired',
                            message: 'Joining letter expired automatically (system).',
                            updatedBy: 'System',
                            timestamp: now
                        }
                    }
                }
            );
        } catch (e) {
            console.warn('[getCandidateProfile] Auto-expiry skipped:', e.message);
        }

        // Find applications with letters
        const letterApp = await Applicant.findOne({
            candidateId: id,
            $or: [
                { offerLetterPath: { $exists: true, $ne: null, $ne: '' } },
                { joiningLetterPath: { $exists: true, $ne: null, $ne: '' } }
            ]
        }).sort({ updatedAt: -1 });

        res.json({
            name: candidate.name,
            email: candidate.email,
            phone: candidate.mobile,
            professionalTier: candidate.professionalTier || 'Technical Leader',
            bgvRequired: !!acceptedApp,
            bgvApplicationId: acceptedApp?._id,
            offerLetterUrl: letterApp?.offerLetterPath ? `/uploads/offers/${letterApp.offerLetterPath}` : null,
            joiningLetterUrl: letterApp?.joiningLetterPath ? `/uploads/${letterApp.joiningLetterPath}` : null,
            offerExpiryAt: letterApp?.offerExpiryAt || null,
            offerStatus: letterApp?.offerStatus || null,
            latestApplicationId: letterApp?._id,
            offerRevisionRequested: letterApp?.offerRevisionRequested || false,
            totalRevisionRequests: letterApp?.totalRevisionRequests || 0,
            joiningLetterRevisionRequested: letterApp?.joiningLetterRevisionRequested || false,
            totalJoiningRevisionRequests: letterApp?.totalJoiningRevisionRequests || 0,
            ...candidate.toObject()
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch profile", details: err.message });
    }
};


exports.sendCandidateOtp = async (req, res) => {
    try {
        const { email, tenantId, phone } = req.body;
        if (!email || !tenantId) {
            return res.status(400).json({ error: "Email and company portal identification are required." });
        }

        const tenantDB = await getTenantDB(tenantId);
        if (!tenantDB) {
            return res.status(400).json({ error: "Invalid company portal link." });
        }

        const resolvedTenantId = await resolveTenantObjectId(tenantId, tenantDB);
        if (!resolvedTenantId) {
            return res.status(400).json({ error: "Invalid company portal." });
        }

        let Candidate;
        try {
            Candidate = tenantDB.model("Candidate");
        } catch (e) {
            const CandidateSchema = require("../models/Candidate");
            Candidate = tenantDB.model("Candidate", CandidateSchema);
        }

        // Check if existing candidate with this email exists for this tenant
        const existing = await Candidate.findOne({ email: email.toLowerCase(), tenant: resolvedTenantId });
        if (existing) {
            return res.status(400).json({ error: "Email already registered. Please login instead." });
        }

        // Generate 6-digit OTP
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const exp = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

        // Store OTP in the in-memory map keying by tenantId + email to prevent collision
        const key = `${resolvedTenantId}:${email.toLowerCase()}`;
        candidateOtpEntries.set(key, { otp, exp });

        // Send OTP via email using sendMail utility
        const { sendMail } = require('../utils/emailService');
        await sendMail({
            to: email,
            subject: 'Verify your Email Address - Career Portal',
            text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.`,
            html: `<div style="font-family: sans-serif; padding: 20px; color: #333;">
                <h2>Email Verification</h2>
                <p>Thank you for starting your application. Please use the verification code below to verify your email address and complete your account registration:</p>
                <div style="background-color: #f0f4f8; padding: 15px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; border-radius: 8px; margin: 20px 0; color: #1a56db;">
                    ${otp}
                </div>
                <p>This code will expire in 10 minutes. If you did not request this, please ignore this email.</p>
            </div>`
        });

        // Send OTP via SMS if phone is provided
        if (phone) {
            try {
                const { sendSms } = require('../utils/smsService');
                await sendSms({
                    to: phone,
                    body: `Your career portal verification code is: ${otp}\n\nThis code expires in 10 minutes.`
                });
                console.log(`[CANDIDATE_OTP] Sent SMS OTP to ${phone}: ${otp}`);
            } catch (smsErr) {
                console.error('❌ [CANDIDATE_OTP] Failed to send SMS:', smsErr);
            }
        }

        // Debug output for development environment
        const responseData = { success: true, message: "Verification code sent to your email and phone." };
        if (process.env.NODE_ENV !== 'production') {
            responseData.debugOtp = otp; // Allow local debug testing
            console.log(`[CANDIDATE_OTP_DEBUG] OTP for ${email} is ${otp}`);
        }

        res.json(responseData);
    } catch (err) {
        console.error('❌ [CANDIDATE_OTP] Error:', err);
        res.status(500).json({ error: "Failed to send verification code. Please check your email and phone number." });
    }
};


exports.registerCandidate = async (req, res) => {
    try {
        const { tenantId, name, email, password, mobile, otp } = req.body;
        // console.log('🔍 [CANDIDATE REGISTER] Request:', { tenantId, name, email, mobile });

        if (!tenantId || !name || !email || !password) {
            console.warn('❌ [CANDIDATE REGISTER] Missing fields');
            return res.status(400).json({ error: "All fields are required" });
        }

        if (!otp) {
            return res.status(400).json({ error: "Verification code (OTP) is required." });
        }

        const tenantDB = await getTenantDB(tenantId);
        if (!tenantDB) {
            return res.status(400).json({ error: "Invalid portal link" });
        }

        const resolvedTenantId = await resolveTenantObjectId(tenantId, tenantDB);
        if (!resolvedTenantId) {
            console.warn('❌ [CANDIDATE REGISTER] Unable to resolve tenant ObjectId for:', tenantId);
            return res.status(400).json({ 
                error: "Invalid portal", 
                message: "This company portal configuration is incomplete. Please contact the company HR." 
            });
        }

        // Verify OTP
        const key = `${resolvedTenantId}:${email.toLowerCase()}`;
        const entry = candidateOtpEntries.get(key);

        const isDevBypass = process.env.NODE_ENV !== 'production' && String(otp) === '123456';
        if (!isDevBypass && (!entry || entry.otp !== String(otp) || entry.exp < Date.now())) {
            return res.status(400).json({ error: "Invalid or expired verification code (OTP)." });
        }

        // Clean up OTP entry after successful verification
        candidateOtpEntries.delete(key);

        // console.log('✅ [CANDIDATE REGISTER] Tenant resolved:', resolvedTenantId);

        // Get or create Candidate model directly with schema
        let Candidate;
        try {
            Candidate = tenantDB.model("Candidate");
        } catch (e) {
            console.warn('⚠️ [CANDIDATE REGISTER] Model error, creating fresh:', e.message);
            const CandidateSchema = require("../models/Candidate");
            Candidate = tenantDB.model("Candidate", CandidateSchema);
        }

        // console.log('✅ [CANDIDATE REGISTER] Candidate model loaded');

        const existing = await Candidate.findOne({ email, tenant: resolvedTenantId });
        if (existing) {
            console.warn('⚠️ [CANDIDATE REGISTER] Email already registered:', email);
            return res.status(400).json({ error: "Email already registered. Please login instead." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const candIdResult = await companyIdConfig.generateIdInternal({
            tenantId: resolvedTenantId, 
            entityType: 'CANDIDATE',
            increment: true
        });

        const candidate = new Candidate({
            ...req.body,
            candidateId: candIdResult.id,
            tenant: resolvedTenantId, 
            password: hashedPassword, // Override plain password with hashed one
        });
        // console.log('💾 [CANDIDATE REGISTER] Saving candidate:', email);

        await candidate.save();
        // console.log('✅ [CANDIDATE REGISTER] Registration successful for:', email);

        // Link existing applications
        try {
            const Applicant = tenantDB.model("Applicant");
            const result = await Applicant.updateMany(
                { email: email.toLowerCase(), tenant: resolvedTenantId },
                { $set: { candidateId: candidate._id } }
            );
            if (result.matchedCount > 0) {
                // console.log(`[CANDIDATE REGISTER] Linked ${result.matchedCount} existing applications to ${email}`);
            }
        } catch (linkErr) {
            console.warn('[CANDIDATE REGISTER] Linking applications failed:', linkErr.message);
        }

        res.status(201).json({ 
            success: true,
            message: "Registration successful! You can now login to track your applications." 
        });
    } catch (err) {
        console.error('❌ [CANDIDATE REGISTER] Error:', err.message, err.stack);
        const isDuplicate = err.code === 11000 || err.message.includes('duplicate key');
        
        // Detailed error message for non-technical users + technical clue for support
        const userMessage = isDuplicate 
            ? "This email is already registered in our system. Please try to login."
            : "We encountered a technical issue while creating your account. Please verify your internet connection or try again later.";
        
        const technicalHint = `[Error: ${err.message}]`;

        res.status(isDuplicate ? 400 : 500).json({ 
            success: false,
            error: `${userMessage} ${technicalHint}`,
            message: userMessage,
            details: err.message
        });
    }
};

exports.loginCandidate = async (req, res) => {
    try {
        const { tenantId, email, password } = req.body;
        // console.log('🔍 [CANDIDATE LOGIN] Request:', { tenantId, email });

        if (!tenantId || !email || !password) {
            console.warn('❌ [CANDIDATE LOGIN] Missing fields');
            return res.status(400).json({ error: "Required fields missing" });
        }

        const tenantDB = await getTenantDB(tenantId);
        if (!tenantDB) {
            console.warn('❌ [CANDIDATE LOGIN] TenantDB not available for:', tenantId);
            return res.status(400).json({ error: "Invalid portal" });
        }

        const resolvedTenantObjectId = await resolveTenantObjectId(tenantId, tenantDB);
        if (!resolvedTenantObjectId) {
            console.warn('❌ [CANDIDATE LOGIN] Unable to resolve tenant ObjectId for:', tenantId);
            return res.status(400).json({ error: "Invalid portal" });
        }

        // console.log('✅ [CANDIDATE LOGIN] Tenant resolved:', { tenantId: resolvedTenantObjectId });

        // Get or create Candidate model directly with schema
        let Candidate;
        try {
            Candidate = tenantDB.model("Candidate");
        } catch (e) {
            console.warn('⚠️ [CANDIDATE LOGIN] Model error, creating fresh:', e.message);
            const CandidateSchema = require("../models/Candidate");
            Candidate = tenantDB.model("Candidate", CandidateSchema);
        }

        const normalizedEmail = String(email || '').trim().toLowerCase();
        // Legacy safety: some older records may have tenant stored as string instead of ObjectId.
        const tenantOrs = [
            { tenant: resolvedTenantObjectId },
            { tenant: String(resolvedTenantObjectId) },
        ];

        // Only include raw tenantId if it's a valid ObjectId; otherwise Mongoose will throw a CastError.
        if (mongoose.Types.ObjectId.isValid(String(tenantId))) {
            tenantOrs.push({ tenant: String(tenantId) });
        }

        let candidate = await Candidate.findOne({ email: normalizedEmail, $or: tenantOrs });

        if (!candidate) {
            // Helpful error: if the email exists in another tenant, tell the user to use correct portal.
            const candidateOther = await Candidate.findOne({ email: normalizedEmail }).select('tenant email').lean();
            if (candidateOther?.tenant) {
                console.warn('❌ [CANDIDATE LOGIN] Portal mismatch for:', normalizedEmail);
                return res.status(400).json({ error: "portal_mismatch", message: "This email belongs to a different company portal. Please login from the correct careers link." });
            }

            console.warn('❌ [CANDIDATE LOGIN] Candidate not found:', normalizedEmail);
            return res.status(400).json({ error: "Invalid credentials" });
        }

        if (!candidate.password) {
            console.warn('❌ [CANDIDATE LOGIN] Candidate has no password hash:', normalizedEmail);
            return res.status(400).json({ error: "Invalid credentials" });
        }

        // Support legacy candidates where password may be stored in plain text.
        // If plain matches, auto-upgrade to bcrypt hash.
        const stored = String(candidate.password || '');
        const looksHashed = stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$');

        let isValid = false;
        if (looksHashed) {
            isValid = await bcrypt.compare(password, stored);
        } else {
            isValid = stored === String(password);
            if (isValid) {
                try {
                    const newHash = await bcrypt.hash(String(password), 10);
                    candidate.password = newHash;
                    await candidate.save();
                    // console.log('🔐 [CANDIDATE LOGIN] Upgraded legacy plain password to bcrypt for:', normalizedEmail);
                } catch (upgradeErr) {
                    console.warn('⚠️ [CANDIDATE LOGIN] Failed to upgrade legacy password hash:', upgradeErr.message);
                }
            }
        }

        if (!isValid) {
            console.warn('❌ [CANDIDATE LOGIN] Invalid password');
            return res.status(400).json({ error: "Invalid credentials" });
        }

        // Normalize tenant field on successful login (self-healing for legacy string tenant).
        try {
            if (String(candidate.tenant) !== String(resolvedTenantObjectId)) {
                candidate.tenant = resolvedTenantObjectId;
                await candidate.save();
                // console.log('🧩 [CANDIDATE LOGIN] Normalized candidate.tenant to ObjectId for:', normalizedEmail);
            }
        } catch (tenantFixErr) {
            console.warn('⚠️ [CANDIDATE LOGIN] Failed to normalize candidate.tenant:', tenantFixErr.message);
        }

        const token = jwt.sign(
            { id: candidate._id, tenantId: resolvedTenantObjectId, role: 'candidate', email: candidate.email },
            process.env.JWT_SECRET || 'hrms_secret_key_123',
            { expiresIn: '7d' }
        );

        res.cookie('candidateAccessToken', token, getCookieOptions({
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        }));

        // console.log('✅ [CANDIDATE LOGIN] Token generated for:', email);
        res.json({
            candidate: {
                id: candidate._id,
                name: candidate.name,
                email: candidate.email,
                mobile: candidate.mobile,
                tenantId: resolvedTenantObjectId,
                profilePic: candidate.profilePic
            }
        });
    } catch (err) {
        console.error('❌ [CANDIDATE LOGIN] Error:', err.message, err.stack);
        res.status(500).json({ error: "Login failed" });
    }
};

exports.trackApplication = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { applicationId } = req.params;
        const tenantDB = await getTenantDB(tenantId);

        // Ensure models are registered correctly
        if (!tenantDB.models.Requirement) {
            tenantDB.model("Requirement", require('../models/Requirement'));
        }
        if (!tenantDB.models.CompanyProfile) {
            tenantDB.model("CompanyProfile", require('../models/CompanyProfile'));
        }

        const Applicant = tenantDB.model("Applicant");
        const CompanyProfile = tenantDB.model("CompanyProfile");

        const mongoose = require('mongoose');
        const isObjectId = mongoose.isValidObjectId(applicationId);
        const appQuery = isObjectId ? { _id: applicationId } : { applicationId: applicationId };

        let matchCondition = { ...appQuery };
        if (req.candidate.role === 'candidate') {
            const CandidateModel = tenantDB.models?.Candidate || tenantDB.model("Candidate", require('../models/Candidate'));
            const profile = await CandidateModel.findById(id).lean();
            const queryOptions = [{ candidateId: id }];
            if (mongoose.isValidObjectId(id)) {
                queryOptions.push({ candidateId: new mongoose.Types.ObjectId(id) });
            }
            if (profile && profile.email) {
                queryOptions.push({ email: { $regex: new RegExp(`^${profile.email.trim()}$`, 'i') } });
            }
            matchCondition = { ...appQuery, $or: queryOptions };
        }

        // console.log(`[DEBUG_TRACK] Start: appId=${applicationId}, candId=${id}, role=${req.candidate.role}`);
        let application = await Applicant.findOne(matchCondition)
            .populate('requirementId', 'jobTitle department status companyName location description jobType pipelineStages')
            .lean();

        if (application) // console.log(`[DEBUG_TRACK] Found in Applicant:`, application._id);

        // FALLBACK: New Recruitment Workflow (Application Model)
        if (!application) {
            // console.log(`[TRACK_APP] Not found in Applicant, checking Application collection: ${applicationId}`);
            const ApplicationModel = tenantDB.models?.Application || tenantDB.model('Application', require('../models/Application'));
            
            application = await ApplicationModel.findOne(matchCondition)
                .populate('jobId', 'jobTitle department status companyName location description jobType pipelineStages')
                .lean();

            if (application) {
                // console.log(`[DEBUG_TRACK] Found in Application:`, application._id);
                application.requirementId = application.jobId; 
                
                application.timeline = (application.statusHistory || []).map(h => ({
                    status: h.to,
                    description: h.reason || `Progressed to ${h.to}`,
                    timestamp: h.timestamp
                }));

                if (!application.timeline || application.timeline.length === 0) {
                    application.timeline = [{
                        status: 'Applied',
                        description: 'Application successfully received',
                        timestamp: application.createdAt
                    }];
                }
            }
        }

        if (!application) {
            console.warn(`[TRACK_APP] Application ${applicationId} not found for candidate ${id}`);
            return res.status(404).json({ error: "Application not found" });
        }

        // --- NEW: Manual Job Detail Fetch Fallback ---
        if (!application.requirementId || typeof application.requirementId === 'string' || application.requirementId instanceof mongoose.Types.ObjectId) {
            const Requirement = tenantDB.model("Requirement");
            const jobId = application.requirementId || application.jobId;
            if (jobId && mongoose.isValidObjectId(jobId)) {
                // console.log(`[DEBUG_TRACK] Manual Job Fetch for: ${jobId}`);
                const job = await Requirement.findById(jobId).select('jobTitle department status companyName location description jobType pipelineStages').lean();
                if (job) {
                    application.requirementId = job;
                }
            }
        }

        let companyName = 'Company';
        try {
            const profile = await CompanyProfile.findOne({});
            if (profile && profile.companyName) {
                companyName = profile.companyName;
            } else if (application.requirementId?.companyName) {
                companyName = application.requirementId.companyName;
            }
        } catch (e) {
            console.warn("[TRACK_APP] Failed to fetch company name:", e.message);
        }

        let offerLetter = null;
        let joiningLetter = null;
        let employeeMeta = null;
        try {
            const GeneratedLetter = tenantDB.model("GeneratedLetter");
            const lookupId = application._id;
            
            offerLetter = await GeneratedLetter.findOne({
                applicantId: lookupId,
                letterType: { $ne: 'joining' }
            }).sort({ createdAt: -1 });
            
            joiningLetter = await GeneratedLetter.findOne({
                applicantId: lookupId,
                letterType: 'joining'
            }).sort({ createdAt: -1 });

            if (application.employeeId) {
                const Employee = tenantDB.model("Employee");
                const emp = await Employee.findById(application.employeeId).select('meta').lean();
                employeeMeta = emp?.meta;
            }
        } catch (e) {
            console.warn("[TRACK_APP] Extra data fetch failed:", e.message);
        }

        res.json({
            timeline: application.timeline && application.timeline.length > 0 ? application.timeline : [{
                status: 'Applied',
                date: application.createdAt,
                description: 'Application successfully submitted'
            }],
            jobDetails: {
                id: application.jobId?._id,
                title: application.jobId?.title || application.requirementId?.jobTitle,
                department: application.requirementId?.department,
                company: companyName,
                status: application.status,
                currentStage: application.currentStage || null,
                currentStageId: application.currentStageId || null,
                pipelineStages: application.requirementId?.pipelineStages || application.jobId?.pipelineStages || [],
                pipelineProgress: application.pipelineProgress || [],
                stageHistory: application.stageHistory || [],
                appliedDate: application.createdAt || new Date(),
                offerLetterUrl: application.offerLetterPath ? `/uploads/offers/${application.offerLetterPath}` : null,
                joiningLetterUrl: application.joiningLetterPath ? (application.joiningLetterPath.startsWith('uploads') ? `/${application.joiningLetterPath}` : `/uploads/${application.joiningLetterPath}`) : null,
                letterId: offerLetter?._id || joiningLetter?._id || null,
                offerLetterId: offerLetter?._id || null,
                joiningLetterId: joiningLetter?._id || null,
                letterStatus: offerLetter?.status || null,
                tenantId: tenantId,
                offerExpiryAt: application.offerExpiryAt || null,
                offerStatus: application.offerStatus || null,
                offerRevisionRequested: application.offerRevisionRequested || false,
                totalRevisionRequests: application.totalRevisionRequests || 0,
                joiningLetterExpiryAt: application.joiningLetterExpiryAt || null,
                joiningLetterStatus: application.joiningLetterStatus || null,
                joiningLetterRevisionRequested: application.joiningLetterRevisionRequested || false,
                totalJoiningRevisionRequests: application.totalJoiningRevisionRequests || 0,
                name: application.name,
                onboarding: {
                    instanceId: application.onboardingInstanceId || null,
                    employeeId: application.employeeId || null,
                    status: application.onboardingStatus || null,
                    startedAt: application.onboardingStartedAt || null,
                    invitedAt: application.onboardingInvitedAt || null,
                    completedAt: application.onboardingCompletedAt || null,
                    isOnboarded: !!application.isOnboarded,
                    isActive: !!application.onboardingInstanceId && !application.isOnboarded,
                    credentials: (application.onboardingInstanceId || application.joiningLetterStatus === 'ACCEPTED') ? {
                        email: application.email,
                        password: employeeMeta?.onboardingTempPassword || ''
                    } : null
                }
            }
        });
    } catch (err) {
        console.error("[TRACK_APP] Error:", err.message);
        res.status(500).json({ error: "Failed to track application", details: err.message });
    }
};

exports.getOnboardingAccess = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { applicationId } = req.params;
        const tenantDB = await getTenantDB(tenantId);
        const Applicant = tenantDB.model("Applicant");
        const mongoose = require('mongoose');

        const appQuery = mongoose.isValidObjectId(applicationId)
            ? { _id: applicationId }
            : { applicationId };

        const applicant = await Applicant.findOne({ ...appQuery, candidateId: id });
        if (!applicant) {
            return res.status(404).json({ success: false, message: "application_not_found" });
        }

        const joiningStatus = String(applicant.joiningLetterStatus || '').toUpperCase();
        const onboardingAlreadyStarted = !!applicant.onboardingInstanceId || !!applicant.onboardingStatus || !!applicant.isOnboarded;
        const onboardingEligible = onboardingAlreadyStarted || ['SIGNED', 'ACCEPTED'].includes(joiningStatus);

        if (!onboardingEligible) {
            return res.status(400).json({
                success: false,
                message: "Onboarding will be available after the joining letter is signed."
            });
        }

        const onboarding = await onboardingCtrl.autoStartOnboardingForApplicant({
            req,
            applicant,
            actor: {
                id: id || null,
                role: 'candidate',
                name: applicant.name || 'Candidate',
                email: applicant.email || '',
            },
            source: 'candidate_portal_access',
            ensurePortalLink: true,
            notifyCandidate: false,
        });

        return res.json({
            success: true,
            onboarding: {
                instanceId: onboarding.instance?._id || null,
                employeeId: onboarding.employee?._id || null,
                status: onboarding.instance?.status || null,
                portalUrl: onboarding.link || null,
                invited: onboarding.invited,
                created: onboarding.created,
            }
        });
    } catch (err) {
        console.error("[GET_ONBOARDING_ACCESS] Error:", err.message);
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || "Failed to generate onboarding access."
        });
    }
};

exports.logoutCandidate = async (_req, res) => {
    res.clearCookie('candidateAccessToken', getCookieOptions({ path: '/' }));
    return res.json({ success: true });
};

exports.getCandidateMe = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const tenantDB = await getTenantDB(tenantId);
        let Candidate;
        try { Candidate = tenantDB.model("Candidate"); } catch (e) { Candidate = tenantDB.model("Candidate", require("../models/Candidate")); }
        const candidate = await Candidate.findById(id).select('-password');
        if (!candidate) return res.status(404).json({ success: false, message: "Candidate not found" });
        res.json({ success: true, candidate: { id: candidate._id, name: candidate.name, email: candidate.email, mobile: candidate.mobile, profilePic: candidate.profilePic, tenantId } });
    } catch (err) { res.status(500).json({ success: false, error: err.message }); }
};

exports.getCandidateDashboard = async (req, res) => {
    try {
        const { tenantId, id, role } = req.candidate;
        const tenantDB = await getTenantDB(tenantId);
        const Applicant = tenantDB.model("Applicant");
        let profile = null;
        if (role === 'candidate') {
            const Candidate = tenantDB.model("Candidate");
            profile = await Candidate.findById(id).select('-password');
        } else {
            const Employee = tenantDB.model("Employee", require('../models/Employee'));
            profile = await Employee.findById(id).select('-password');
            if (profile) { profile = profile.toObject(); profile.name = `${profile.firstName} ${profile.lastName}`.trim(); }
        }
        if (!profile) return res.json({ profile: { name: 'Unknown User', role }, applications: [] });
        let queryOptions = [];
        if (profile.email) {
            queryOptions.push({ email: { $regex: new RegExp(`^${profile.email.trim()}$`, 'i') } });
        }
        const mongoose = require('mongoose');
        if (mongoose.isValidObjectId(id)) {
            queryOptions.push({ candidateId: new mongoose.Types.ObjectId(id) });
        }
        queryOptions.push({ candidateId: id });
        
        // 1. Fetch from legacy Applicant collection
        const applicantData = await Applicant.find({ $or: queryOptions })
            .populate('requirementId', 'jobTitle department status location')
            .sort({ createdAt: -1 })
            .lean();

        // 2. Fetch from new Application collection (Recruitment V2)
        let applicationData = [];
        try {
            const ApplicationModel = tenantDB.models?.Application || tenantDB.model("Application", require('../models/Application'));
            const apps = await ApplicationModel.find({ $or: queryOptions })
                .populate('jobId', 'jobTitle department status location')
                .sort({ createdAt: -1 })
                .lean();
            
            // Normalize ApplicationModel results to match ApplicantSchema for frontend compatibility
            applicationData = apps.map(app => ({
                ...app,
                requirementId: app.jobId || app.requirementId, // Map jobId -> requirementId
                name: app.name || app.candidateInfo?.name,
                email: app.email || app.candidateInfo?.email
            }));
        } catch (err) {
            console.warn("[DASHBOARD] Application collection query failed or missing:", err.message);
        }

        // 3. Merge results
        const mergedApplications = [...applicantData, ...applicationData];
        
        // Remove duplicates and ensure all IDs are simple strings for the frontend
        const finalApplications = [];
        const seen = new Set();
        
        for (const app of mergedApplications) {
            // Force Hex String conversion for MongoDB ObjectIds
            const getHex = (id) => {
                if (!id) return null;
                if (typeof id === 'string') return id;
                if (id instanceof mongoose.Types.ObjectId) return id.toHexString();
                if (id.toString && typeof id.toString === 'function') {
                    const s = id.toString();
                    return s === '[object Object]' ? null : s;
                }
                return String(id);
            };

            const appId = getHex(app._id || app.applicationId);
            if (!appId || seen.has(appId)) continue;
            seen.add(appId);
            
            finalApplications.push({
                ...app,
                _id: appId,
                requirementId: app.requirementId ? {
                    ...app.requirementId,
                    _id: getHex(app.requirementId._id || app.requirementId.id || app.requirementId)
                } : null
            });
        }

        // 4. Attach CandidateDocumentRequest details
        try {
            const CandidateDocumentRequest = tenantDB.models?.CandidateDocumentRequest || tenantDB.model("CandidateDocumentRequest", require('../models/CandidateDocumentRequest'));
            for (let app of finalApplications) {
                const reqId = app.requirementId?._id || app.requirementId;
                if (reqId) {
                    const docReq = await CandidateDocumentRequest.findOne({ candidateId: id, jobId: reqId, status: { $in: ['Pending', 'Revision_Requested'] } });
                    if (docReq) {
                        app.documentRequestToken = docReq.token;
                        app.documentRequestStatus = docReq.status;
                    }
                }
            }
        } catch (e) {
            console.warn("[DASHBOARD] CandidateDocumentRequest lookup failed:", e.message);
        }

        res.json({ profile, applications: finalApplications });
    } catch (err) { res.status(500).json({ error: "Failed to load dashboard" }); }
};

exports.checkApplicationStatus = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { requirementId } = req.params;
        const tenantDB = await getTenantDB(tenantId);
        const Applicant = tenantDB.model("Applicant");
        const application = await Applicant.findOne({ candidateId: id, requirementId }).sort({ createdAt: -1 });
        if (!application) return res.json({ applied: false });
        res.json({ applied: true, applicationId: application._id, status: application.status });
    } catch (err) { res.status(500).json({ error: "Failed to check status" }); }
};

exports.acceptOffer = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { applicationId } = req.params;
        const tenantDB = await getTenantDB(tenantId);
        const Applicant = tenantDB.model("Applicant");
        const mongoose = require('mongoose');
        const isObjectId = mongoose.isValidObjectId(applicationId);
        const appQuery = isObjectId ? { _id: applicationId } : { applicationId: applicationId };
        const matchCondition = req.candidate.role === 'candidate' ? { ...appQuery, candidateId: id } : { ...appQuery };
        const application = await Applicant.findOne(matchCondition).populate('requirementId');
        if (!application) return res.status(404).json({ error: "Application not found" });

        application.status = 'Offer Accepted';
        application.offerStatus = 'ACCEPTED';
        if (!application.timeline) application.timeline = [];
        application.timeline.push({
            status: 'Offer Accepted',
            message: 'Offer has been accepted by the candidate.',
            updatedBy: 'Candidate',
            timestamp: new Date()
        });

        await application.save();
        res.json({ success: true, message: "Offer accepted successfully!" });
    } catch (err) {
        console.error("[ACCEPT_OFFER] Error:", err.message);
        res.status(500).json({ error: "Failed to accept offer" });
    }
};

exports.acceptJoiningLetter = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { applicationId } = req.params;
        const tenantDB = await getTenantDB(tenantId);
        const Applicant = tenantDB.model("Applicant");

        // Load models safely
        if (!tenantDB.models.Notification) {
            try { tenantDB.model('Notification', require('../models/Notification')); } catch (e) { }
        }
        if (!tenantDB.models.GeneratedLetter) {
            try { tenantDB.model('GeneratedLetter', require('../models/GeneratedLetter')); } catch (e) { }
        }
        if (!tenantDB.models.Employee) {
            try { tenantDB.model('Employee', require('../models/Employee')); } catch (e) { }
        }
        const Notification = tenantDB.model("Notification");
        const GeneratedLetter = tenantDB.model("GeneratedLetter");

        const mongoose = require('mongoose');
        const isObjectId = mongoose.isValidObjectId(applicationId);
        const appQuery = isObjectId ? { _id: applicationId } : { applicationId: applicationId };
        const matchCondition = req.candidate.role === 'candidate' ? { ...appQuery, candidateId: id } : { ...appQuery };
        const application = await Applicant.findOne(matchCondition).populate('requirementId');
        if (!application) return res.status(404).json({ error: "Application not found" });

        // Prevent duplicate acceptance
        if (application.joiningLetterStatus === 'ACCEPTED') {
            return res.json({ success: true, message: "Joining letter already accepted!" });
        }

        // Check for expiry
        const now = new Date();
        if ((application.joiningLetterExpiryAt && now > application.joiningLetterExpiryAt) || application.joiningLetterStatus === 'EXPIRED') {
            application.joiningLetterStatus = 'EXPIRED';
            if (!application.timeline) application.timeline = [];
            application.timeline.push({
                status: 'Joining Letter Expired',
                message: 'Joining letter expired (attempted validation).',
                updatedBy: 'System',
                timestamp: now
            });
            await application.save();
            return res.status(400).json({ error: "Joining letter has expired and cannot be accepted." });
        }

        const letter = await GeneratedLetter.findOne({ applicantId: application._id, letterType: 'joining' }).sort({ createdAt: -1 });

        application.joiningLetterStatus = 'ACCEPTED';
        application.status = 'Joining Letter Accepted';
        if (!application.timeline) application.timeline = [];
        application.timeline.push({
            status: 'Joining Letter Accepted',
            message: 'Candidate has accepted the joining letter.',
            updatedBy: 'Candidate',
            timestamp: new Date()
        });

        await application.save();

        // Auto-start onboarding if not already started
        try {
            const onboardingCtrl = require('./onboarding.controller');
            await onboardingCtrl.autoStartOnboardingForApplicant({
                req: { ...req, tenantId, tenantDB },
                applicant: application,
                actor: {
                    id: id || null,
                    role: 'candidate',
                    name: application.name || 'Candidate',
                    email: application.email || '',
                },
                source: 'joining_letter_acceptance',
                ensurePortalLink: true,
                notifyCandidate: true, // Notify them that onboarding has started
            });
        } catch (onboardErr) {
            console.warn('[ACCEPT_JOINING] Auto-onboarding failed:', onboardErr.message);
        }

        // Also update Employee if linked
        if (application.employeeId || (letter && letter.employeeId)) {
            try {
                const Employee = tenantDB.model("Employee");
                const empId = application.employeeId || letter.employeeId;
                await Employee.findByIdAndUpdate(empId, { joiningLetterStatus: 'ACCEPTED' });
            } catch (e) { console.warn('[ACCEPT_JOINING] Employee update skipped:', e.message); }
        }

        // Notify HR
        try {
            const job = application.requirementId;
            if (job && job.createdBy) {
                await Notification.create({
                    tenant: tenantId,
                    receiverId: job.createdBy,
                    receiverRole: 'hr',
                    entityType: 'Application',
                    entityId: application._id,
                    title: 'Joining Letter Accepted',
                    message: `${application.name} has accepted the joining letter.`,
                    isRead: false
                });
            }
        } catch (notifErr) { console.warn('[ACCEPT_JOINING] Notification skipped:', notifErr.message); }

        if (letter) {
            letter.status = 'Accepted';
            letter.joiningLetterStatus = 'accepted';
            letter.acceptedAt = new Date();
            await letter.save();
        }

        res.json({ success: true, message: "Joining letter accepted!" });
    } catch (err) {
        console.error("[ACCEPT_JOINING] Error:", err.message);
        res.status(500).json({ error: "Failed to accept joining letter", details: err.message });
    }
};

exports.rejectOffer = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { applicationId } = req.params;
        const tenantDB = await getTenantDB(tenantId);
        const Applicant = tenantDB.model("Applicant");
        const mongoose = require('mongoose');
        const isObjectId = mongoose.isValidObjectId(applicationId);
        const appQuery = isObjectId ? { _id: applicationId } : { applicationId: applicationId };
        const matchCondition = req.candidate.role === 'candidate' ? { ...appQuery, candidateId: id } : { ...appQuery };
        const application = await Applicant.findOne(matchCondition);
        if (!application) return res.status(404).json({ error: "Application not found" });

        application.status = 'Offer Rejected';
        application.offerStatus = 'REJECTED';
        if (!application.timeline) application.timeline = [];
        application.timeline.push({
            status: 'Offer Rejected',
            message: 'Offer has been rejected by the candidate.',
            updatedBy: 'Candidate',
            timestamp: new Date()
        });

        await application.save();
        res.json({ success: true, message: "Offer rejected." });
    } catch (err) {
        console.error("[REJECT_OFFER] Error:", err.message);
        res.status(500).json({ error: "Failed to reject offer" });
    }
};

exports.requestOfferRevision = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { applicationId } = req.params;
        const tenantDB = await getTenantDB(tenantId);
        const Applicant = tenantDB.model("Applicant");
        const mongoose = require('mongoose');
        const isObjectId = mongoose.isValidObjectId(applicationId);
        const appQuery = isObjectId ? { _id: applicationId } : { applicationId: applicationId };
        const matchCondition = req.candidate.role === 'candidate' ? { ...appQuery, candidateId: id } : { ...appQuery };
        const application = await Applicant.findOne(matchCondition);
        if (!application) return res.status(404).json({ error: "Application not found" });

        const now = new Date();
        const currentOfferVersion = Math.max(Number(application.offerVersion || 1), 1);
        const offerRevisionAlreadyPending =
            application.offerStatus === 'REQUESTED' ||
            (application.offerRevisionRequested &&
                Number(application.offerRevisionRequestedVersion || 0) === currentOfferVersion);
        const isOfferExpired =
            application.offerStatus === 'EXPIRED' ||
            (application.offerExpiryAt && now > new Date(application.offerExpiryAt));

        if (!isOfferExpired && application.offerStatus !== 'REJECTED') {
            return res.status(400).json({
                error: "You can request a new offer only after the current offer expires or is rejected."
            });
        }

        if (offerRevisionAlreadyPending) {
            return res.status(400).json({
                error: "Your offer revision request is already pending with HR."
            });
        }

        application.offerRevisionRequested = true;
        application.offerStatus = 'REQUESTED';
        application.revisionRequestedAt = now;
        application.offerRevisionRequestedVersion = currentOfferVersion;
        application.totalRevisionRequests = Number(application.totalRevisionRequests || 0) + 1;
        if (!application.timeline) application.timeline = [];
        application.timeline.push({
            status: 'Offer Revision Requested',
            message: 'Candidate requested offer revision.',
            updatedBy: 'Candidate',
            timestamp: now
        });

        await application.save();
        res.json({ success: true, message: "Request sent to HR." });
    } catch (err) {
        console.error("[REQUEST_OFFER_REVISION] Error:", err.message);
        res.status(500).json({ error: "Failed to request revision" });
    }
};

exports.requestJoiningLetterRevision = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { applicationId } = req.params;
        const { note } = req.body;
        const tenantDB = await getTenantDB(tenantId);
        const Applicant = tenantDB.model("Applicant");
        const mongoose = require('mongoose');
        const isObjectId = mongoose.isValidObjectId(applicationId);
        const appQuery = isObjectId ? { _id: applicationId } : { applicationId: applicationId };
        const matchCondition = req.candidate.role === 'candidate' ? { ...appQuery, candidateId: id } : { ...appQuery };
        const application = await Applicant.findOne(matchCondition);
        if (!application) return res.status(404).json({ error: "Application not found" });

        const now = new Date();
        const currentJoiningVersion = Math.max(Number(application.joiningLetterVersion || 1), 1);
        const joiningRevisionAlreadyPending =
            application.joiningLetterStatus === 'REQUESTED' ||
            (application.joiningLetterRevisionRequested &&
                Number(application.joiningRevisionRequestedVersion || 0) === currentJoiningVersion);
        const isJoiningLetterExpired =
            application.joiningLetterStatus === 'EXPIRED' ||
            (application.joiningLetterExpiryAt && now > new Date(application.joiningLetterExpiryAt));

        if (!isJoiningLetterExpired && application.joiningLetterStatus !== 'REJECTED') {
            return res.status(400).json({
                error: "You can request a new joining letter only after the current letter expires or is rejected."
            });
        }

        if (joiningRevisionAlreadyPending) {
            return res.status(400).json({
                error: "Your joining letter revision request is already pending with HR."
            });
        }

        application.joiningLetterRevisionRequested = true;
        application.joiningLetterStatus = 'REQUESTED';
        application.joiningRevisionRequestedAt = now;
        application.joiningRevisionRequestedVersion = currentJoiningVersion;
        application.totalJoiningRevisionRequests = Number(application.totalJoiningRevisionRequests || 0) + 1;
        if (!application.timeline) application.timeline = [];
        application.timeline.push({
            status: 'Joining Letter Revision Requested',
            message: note || 'Candidate requested joining letter revision.',
            updatedBy: 'Candidate',
            timestamp: now
        });

        await application.save();
        res.json({ success: true, message: "Revision request sent to HR." });
    } catch (err) {
        console.error("[REQUEST_JOINING_REVISION] Error:", err.message);
        res.status(500).json({ error: "Failed to request revision" });
    }
};

exports.rejectJoiningLetter = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { applicationId } = req.params;
        const tenantDB = await getTenantDB(tenantId);
        const Applicant = tenantDB.model("Applicant");

        // Load models safely
        if (!tenantDB.models.Notification) {
            try { tenantDB.model('Notification', require('../models/Notification')); } catch (e) { }
        }
        if (!tenantDB.models.GeneratedLetter) {
            try { tenantDB.model('GeneratedLetter', require('../models/GeneratedLetter')); } catch (e) { }
        }
        if (!tenantDB.models.Employee) {
            try { tenantDB.model('Employee', require('../models/Employee')); } catch (e) { }
        }
        const Notification = tenantDB.model("Notification");
        const GeneratedLetter = tenantDB.model("GeneratedLetter");

        const mongoose = require('mongoose');
        const isObjectId = mongoose.isValidObjectId(applicationId);
        const appQuery = isObjectId ? { _id: applicationId } : { applicationId: applicationId };
        const matchCondition = req.candidate.role === 'candidate' ? { ...appQuery, candidateId: id } : { ...appQuery };
        const application = await Applicant.findOne(matchCondition).populate('requirementId');
        if (!application) return res.status(404).json({ error: "Application not found" });

        // Prevent rejecting an already-accepted letter
        if (application.joiningLetterStatus === 'ACCEPTED') {
            return res.status(400).json({ error: "You have already accepted this joining letter." });
        }

        const letter = await GeneratedLetter.findOne({ applicantId: application._id, letterType: 'joining' }).sort({ createdAt: -1 });

        application.joiningLetterStatus = 'REJECTED';
        if (!application.timeline) application.timeline = [];
        application.timeline.push({
            status: 'Joining Letter Rejected',
            message: 'Candidate has rejected the joining letter.',
            updatedBy: 'Candidate',
            timestamp: new Date()
        });

        await application.save();

        // Also update Employee if linked
        if (application.employeeId || (letter && letter.employeeId)) {
            try {
                const Employee = tenantDB.model("Employee");
                const empId = application.employeeId || letter.employeeId;
                await Employee.findByIdAndUpdate(empId, { joiningLetterStatus: 'REJECTED' });
            } catch (e) { console.warn('[REJECT_JOINING] Employee update skipped:', e.message); }
        }

        // Notify HR
        try {
            const job = application.requirementId;
            if (job && job.createdBy) {
                await Notification.create({
                    tenant: tenantId,
                    receiverId: job.createdBy,
                    receiverRole: 'hr',
                    entityType: 'Application',
                    entityId: application._id,
                    title: 'Joining Letter Rejected',
                    message: `${application.name} has rejected the joining letter.`,
                    isRead: false
                });
            }
        } catch (notifErr) { console.warn('[REJECT_JOINING] Notification skipped:', notifErr.message); }

        if (letter) {
            letter.status = 'rejected_by_candidate';
            letter.joiningLetterStatus = 'rejected';
            await letter.save();
        }

        res.json({ success: true, message: "Joining letter rejected." });
    } catch (err) {
        console.error("[REJECT_JOINING] Error:", err.message);
        res.status(500).json({ error: "Failed to reject joining letter", details: err.message });
    }
};

// Get BGV Documents for an Application
exports.getBGVDocuments = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { applicationId } = req.params;
        const tenantDB = await getTenantDB(tenantId);
        const { BGVCase, BGVDocument, BGVCheck } = await getBGVModels({ tenantId, tenantDB });

        // Find BGV Case linked to this application
        const mongoose = require('mongoose');
        const isObjectId = mongoose.isValidObjectId(applicationId);
        const appQuery = isObjectId ? { applicationId } : {};
        // Note: For bgvCase, the field is usually `applicationId` (String/ObjectId). Let's check how BGVCase stores it.
        // Actually, BGVCase usually stores the ObjectId of the application in `applicationId`. Let's be careful.
        // If the URL passes `APP-XYZ`, we might need to find the ObjectId first.
        // Let's just lookup the Applicant first if it's not an ObjectId.
        let actualAppId = applicationId;
        if (!isObjectId) {
            const Applicant = tenantDB.model("Applicant");
            const tempApp = await Applicant.findOne({ applicationId });
            if (tempApp) actualAppId = tempApp._id.toString();
        }

        const normalizedAppId = mongoose.Types.ObjectId.isValid(actualAppId)
            ? new mongoose.Types.ObjectId(actualAppId)
            : actualAppId;
        const matchCondition = req.candidate.role === 'candidate'
            ? { tenant: tenantId, applicationId: normalizedAppId, candidateId: id }
            : { tenant: tenantId, applicationId: normalizedAppId };
        let bgvCase = await BGVCase.findOne(matchCondition);

        if (!bgvCase && req.candidate.role === 'candidate') {
            bgvCase = await BGVCase.findOne({
                tenant: tenantId,
                candidateId: id,
                isClosed: false
            });
        }

        // Fetch already uploaded documents
        const documents = bgvCase 
            ? await BGVDocument.find({ caseId: bgvCase._id, isDeleted: false })
                .select('documentType fileName originalName filePath status verified uploadedAt')
                .sort({ uploadedAt: -1 })
                .lean()
            : [];

        // Fetch checks to determine required documents if case exists
        const checks = bgvCase 
            ? await BGVCheck.find({ caseId: bgvCase._id }).select('type')
            : [];
        const checkTypes = checks.map(c => c.type);

        // Map Check Types to required frontend document keys
        const requiredDocs = [];
        
        // If no case or checks, provide a standard set of essentials
        if (checkTypes.length === 0) {
            requiredDocs.push({ key: 'AADHAAR', label: 'Aadhar Card' });
            requiredDocs.push({ key: 'PAN', label: 'PAN Card' });
            requiredDocs.push({ key: 'PASSPORT_PHOTO', label: 'Passport Photo' });
            requiredDocs.push({ key: 'DEGREE_CERTIFICATE', label: 'Degree Certificate' });
        } else {
            if (checkTypes.includes('IDENTITY')) {
                requiredDocs.push({ key: 'AADHAAR', label: 'Aadhar Card' });
                requiredDocs.push({ key: 'PAN', label: 'PAN Card' });
            }
            if (checkTypes.includes('ADDRESS')) {
                requiredDocs.push({ key: 'ADDRESS_PROOF', label: 'Address Proof' });
            }
            if (checkTypes.includes('EDUCATION')) {
                requiredDocs.push({ key: 'DEGREE_CERTIFICATE', label: 'Degree Certificate' });
            }
            if (checkTypes.includes('EMPLOYMENT')) {
                requiredDocs.push({ key: 'RELIEVING_LETTER', label: 'Relieving Letter' });
                requiredDocs.push({ key: 'PAYSLIP', label: 'Payslips (Last 3 months)' });
            }
            // Always add Passport Photo as it's usually standard
            requiredDocs.push({ key: 'PASSPORT_PHOTO', label: 'Passport Photo' });
        }

        // Transform for frontend
        const formattedDocs = documents.map(doc => ({
            id: doc._id,
            name: doc.documentType,
            fileName: doc.originalName,
            filePath: doc.filePath,
            verified: doc.status === 'VERIFIED',
            status: doc.status,
            uploadedAt: doc.uploadedAt
        }));

        res.json({
            success: true,
            bgvInitiated: true, // Always return true now so UI shows the list
            package: bgvCase?.package || 'BASIC',
            requiredDocs,
            documents: formattedDocs
        });

    } catch (err) {
        console.error("[BGV_DOCS] Error:", err.message);
        res.status(500).json({ error: "Failed to fetch BGV documents" });
    }
};

// Remove BGV Document
exports.removeBGVDocument = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { applicationId, documentId } = req.params;
        const tenantDB = await getTenantDB(tenantId);
        const { BGVCase, BGVDocument, BGVTimeline, Applicant } = await getBGVModels({ tenantId, tenantDB });

        if (!mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({ error: "Invalid document id" });
        }

        const isObjectId = mongoose.isValidObjectId(applicationId);
        let actualAppId = applicationId;
        if (!isObjectId) {
            const tempApp = await Applicant.findOne({ applicationId });
            if (tempApp) actualAppId = tempApp._id.toString();
        }

        const normalizedAppId = mongoose.Types.ObjectId.isValid(actualAppId)
            ? new mongoose.Types.ObjectId(actualAppId)
            : actualAppId;
        const matchCondition = req.candidate.role === 'candidate'
            ? { tenant: tenantId, applicationId: normalizedAppId, candidateId: id }
            : { tenant: tenantId, applicationId: normalizedAppId };
        let bgvCase = await BGVCase.findOne(matchCondition);

        if (!bgvCase && req.candidate.role === 'candidate') {
            bgvCase = await BGVCase.findOne({
                tenant: tenantId,
                candidateId: id,
                isClosed: false
            });
        }

        if (!bgvCase) {
            return res.status(404).json({ error: "BGV case not found" });
        }

        if (bgvCase.isClosed) {
            return res.status(400).json({ error: "BGV Case is closed. Cannot remove documents." });
        }

        const document = await BGVDocument.findOne({
            _id: documentId,
            tenant: tenantId,
            caseId: bgvCase._id,
            candidateId: id,
            isDeleted: false
        });

        if (!document) {
            return res.status(404).json({ error: "Document not found" });
        }

        if (document.status === 'VERIFIED') {
            return res.status(400).json({ error: "Verified documents cannot be removed" });
        }

        document.isDeleted = true;
        document.deletedAt = new Date();
        document.deletionReason = 'Removed by candidate';
        document.deletedBy = {
            userId: id,
            userName: 'Candidate'
        };
        document.status = 'REPLACED';
        await document.save();

        try {
            await BGVTimeline.create({
                tenant: tenantId,
                caseId: bgvCase._id,
                checkId: document.checkId || undefined,
                eventType: 'DOCUMENT_REJECTED',
                title: 'Candidate Removed Document',
                description: `Candidate removed ${document.documentType} (${document.originalName})`,
                performedBy: {
                    userId: id,
                    userName: 'Candidate',
                    userRole: 'candidate'
                },
                newStatus: 'DOCUMENTS_PENDING',
                visibleTo: ['ALL'],
                metadata: { documentId: document._id, action: 'REMOVED_BY_CANDIDATE' }
            });
        } catch (tmErr) {
            console.warn("[BGV_REMOVE] Timeline entry failed:", tmErr.message);
        }

        res.json({ success: true, message: "Document removed successfully" });
    } catch (err) {
        console.error("❌ [BGV_REMOVE] FATAL ERROR:", err);
        res.status(500).json({ error: "Failed to remove document", details: err.message });
    }
};

// Upload BGV Document
exports.uploadBGVDocument = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { applicationId } = req.params;
        const { type } = req.body; // Document Type
        const tenantDB = await getTenantDB(tenantId);

        if (!type) {
            console.error("❌ [BGV_UPLOAD] Missing document type in request body");
            return res.status(400).json({ error: "Document type is required" });
        }
        const { BGVCase, BGVDocument, BGVTimeline, BGVCheck, Applicant } = await getBGVModels({ tenantId, tenantDB });

        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        // 3. Find BGV Case
        const candidateId = id.toString();
        const tenantIdStr = tenantId.toString();

        const mongoose = require('mongoose');
        const isObjectId = mongoose.isValidObjectId(applicationId);
        let actualAppId = applicationId;
        if (!isObjectId) {
            const tempApp = await Applicant.findOne({ applicationId });
            if (tempApp) actualAppId = tempApp._id.toString();
        }

        const normalizedAppId = mongoose.Types.ObjectId.isValid(actualAppId)
            ? new mongoose.Types.ObjectId(actualAppId)
            : actualAppId;
        const matchCondition = req.candidate.role === 'candidate'
            ? { tenant: tenantId, applicationId: normalizedAppId, candidateId: id }
            : { tenant: tenantId, applicationId: normalizedAppId };
        let bgvCase = await BGVCase.findOne(matchCondition);

        if (!bgvCase && req.candidate.role === 'candidate') {
            bgvCase = await BGVCase.findOne({
                tenant: tenantId,
                candidateId: id,
                isClosed: false
            });
        }

        // AUTO-INITIATE BGV CASE IF MISSING
        if (!bgvCase) {
            bgvCase = await createBGVCaseWithUniqueId(BGVCase, {
                tenant: tenantId,
                applicationId: actualAppId,
                candidateId: id,
                package: 'BASIC', // Default to basic
                initiatedBy: id, // Self-initiated via upload
                overallStatus: 'PENDING',
                sla: { targetDays: 7 }
            });

            // Create initial checks for BASIC package
            const defaultChecks = ['IDENTITY', 'ADDRESS', 'EMPLOYMENT'];
            await Promise.all(defaultChecks.map(ct => BGVCheck.create({
                caseId: bgvCase._id,
                tenant: tenantId,
                type: ct,
                status: 'NOT_STARTED',
                slaDays: 5
            })));

            // Add timeline
            await BGVTimeline.create({
                tenant: tenantId,
                caseId: bgvCase._id,
                eventType: 'CASE_INITIATED',
                title: 'BGV Case Auto-Started',
                description: 'Case automatically initialized by candidate document upload.',
                performedBy: { userId: id, userName: 'Candidate', userRole: 'candidate' },
                newStatus: 'PENDING',
                visibleTo: ['ALL']
            });
        }

        if (bgvCase.isClosed) {
            return res.status(400).json({ error: "BGV Case is closed. Cannot upload documents." });
        }

        // 5. Cloudinary Integration
        const CloudinaryService = require("../services/CloudinaryService");
        let secureUrl = null;
        let isCloud = false;

        if (CloudinaryService.isConfigured()) {
            try {
                const cloudResult = await CloudinaryService.uploadFile(
                    req.file.path,
                    `hrms/${tenantIdStr}/bgv/${bgvCase.caseId}`,
                    true
                );
                secureUrl = cloudResult.url;
                isCloud = true;
            } catch (cloudErr) {
                console.warn("⚠️ [BGV_UPLOAD] Cloudinary failed, falling back to local:", cloudErr.message);
            }
        }

        let filename = req.file.originalname;
        let relativeUrl = secureUrl;

        const normalizedType = (type || 'DOCUMENT').toUpperCase();

        if (!isCloud) {
            const uploadsBaseDir = path.join(process.cwd(), 'uploads');
            const bgvDir = path.join(uploadsBaseDir, tenantIdStr, 'bgv', bgvCase.caseId.toString());

            if (!fs.existsSync(bgvDir)) {
                fs.mkdirSync(bgvDir, { recursive: true });
            }

            const ext = path.extname(req.file.originalname) || '.pdf';
            filename = `${normalizedType}_${Date.now()}${ext}`;
            const finalPath = path.join(bgvDir, filename);

            relativeUrl = `/uploads/${tenantIdStr}/bgv/${bgvCase.caseId}/${filename}`;

            const tempPath = path.isAbsolute(req.file.path) ? req.file.path : path.join(process.cwd(), req.file.path);
            try {
                fs.renameSync(tempPath, finalPath);
            } catch (renameErr) {
                console.error("❌ [BGV_UPLOAD] File Move Failed (cross-device?):", renameErr);
                fs.copyFileSync(tempPath, finalPath);
                fs.unlinkSync(tempPath);
            }
            secureUrl = relativeUrl;
        }

        // 7. Map Document Type to Check Type & Update Check Status
        let checkType = null;
        if (['AADHAAR', 'PAN', 'IDENTITY'].includes(normalizedType)) checkType = 'IDENTITY';
        else if (['DEGREE_CERTIFICATE', 'EDUCATION', 'MARKSHEET'].includes(normalizedType)) checkType = 'EDUCATION';
        else if (['RELIEVING_LETTER', 'PAYSLIP', 'EMPLOYMENT', 'EXPERIENCE', 'EXPERIENCE_LETTER'].includes(normalizedType)) checkType = 'EMPLOYMENT';
        else if (['ADDRESS_PROOF', 'ADDRESS', 'BANK_PROOF'].includes(normalizedType)) checkType = 'ADDRESS';
        else if (['PASSPORT_PHOTO'].includes(normalizedType)) checkType = 'IDENTITY';

        let checkId = null;
        if (checkType) {
            try {
                const check = await BGVCheck.findOne({ caseId: bgvCase._id, type: checkType });
                if (check) {
                    checkId = check._id;
                    if (['NOT_STARTED', 'DOCUMENTS_PENDING'].includes(check.status)) {
                        check.status = 'DOCUMENTS_UPLOADED';
                        await check.save();
                    }
                }
            } catch (checkErr) {
                console.warn("[BGV_UPLOAD] Check status update failed:", checkErr.message);
            }
        }

        // 8. Create Document Record
        const document = await BGVDocument.create({
            tenant: tenantId,
            caseId: bgvCase._id,
            checkId,
            candidateId: id,
            documentType: normalizedType, // Ensure Uppercase for Enum
            fileName: filename,
            originalName: req.file.originalname,
            filePath: relativeUrl,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            version: (await BGVDocument.countDocuments({ caseId: bgvCase._id, documentType: normalizedType, isDeleted: false })) + 1,
            uploadedBy: {
                userId: id,
                userName: 'Candidate',
                userRole: 'candidate'
            },
            status: 'UPLOADED'
        });

        // 9. Timeline Entry
        try {
            await BGVTimeline.create({
                tenant: tenantId,
                caseId: bgvCase._id,
                checkId,
                eventType: 'DOCUMENT_UPLOADED',
                title: 'Candidate Uploaded Document',
                description: `Candidate uploaded ${normalizedType} (${req.file.originalname})`,
                performedBy: {
                    userId: id,
                    userName: 'Candidate',
                    userRole: 'candidate'
                },
                newStatus: 'DOCUMENTS_UPLOADED',
                visibleTo: ['ALL'],
                metadata: { documentId: document._id }
            });
        } catch (tmErr) {
            console.warn("[BGV_UPLOAD] Timeline entry failed:", tmErr.message);
        }

        res.json({
            success: true,
            message: "Document uploaded successfully",
            document: {
                name: normalizedType,
                fileName: req.file.originalname,
                filePath: relativeUrl,
                verified: false
            }
        });

    } catch (err) {
        console.error("❌ [BGV_UPLOAD] FATAL ERROR:", err);
        console.error("Context:", {
            tenantId: req.candidate?.tenantId,
            applicationId: req.params?.applicationId,
            candidateId: req.candidate?.id,
            file: req.file ? {
                path: req.file.path,
                mimetype: req.file.mimetype,
                originalname: req.file.originalname
            } : 'No file'
        });
        res.status(500).json({ error: "Failed to upload document", details: err.message });
    }
};

// Letter Signing Logic
exports.getLetterStatus = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { letterId } = req.params;
        const tenantDB = await getTenantDB(tenantId);

        if (!tenantDB.models.SignedLetter) {
            try { tenantDB.model('SignedLetter', require('../models/SignedLetter')); } catch (e) { }
        }
        if (!tenantDB.models.GeneratedLetter) {
            try { tenantDB.model('GeneratedLetter', require('../models/GeneratedLetter')); } catch (e) { }
        }

        const SignedLetter = tenantDB.model("SignedLetter");
        const GeneratedLetter = tenantDB.model("GeneratedLetter");

        // Verify letter exists and belongs to this candidate
        const letter = await GeneratedLetter.findById(letterId);
        if (!letter) return res.status(404).json({ error: "Letter not found" });

        // Check if already signed
        const matchCondition = req.candidate.role === 'candidate' ? { letterId, candidateId: id } : { letterId };
        const signedRecord = await SignedLetter.findOne(matchCondition);

        res.json({
            isSigned: !!signedRecord,
            signedAt: signedRecord?.signedAt,
            signaturePosition: letter.signaturePosition || { alignment: 'right' }
        });
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch letter status" });
    }
};

exports.signLetter = async (req, res) => {
    try {
        const { tenantId, id } = req.candidate;
        const { letterId } = req.params;
        const { signatureImage, signaturePosition } = req.body;
        const mongoose = require('mongoose');
        const path = require('path');
        const fs = require('fs');
        const { PDFDocument, rgb } = require('pdf-lib');

        if (!signatureImage) {
            return res.status(400).json({ error: "Signature image is required" });
        }
        if (!mongoose.Types.ObjectId.isValid(letterId)) {
            return res.status(400).json({ error: "Invalid letter id" });
        }

        const tenantDB = await getTenantDB(tenantId);

        // Ensure models are registered correctly
        ['SignedLetter', 'GeneratedLetter', 'Applicant', 'Candidate', 'Notification', 'Requirement', 'Employee'].forEach(m => {
            if (!tenantDB.models[m]) {
                try { tenantDB.model(m, require(`../models/${m}`)); } catch (e) {
                    console.error(`[SIGN_LETTER] Failed to register model ${m}:`, e.message);
                }
            }
        });

        const SignedLetter = tenantDB.model("SignedLetter");
        const GeneratedLetter = tenantDB.model("GeneratedLetter");
        const Applicant = tenantDB.model("Applicant");
        const Candidate = tenantDB.model("Candidate");
        const Notification = tenantDB.model("Notification");
        const Requirement = tenantDB.model("Requirement");
        const Employee = tenantDB.model("Employee");


        // 1. Verify Ownership & Existence
        const letter = await GeneratedLetter.findById(letterId);
        if (!letter) return res.status(404).json({ error: "Letter not found" });

        let applicant = null;
        let employee = null;

        if (letter.applicantId) {
            applicant = await Applicant.findById(letter.applicantId);
        }

        if (letter.employeeId) {
            employee = await Employee.findById(letter.employeeId);
        }

        if (!applicant && !employee) {
            return res.status(404).json({ error: "No associated Applicant or Employee found for this letter." });
        }

        // Verify ownership (Candidate or Employee context)
        if (req.candidate.role === 'candidate') {
            if (applicant && applicant.candidateId?.toString() !== id.toString()) {
                return res.status(403).json({ error: "Unauthorized: This letter does not belong to you." });
            }
        } else {
            // Employee context - verify by employee ID
            if (employee && employee._id.toString() !== id.toString()) {
                return res.status(403).json({ error: "Unauthorized: This letter does not belong to you." });
            }
        }

        // 2. Update Digital Signature (for persistent profile and HR visibility)
        if (req.candidate.role === 'candidate') {
            await Candidate.findByIdAndUpdate(id, { digitalSignature: signatureImage });
        } else {
            await Employee.findByIdAndUpdate(id, { digitalSignature: signatureImage });
        }

        if (!letter.tenant) {
            letter.tenant = tenantId;
        }

        const signerName =
            applicant?.name ||
            [employee?.firstName, employee?.lastName].filter(Boolean).join(' ').trim() ||
            req.candidate?.name ||
            'Candidate';
        const signerCandidateId = req.candidate.role === 'candidate' ? id : (applicant?.candidateId || id);

        // 3. Prevent Double Signing Records (Idempotency)
        const matchCondition = req.candidate.role === 'candidate' ? { letterId, candidateId: id } : { letterId };
        const existing = await SignedLetter.findOne(matchCondition);
        if (existing) {
            // We still update the PDF if it's missing for some reason
            // console.log(`[SIGN_LETTER] Already signed record exists for ${id}`);
        }

        // 4. GENERATE SIGNED PDF IMMEDIATELY
        let signedPdfRelativePath = null;
        try {
            // Locate original PDF
            const uploadsDir = path.join(__dirname, '..', 'uploads');
            // Clean paths of leading slashes and normailize separators
            let relativePdfPath = (letter.pdfPath || '').replace(/^[\\/]+/, '').replace(/\\/g, '/');

            // Remove 'uploads' prefix if present to avoid double stacking
            if (relativePdfPath.startsWith('uploads/')) {
                relativePdfPath = relativePdfPath.replace(/^uploads\//, '');
            }

            let absoluteOriginalPath = path.join(uploadsDir, relativePdfPath);

            if (!fs.existsSync(absoluteOriginalPath)) {
                console.warn(`[SIGN_LETTER] Path not found: ${absoluteOriginalPath}. Trying fallback.`);
                const fallbackPath = path.join(process.cwd(), (letter.pdfPath || '').replace(/\\/g, '/'));
                if (fs.existsSync(fallbackPath)) {
                    absoluteOriginalPath = fallbackPath;
                }
            }

            if (fs.existsSync(absoluteOriginalPath)) {
                // console.log(`[SIGN_LETTER] Overlaying signature on: ${absoluteOriginalPath}`);

                const existingPdfBytes = fs.readFileSync(absoluteOriginalPath);
                const pdfDoc = await PDFDocument.load(existingPdfBytes);
                const pages = pdfDoc.getPages();
                const lastPage = pages[pages.length - 1];
                const { width, height } = lastPage.getSize();

                // Process signature image
                const base64Data = signatureImage.split(',')[1] || signatureImage;
                const signatureBuffer = Buffer.from(base64Data, 'base64');

                let embeddedImage;
                try {
                    embeddedImage = await pdfDoc.embedPng(signatureBuffer);
                } catch (e) {
                    embeddedImage = await pdfDoc.embedJpg(signatureBuffer);
                }

                // Dynamic Positioning from Frontend (Percentage based)
                const { x: xPct = 74, y: yPct = 80, scale: userScale = 0.4, widthPct, applyToAllPages = false } = signaturePosition || {};

                // Compensation for Chrome native PDF viewer padding
                // The iframe in the frontend leaves a top margin, making the visual yPct smaller.
                // We add 3.5% to push the actual PDF placement down to match the visual location.
                const adjustedYPct = yPct;

                const pagesToSign = applyToAllPages ? pages : [pages[pages.length - 1]];

                for (const page of pagesToSign) {
                    const { width: pageWidth, height: pageHeight } = page.getSize();
                    
                    let imgDims;
                    if (widthPct) {
                        const targetWidth = (widthPct / 100) * pageWidth;
                        const proportionalHeight = embeddedImage.height * (targetWidth / embeddedImage.width);
                        imgDims = { width: targetWidth, height: proportionalHeight };
                    } else {
                        imgDims = embeddedImage.scale(userScale);
                    }

                    // Convert percentage to absolute points
                    // Note: pdf-lib uses bottom-left origin (0,0)
                    const xPos = (xPct / 100) * pageWidth;
                    const yPos = (1 - (adjustedYPct / 100)) * pageHeight - imgDims.height;

                    page.drawImage(embeddedImage, {
                        x: xPos,
                        y: yPos,
                        width: imgDims.width,
                        height: imgDims.height,
                    });

                    // Add text timestamp
                    const dateStr = `Digitally Signed by ${signerName} on ${new Date().toLocaleDateString('en-GB')}`;
                    page.drawText(dateStr, {
                        x: xPos,
                        y: yPos - 12,
                        size: 7,
                        color: rgb(0.4, 0.4, 0.4)
                    });
                }

                const pdfBytes = await pdfDoc.save();

                // Determine Output Path
                const originalDir = path.dirname(absoluteOriginalPath);
                const originalName = path.basename(absoluteOriginalPath);
                const signedFileName = `Signed_${originalName}`;
                const absoluteSignedPath = path.join(originalDir, signedFileName);

                // Save to Disk
                fs.writeFileSync(absoluteSignedPath, Buffer.from(pdfBytes));

                // Construct relative path for DB (convention is relative to uploads/)
                signedPdfRelativePath = path.relative(uploadsDir, absoluteSignedPath).replace(/\\/g, '/');

            } else {
                console.warn(`[SIGN_LETTER] Original PDF not found at ${absoluteOriginalPath}, skipping overlay.`);
            }
        } catch (pdfErr) {
            console.error(`[SIGN_LETTER] PDF Overlay failed:`, pdfErr);
        }

        // 5. Save Signature Record
        if (!existing) {
            const signedLetter = new SignedLetter({
                tenant: tenantId,
                letterId,
                candidateId: signerCandidateId,
                signatureImage,
                signaturePosition: signaturePosition || letter.signaturePosition,
                signedAt: new Date(),
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            try {
                await signedLetter.save();
            } catch (saveErr) {
                if (saveErr?.code !== 11000) throw saveErr;
                console.warn(`[SIGN_LETTER] Duplicate signature record ignored for ${letterId}/${signerCandidateId}`);
            }
        }

        // 6. Update GeneratedLetter status and path
        letter.status = 'Signed';
        if (letter.letterType === 'joining') {
            letter.joiningLetterStatus = letter.joiningLetterStatus || 'accepted';
        }
        if (signedPdfRelativePath) {
            letter.signedPdfPath = signedPdfRelativePath; // Note: stored relative to uploads
        }
        if (!letter.tenant) {
            letter.tenant = tenantId;
        }
        await letter.save();

        // 7. Update Applicant/Employee Status & Timeline
        if (applicant) {
            if (letter.letterType === 'joining') {
                applicant.status = 'Joining Letter Signed';
                applicant.joiningLetterStatus = 'SIGNED';
                if (signedPdfRelativePath) {
                    applicant.joiningLetterPath = `uploads/${signedPdfRelativePath}`;
                }

                // Add to timeline
                if (!applicant.timeline) applicant.timeline = [];
                applicant.timeline.push({
                    status: 'Joining Letter Signed',
                    message: `Candidate has digitally signed the Joining Letter. Onboarding automation is starting.`,
                    updatedBy: 'Candidate',
                    timestamp: new Date()
                });
            } else {
                // Default to Offer
                applicant.status = 'Offer Accepted – Awaiting Company Approval';
                applicant.offerStatus = 'ACCEPTED';
                applicant.isSigned = true;
                if (signedPdfRelativePath) {
                    applicant.signedOfferPath = `uploads/${signedPdfRelativePath}`;
                }

                // Add to timeline
                if (!applicant.timeline) applicant.timeline = [];
                applicant.timeline.push({
                    status: 'Letter Signed',
                    message: `Candidate has digitally signed the Offer Letter. Awaiting final company seal/stamp.`,
                    updatedBy: 'Candidate',
                    timestamp: new Date()
                });
            }
            await applicant.save();
        }

        if (employee) {
            // Update employee record if internal
            if (letter.letterType === 'joining') {
                employee.joiningLetterStatus = 'SIGNED';
                if (signedPdfRelativePath) {
                    employee.joiningLetterPath = `uploads/${signedPdfRelativePath}`;
                }
            } else if (letter.letterType === 'offer' || letter.letterType === 'appointment') {
                employee.isLetterSigned = true;
                if (signedPdfRelativePath) {
                    employee.signedLetterPath = `uploads/${signedPdfRelativePath}`;
                }
            }

            // Add to timeline if Employee has one (optional depending on schema)
            if (employee.timeline) {
                employee.timeline.push({
                    status: 'Letter Signed',
                    message: `Employee has digitally signed the ${letter.letterType} letter.`,
                    updatedBy: 'Employee',
                    timestamp: new Date()
                });
            }
            await employee.save();
        }

        let job = null;
        if (applicant?.requirementId) {
            job = await Requirement.findById(applicant.requirementId).select('createdBy').lean().catch(() => null);
        }

        // 8. Notify HR
        try {
            if (job && job.createdBy && applicant) {
                const isJoiningLetter = letter.letterType === 'joining';
                await Notification.create({
                    tenant: tenantId,
                    receiverId: job.createdBy,
                    receiverRole: 'hr',
                    entityType: 'Application',
                    entityId: applicant._id,
                    title: isJoiningLetter ? 'Joining Letter Signed' : 'Letter Signed',
                    message: isJoiningLetter
                        ? `${applicant.name} has signed the joining letter. Please review and apply company seal to start onboarding.`
                        : `${applicant.name} has signed the ${letter.letterType}. Please review and apply company stamp.`,
                    isRead: false
                });
            }
        } catch (notifErr) {
            console.warn("[SIGN_LETTER] Notification failed:", notifErr.message);
        }

        const responseMessage = letter.letterType === 'joining'
            ? 'Joining letter signed successfully. HR will verify and finalize your onboarding soon.'
            : "Letter signed successfully!";

        res.json({
            success: true,
            message: responseMessage,
            signedAt: new Date(),
            signedPdfPath: signedPdfRelativePath
        });

    } catch (err) {
        console.error("Sign Letter Error:", err);
        res.status(500).json({ error: "Failed to sign letter", details: err.message });
    }
};

exports.sendForgotPasswordOtp = async (req, res) => {
    try {
        const { email, tenantId } = req.body;
        if (!email || !tenantId) return res.status(400).json({ error: 'Email and tenant ID are required' });

        const db = await getTenantDB(tenantId);
        if (!db) return res.status(404).json({ error: 'Tenant not found' });

        const Candidate = db.model('Candidate');

        const candidate = await Candidate.findOne({ email: email.toLowerCase() });
        if (!candidate) return res.status(404).json({ error: 'Account not found for this email' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        candidate.resetPasswordOtp = otp;
        candidate.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
        await candidate.save();

        const html = `
            <h2>Password Reset Request</h2>
            <p>Your verification code is: <strong>${otp}</strong></p>
            <p>This code will expire in 15 minutes. If you did not request a password reset, please ignore this email.</p>
        `;
        
        await EmailService.sendEmail(email, "Password Reset Verification Code", html, [], tenantId);

        const responseData = { success: true, message: 'Verification code sent to your email.' };
        if (process.env.NODE_ENV !== 'production') {
            responseData.debugOtp = otp;
            console.log(`[CANDIDATE_FORGOT_PASSWORD_OTP_DEBUG] OTP for ${email} is ${otp}`);
        }

        res.json(responseData);
    } catch (err) {
        console.error("sendForgotPasswordOtp Error:", err);
        res.status(500).json({ error: "Failed to send OTP", details: err.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { email, tenantId, otp, newPassword } = req.body;
        if (!email || !tenantId || !otp || !newPassword) return res.status(400).json({ error: 'All fields are required' });

        const db = await getTenantDB(tenantId);
        if (!db) return res.status(404).json({ error: 'Tenant not found' });

        const Candidate = db.model('Candidate');

        let candidate;
        const isDevBypass = process.env.NODE_ENV !== 'production' && String(otp) === '123456';
        if (isDevBypass) {
            candidate = await Candidate.findOne({ email: email.toLowerCase() });
        } else {
            candidate = await Candidate.findOne({
                email: email.toLowerCase(),
                resetPasswordOtp: otp,
                resetPasswordExpires: { $gt: Date.now() }
            });
        }

        if (!candidate) return res.status(400).json({ error: 'Invalid or expired OTP' });

        const salt = await bcrypt.genSalt(10);
        candidate.password = await bcrypt.hash(newPassword, salt);
        candidate.resetPasswordOtp = undefined;
        candidate.resetPasswordExpires = undefined;
        await candidate.save();

        res.json({ success: true, message: 'Password reset successfully!' });
    } catch (err) {
        console.error("resetPassword Error:", err);
        res.status(500).json({ error: "Failed to reset password", details: err.message });
    }
};

exports.updateCandidateResume = async (req, res) => { res.status(501).json({ error: 'Not implemented yet' }); };
