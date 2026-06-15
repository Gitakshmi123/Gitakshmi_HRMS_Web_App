/**
 * jobPortal.routes.js
 * COMPLETELY ISOLATED from HRMS routes
 * Handles ONLY candidate-related endpoints
 */
const express = require('express');
const router = express.Router();
const candidateController = require('../controllers/candidate.controller');
const { authenticateCandidate } = require('../middleware/jobPortalAuthMiddleware');
const getTenantDB = require('../utils/tenantDB');
const multer = require('multer');
const path = require('path');

// Multer Config for document uploads
const upload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 1024 * 1024 * 10 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images, PDFs, and Word documents are allowed'));
    }
  }
});

/**
 * PUBLIC Job Portal Routes (No Auth Required)
 */
router.post('/candidate/register', candidateController.registerCandidate);
router.post('/candidate/login', candidateController.loginCandidate);
router.post('/candidate/send-otp', candidateController.sendCandidateOtp);

/**
 * PROTECTED Job Portal Routes (Candidate Auth Only)
 */
router.get('/candidate/dashboard', authenticateCandidate, candidateController.getCandidateDashboard);
router.get('/candidate/check-status/:requirementId', authenticateCandidate, candidateController.checkApplicationStatus);
router.get('/candidate/application/track/:applicationId', authenticateCandidate, candidateController.trackApplication);
router.get('/candidate/application/onboarding/:applicationId/access', authenticateCandidate, candidateController.getOnboardingAccess);
router.post('/candidate/application/accept-offer/:applicationId', authenticateCandidate, candidateController.acceptOffer);

// BGV Documents
router.get('/candidate/application/bgv-documents/:applicationId', authenticateCandidate, candidateController.getBGVDocuments);
router.post('/candidate/application/bgv-documents/:applicationId/upload', authenticateCandidate, upload.single('document'), candidateController.uploadBGVDocument);
router.delete('/candidate/application/bgv-documents/:applicationId/:documentId', authenticateCandidate, candidateController.removeBGVDocument);


/**
 * Job Listing (Public)
 */
router.get('/jobs/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const tenantDB = await getTenantDB(companyId);
    const Requirement = tenantDB.model("Requirement");

    const jobs = await Requirement.find({ status: 'active' })
      .select('_id jobTitle department description location salary experience yearsOfExperience createdAt');

    res.json({
      jobs,
      company: { id: companyId }
    });
  } catch (err) {
    console.error('Get Jobs Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

/**
 * Job Application (Protected)
 */
router.post('/jobs/apply/:requirementId', authenticateCandidate, async (req, res) => {
  try {
    const { requirementId } = req.params;
    const { tenantId, id: candidateId } = req.candidate;
    const { coverLetter } = req.body;

    const tenantDB = await getTenantDB(tenantId);
    const Applicant = tenantDB.model("Applicant");

    // Check if already applied
    const existing = await Applicant.findOne({
      requirementId,
      candidateId
    });

    if (existing) {
      return res.status(400).json({ error: 'Already applied to this position' });
    }

    const Requirement = tenantDB.model("Requirement");
    const job = await Requirement.findById(requirementId).select('pipelineStages jobTitle');

    // Default to 'Applied' if no pipeline is defined, else use first stage from job
    const defaultStatus = (job && job.pipelineStages && job.pipelineStages.length > 0)
      ? job.pipelineStages[0].stageName
      : 'Applied';

    const Candidate = tenantDB.model("Candidate");
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return res.status(404).json({ error: 'Candidate profile not found' });

    const application = new Applicant({
      tenant: tenantId,
      requirementId,
      candidateId,
      name: candidate.name,
      email: candidate.email,
      mobile: candidate.mobile || 'N/A',
      coverLetter,
      source: 'External',
      status: defaultStatus,
      timeline: [{
        status: defaultStatus,
        message: `Application submitted for position: ${job?.jobTitle || 'N/A'}. Initial status: ${defaultStatus}`,
        timestamp: new Date()
      }]
    });

    await application.save();

    res.status(201).json({
      message: 'Application submitted successfully',
      applicationId: application._id
    });
  } catch (err) {
    console.error('Apply Job Error:', err.message);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

/**
 * Get Candidate Profile (Protected)
 */
router.get('/candidate/profile', authenticateCandidate, async (req, res) => {
  try {
    const { tenantId, id: candidateId } = req.candidate;
    const tenantDB = await getTenantDB(tenantId);
    const Candidate = tenantDB.model("Candidate");

    const candidate = await Candidate.findById(candidateId).select('-password');

    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    res.json(candidate);
  } catch (err) {
    console.error('Get Profile Error:', err.message);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * Update Candidate Profile (Protected)
 */
router.put('/candidate/profile', authenticateCandidate, async (req, res) => {
  try {
    const { tenantId, id: candidateId } = req.candidate;
    const { name, email, mobile, phone, address, dob, resume } = req.body;

    const tenantDB = await getTenantDB(tenantId);
    const Candidate = tenantDB.model("Candidate");

    const candidate = await Candidate.findByIdAndUpdate(
      candidateId,
      {
        name,
        email,
        mobile,
        phone,
        address,
        dob,
        resume,
        updatedAt: new Date()
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      candidate
    });
  } catch (err) {
    console.error('Update Profile Error:', err.message);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
