const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const CandidateSchema = require('../models/Candidate');
const ApplicantSchema = require('../models/Applicant');
const RequirementSchema = require('../models/Requirement');
const { generateIdInternal } = require('./companyIdConfig.controller');

/**
 * HELPER: Get JWT Token
 */
const generateToken = (candidate) => {
    return jwt.sign(
        {
            id: candidate._id.toString(),
            tenantId: candidate.tenant.toString(),
            email: candidate.email,
            role: 'candidate'
        },
        process.env.JWT_SECRET || 'hrms@123',
        { expiresIn: '7d' }
    );
};

/**
 * POST /api/public/auth/register
 */
exports.register = async (req, res) => {
    try {
        const { fullName, email, phone, password, confirmPassword } = req.body;
        const tenantDB = req.tenantDB;
        const tenantId = req.publicTenant._id;

        if (!fullName || !email || !password || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'Passwords do not match' });
        }

        const Candidate = tenantDB.model('Candidate', CandidateSchema);

        const existing = await Candidate.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate Candidate ID
        const idResult = await generateIdInternal({
            tenantId: String(tenantId),
            entityType: 'CANDIDATE',
            increment: true
        });

        const candidate = new Candidate({
            tenant: tenantId,
            candidateId: idResult.id,
            name: fullName,
            email: email.toLowerCase(),
            mobile: phone,
            password: hashedPassword,
            resume: req.file ? req.file.path : null
        });

        await candidate.save();

        // Link existing applications by email
        const Applicant = tenantDB.model('Applicant', ApplicantSchema);
        await Applicant.updateMany(
            { email: email.toLowerCase() },
            { $set: { candidateId: candidate._id } }
        );

        const token = generateToken(candidate);

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            token,
            candidate: {
                id: candidate._id,
                fullName: candidate.name,
                email: candidate.email
            }
        });
    } catch (err) {
        console.error('[REGISTER_ERROR]', err);
        res.status(500).json({ success: false, message: 'Registration failed', error: err.message });
    }
};

/**
 * POST /api/public/auth/login
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const tenantDB = req.tenantDB;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password required' });
        }

        const Candidate = tenantDB.model('Candidate', CandidateSchema);
        const candidate = await Candidate.findOne({ email: email.toLowerCase(), isDeleted: false });

        if (!candidate || !(await bcrypt.compare(password, candidate.password))) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = generateToken(candidate);

        res.json({
            success: true,
            message: 'Login successful',
            token,
            candidate: {
                id: candidate._id,
                fullName: candidate.name,
                email: candidate.email,
                tenantId: candidate.tenant
            }
        });
    } catch (err) {
        console.error('[LOGIN_ERROR]', err);
        res.status(500).json({ success: false, message: 'Login failed', error: err.message });
    }
};

/**
 * GET /api/public/profile
 */
exports.getProfile = async (req, res) => {
    try {
        const { id } = req.candidate;
        const tenantDB = req.tenantDB;

        const Candidate = tenantDB.model('Candidate', CandidateSchema);
        const candidate = await Candidate.findById(id).select('-password');

        if (!candidate) {
            return res.status(404).json({ success: false, message: 'Profile not found' });
        }

        res.json({
            success: true,
            profile: {
                fullName: candidate.name,
                email: candidate.email,
                mobile: candidate.mobile,
                skills: candidate.skills || [],
                experience: candidate.experience || [],
                education: candidate.education || [],
                resume: candidate.resume,
                createdAt: candidate.createdAt
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch profile', error: err.message });
    }
};

/**
 * GET /api/public/applications
 */
exports.getApplications = async (req, res) => {
    try {
        const { id } = req.candidate;
        const { page = 1, limit = 10, search, status } = req.query;
        const tenantDB = req.tenantDB;

        const Applicant = tenantDB.model('Applicant', ApplicantSchema);
        if (!tenantDB.models.Requirement) tenantDB.model('Requirement', RequirementSchema);

        const query = { candidateId: id, isDeleted: false };
        if (status) query.status = status;

        // Search logic (join with Requirement title)
        // Note: For large datasets, a more efficient join/aggregation would be better
        const applications = await Applicant.find(query)
            .populate('requirementId', 'jobTitle department location')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Applicant.countDocuments(query);

        res.json({
            success: true,
            applications,
            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch applications', error: err.message });
    }
};

/**
 * GET /api/public/applications/:id
 */
exports.getApplicationById = async (req, res) => {
    try {
        const { id: candidateId } = req.candidate;
        const { id: applicationId } = req.params;
        const tenantDB = req.tenantDB;

        const Applicant = tenantDB.model('Applicant', ApplicantSchema);
        if (!tenantDB.models.Requirement) tenantDB.model('Requirement', RequirementSchema);

        const application = await Applicant.findOne({ _id: applicationId, candidateId, isDeleted: false })
            .populate('requirementId', 'jobTitle department description location jobType');

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        res.json({
            success: true,
            application
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch application details', error: err.message });
    }
};

/**
 * DELETE /api/public/applications/:id (Withdraw)
 */
exports.withdrawApplication = async (req, res) => {
    try {
        const { id: candidateId } = req.candidate;
        const { id: applicationId } = req.params;
        const tenantDB = req.tenantDB;

        const Applicant = tenantDB.model('Applicant', ApplicantSchema);
        const application = await Applicant.findOne({ _id: applicationId, candidateId, isDeleted: false });

        if (!application) {
            return res.status(404).json({ success: false, message: 'Application not found' });
        }

        // Prevent deleting if already hired
        if (['Hired', 'Offered', 'Offer Accepted'].includes(application.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot withdraw application as it has already progressed to a critical stage.'
            });
        }

        application.isDeleted = true;
        application.status = 'Withdrawn';
        application.timeline.push({
            status: 'Withdrawn',
            message: 'Application withdrawn by candidate',
            updatedBy: 'Candidate',
            timestamp: new Date()
        });

        await application.save();

        res.json({
            success: true,
            message: 'Application withdrawn successfully'
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to withdraw application', error: err.message });
    }
};


exports.submitApplicationProfile = async (req, res) => { try { const { id: candidateId } = req.candidate; const { id: applicationId } = req.params; const Applicant = req.tenantDB.model('Applicant'); const app = await Applicant.findOne({ _id: applicationId, candidateId }); if (!app) return res.status(404).json({success: false, message: 'Application not found'}); app.customData = { ...app.customData, employeeData: req.body }; app.status = 'Profile Submitted'; await app.save(); res.json({success: true, message: 'Profile submitted successfully', application: app}); } catch (err) { res.status(500).json({success: false, message: err.message}); } };
