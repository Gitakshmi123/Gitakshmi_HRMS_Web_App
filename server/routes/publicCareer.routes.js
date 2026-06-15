const express = require('express');
const router = express.Router();
const publicCareerController = require('../controllers/publicCareer.controller');
const { uploadResume, handleUploadError } = require('../middleware/publicCareerUpload.middleware');

/**
 * PUBLIC CAREER PORTAL ROUTES
 * 
 * BASE URL: /api/public/careers
 */

// 1. GET ALL PUBLIC JOBS
// Supports: search, location, department, page, limit
router.get('/jobs', publicCareerController.getJobs);

// 2. GET SINGLE JOB DETAILS
router.get('/jobs/:id', publicCareerController.getJobById);

// 3. APPLY FOR JOB
// Required Body: jobId, fullName, email, phone, coverLetter
// Required File: resume
router.post('/apply', uploadResume.single('resume'), handleUploadError, publicCareerController.applyJob);

// Global Public API Error Handler
router.use(publicCareerController.errorHandler);

module.exports = router;
