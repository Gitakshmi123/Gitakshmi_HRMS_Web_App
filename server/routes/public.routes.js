const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');
const publicCareerController = require('../controllers/publicCareer.controller');
const { uploadResume, handleUploadError } = require('../middleware/publicCareerUpload.middleware');
const {
  publicCareerReadLimiter,
  publicCareerApplyLimiter,
} = require('../middleware/publicCareerRateLimit.middleware');
const {
  listJobsQuery,
  applyJobBody,
  validate,
} = require('../validations/publicCareer.validation');

const { authenticate } = require('../middleware/auth.jwt');

// Multer error handler
const handleMulterError = (err, req, res, next) => {
  if (err) {
    console.error('❌ [MULTER ERROR]:', err.message);
    return res.status(400).json({ error: 'File upload error: ' + err.message });
  }
  next();
};

// Public job application route (no auth required)
// Public job application route (no auth required)
router.get('/jobs', publicCareerReadLimiter, validate(listJobsQuery, 'query'), publicCareerController.getJobs);
router.get('/careers/jobs', publicCareerReadLimiter, validate(listJobsQuery, 'query'), publicCareerController.getJobs);
router.post(
  '/jobs/apply',
  publicCareerApplyLimiter,
  uploadResume.single('resume'),
  handleUploadError,
  validate(applyJobBody, 'body'),
  publicCareerController.applyJob
);
router.get('/resolve-code/:code', publicController.resolveCompanyCode);
router.get('/tenant/:tenantId', publicController.getTenantBasicDetails); // New endpoint
router.get('/jobs/:id', publicCareerReadLimiter, publicCareerController.getJobById);
router.get('/jobs/:companyCode', publicController.getPublicJobsByCompanyCode);
router.get('/job/:id', publicController.getPublicJobById);
router.post('/apply-job', publicController.applyJob);

router.get('/career-customization/:tenantId', publicController.getCareerCustomization);

router.post('/resume/parse', publicController.parseResumePublic);
router.post('/document/parse', publicController.parseDocumentPublic);

// PDF Viewer for Candidate Portal
const letterCtrl = require('../controllers/letter.controller');
router.get('/letters/:id/view-pdf', letterCtrl.viewCandidatePDF);

// Public Offer Letter Approval Routes
router.get('/letters/:id/details', letterCtrl.getLetterDetailsPublic);
router.post('/letters/:id/approve', letterCtrl.approveOfferPublic);
router.post('/letters/:id/reject', letterCtrl.rejectOfferPublic);

router.use(publicCareerController.errorHandler);

module.exports = router;
