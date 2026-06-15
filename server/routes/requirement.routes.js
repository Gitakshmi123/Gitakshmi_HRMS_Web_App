const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const checkModuleAccess = require('../middleware/moduleAccess.middleware');
const requireActiveEmployee = require('../middleware/requireActiveEmployee');
const { checkPermission } = require('../middleware/rbac.middleware');
const reqCtrl = require('../controllers/requirement.controller');
const applicantCtrl = require('../controllers/applicant.controller');
const salaryCtrl = require('../controllers/salary.controller');
// const offerCtrl = require('../controllers/offer.controller');

// Employee Accessible Routes (Internal Jobs; write blocked for deactivated accounts)
router.get('/internal-jobs', checkPermission('employee.jobs', 'view'), reqCtrl.getInternalJobs);
router.post('/internal-apply/:id', checkPermission('employee.jobs', 'create'), requireActiveEmployee, reqCtrl.applyInternal);
router.get('/my-applications', checkPermission('employee.jobs', 'view'), reqCtrl.getMyApplications);
router.get('/my-referrals', checkPermission('employee.jobs', 'view'), reqCtrl.getMyReferrals);
router.delete('/my-applications/:id/withdraw', checkPermission('employee.jobs', 'delete'), requireActiveEmployee, reqCtrl.withdrawInternal);

// Referral codes (ESS)
router.post('/referral/register', checkPermission('employee.jobs', 'view'), requireActiveEmployee, reqCtrl.registerReferralCode);
router.get('/referral/resolve', checkPermission('employee.jobs', 'view'), reqCtrl.resolveReferralCode);

// Require HR role and Recruitment Module Access for management routes
router.use(auth.requireHr);
router.use(checkModuleAccess('recruitment'));

const reqTmplCtrl = require('../controllers/requirementTemplate.controller');

// Template Management Routes
router.get('/test', (req, res) => res.json({ message: 'Requirement routes working', user: req.user }));
router.get('/template', reqTmplCtrl.getTemplate);
router.put('/template', reqTmplCtrl.updateTemplate);
// router.post('/template/reset', reqTmplCtrl.resetTemplate);

// Routes
router.post('/draft', reqCtrl.saveDraft);
router.get('/draft/:id', reqCtrl.getDraft);
router.post('/publish', reqCtrl.publishJob);
router.post('/interviewer-assignment-notify', reqCtrl.notifyInterviewerAssignment);

router.post('/create', reqCtrl.createRequirement);
router.patch('/:id/status', reqCtrl.updateStatus);

router.put('/:id', reqCtrl.updateRequirement);
router.delete('/:id', reqCtrl.deleteRequirement);

router.get('/list', reqCtrl.getRequirements);
router.get('/', reqCtrl.getRequirements); // Added to support GET /api/requirements
router.get('/by-date', reqCtrl.getRequirementsByDate);
router.get('/trend', reqCtrl.getRequirementsTrend);
router.get('/applicants', reqCtrl.getApplicants);
router.get('/applicants/:id', applicantCtrl.getApplicantById);

// HR referral analytics
router.get('/referral/stats', reqCtrl.getReferralStats);
// router.post('/offer-letter/:applicantId', offerCtrl.generateOfferLetter);

// Interview Management Routes
router.post('/applicants/:id/interview/schedule', applicantCtrl.scheduleInterview);
router.put('/applicants/:id/interview/reschedule', applicantCtrl.rescheduleInterview);
router.put('/applicants/:id/interview/complete', applicantCtrl.markInterviewCompleted);

// Applicant Salary Assignment Routes
router.post('/applicants/:id/assign-salary', salaryCtrl.assign);
router.post('/applicants/:id/confirm-salary', salaryCtrl.confirm);

router.patch('/applicants/:id/status', applicantCtrl.updateApplicantStatus);
router.put('/applicants/:id/status', applicantCtrl.updateApplicantStatus);
router.get('/applicants/:id/salary', applicantCtrl.getSalary);

// APPLICANTS - RE-SCORING
router.post('/applicants/:id/rescore', auth.authenticate, auth.requireHr, applicantCtrl.rescoreApplicant);
router.post('/:requirementId/rescore-all', auth.authenticate, auth.requireHr, applicantCtrl.rescoreAllApplicants);


// Joining Letter Routes
const letterCtrl = require('../controllers/letter.controller');
router.get('/joining-letter/:applicantId/preview', letterCtrl.viewJoiningLetter);
router.get('/joining-letter/:applicantId/download', letterCtrl.downloadJoiningLetter);

// --- EXCEL UPLOAD CONFIG ---
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `salary_excel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowed = ['.xlsx', '.xls', '.csv'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel/CSV files are allowed'));
        }
    }
});

// router.post('/applicants/:id/upload-salary-excel', auth.authenticate, auth.requireHr, upload.single('file'), applicantCtrl.uploadSalaryExcel);

// ==================== DOCUMENT UPLOAD ROUTES ====================

// Configure multer for document uploads
const documentUploadDir = path.join(__dirname, '..', 'uploads', 'documents');
if (!fs.existsSync(documentUploadDir)) fs.mkdirSync(documentUploadDir, { recursive: true });

const documentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, documentUploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const documentUpload = multer({
    storage: documentStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|jpg|jpeg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF, JPG, and PNG files are allowed'));
        }
    }
});

// POST /api/requirements/applicants/:id/documents - Upload documents
router.post('/applicants/:id/documents',
    auth.authenticate,
    auth.requireHr,
    documentUpload.array('documents', 10), // Max 10 files
    applicantCtrl.uploadDocuments
);

// PATCH /api/requirements/applicants/:id/documents/:docIndex/verify - Verify document
router.patch('/applicants/:id/documents/:docIndex/verify',
    auth.authenticate,
    auth.requireHr,
    applicantCtrl.verifyDocument
);

// ==================== END DOCUMENT ROUTES ====================

// Single requirement detail (keep near bottom so it does not shadow specific routes)
router.get('/:id', reqCtrl.getRequirementById);

module.exports = router;
