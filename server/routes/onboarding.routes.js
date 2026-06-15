const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ctrl = require('../controllers/onboarding.controller');
const dynamicCtrl = require('../controllers/dynamicOnboarding.controller');
const { authenticate } = require('../middleware/auth.jwt');
const { checkPermission } = require('../middleware/rbac.middleware');
const checkModuleAccess = require('../middleware/moduleAccess.middleware');

const router = express.Router();

const allowedDocumentMimes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/jfif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
]);

function documentFileFilter(_req, file, cb) {
  const allowedExtensions = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.jfif', '.doc', '.docx']);
  const ext = path.extname(file.originalname || '').toLowerCase();
  
  // Allow if both match OR if it's a known extension and mimetype is generic application/octet-stream
  const mimeMatch = allowedDocumentMimes.has(file.mimetype);
  const extMatch = allowedExtensions.has(ext);

  if (extMatch && (mimeMatch || file.mimetype === 'application/octet-stream' || file.mimetype.startsWith('image/'))) {
    return cb(null, true);
  }
  
  return cb(new Error('unsupported_onboarding_document_type'));
}

const publicStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'onboarding', 'incoming');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const publicUpload = multer({
  storage: publicStorage,
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: documentFileFilter,
});

function runUpload(uploadMiddleware) {
  return (req, res, next) => {
    uploadMiddleware(req, res, (error) => {
      if (error) return res.status(400).json({ success: false, message: error.message || 'document_upload_failed' });
      return next();
    });
  };
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const tenantId = req.tenantId || req.user?.tenantId || 'common';
    const dir = path.join(__dirname, '..', 'uploads', 'onboarding', String(tenantId));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: documentFileFilter,
});

// Public candidate onboarding portal. Keep this before auth/module gates so
// emailed invite links can be opened without an HRMS session.
router.get('/portal/:token', dynamicCtrl.getPublicPortal);
router.post('/portal/:token/upload', runUpload(publicUpload.single('file')), dynamicCtrl.uploadPublicDocument);
router.post('/portal/:token/submit', dynamicCtrl.submitPublicPortal);
// Keep existing ones for legacy
router.get('/:token([A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+)?', ctrl.getPublicPortal);
router.post('/progress', ctrl.savePublicProgress);
router.post('/submit', runUpload(publicUpload.array('documents', 10)), ctrl.submitPublicPortal);

router.use(authenticate);
router.use(checkModuleAccess('onboarding'));

router.get('/dashboard', checkPermission('onboarding.dashboard', 'view'), ctrl.getDashboard);
router.get('/pipeline', checkPermission('onboarding.dashboard', 'view'), ctrl.getPipeline);
router.patch('/pipeline/:id/status', checkPermission('onboarding.dashboard', 'edit'), ctrl.updatePipelineStatus);
router.post('/invite', checkPermission('onboarding.instances', 'create'), ctrl.inviteCandidate);
router.post('/dynamic-invite', checkPermission('onboarding.instances', 'create'), dynamicCtrl.inviteCandidate);
router.post('/verify-submission', checkPermission('onboarding.documents', 'edit'), dynamicCtrl.verifySubmission);
router.post('/verify', checkPermission('onboarding.documents', 'edit'), ctrl.verifyOnboarding);
router.post('/activate', checkPermission('onboarding.instances', 'edit'), ctrl.activateOnboarding);
router.get('/templates', checkPermission('onboarding.templates', 'view'), dynamicCtrl.getTemplates);
router.post('/templates', checkPermission('onboarding.templates', 'create'), dynamicCtrl.createTemplate);
router.put('/templates/:id', checkPermission('onboarding.templates', 'edit'), dynamicCtrl.createTemplate); // Reuse create for editing draft
router.post('/templates/:id/publish', checkPermission('onboarding.templates', 'edit'), dynamicCtrl.publishTemplate);
router.post('/templates/:id/duplicate', checkPermission('onboarding.templates', 'create'), dynamicCtrl.duplicateTemplate);
router.get('/instances', checkPermission('onboarding.dashboard', 'view'), ctrl.listInstances);
router.post('/start', checkPermission('onboarding.instances', 'create'), ctrl.startOnboarding);
router.get('/task-board', checkPermission('onboarding.tasks', 'view'), ctrl.getTaskBoard);
router.get('/my-portal', checkPermission('onboarding.employeePortal', 'view'), ctrl.getMyPortal);
router.patch('/employee/profile', checkPermission('onboarding.employeePortal', 'edit'), ctrl.updateMyProfile);
router.post('/employee/accept-offer', checkPermission('onboarding.employeePortal', 'edit'), ctrl.acceptOffer);
router.post('/documents/upload', checkPermission('onboarding.documents', 'create'), runUpload(upload.single('file')), ctrl.uploadDocument);
router.patch('/documents/:id/verify', checkPermission('onboarding.documents', 'edit'), ctrl.verifyDocument);
router.patch('/tasks/:id', checkPermission('onboarding.tasks', 'edit'), ctrl.updateTask);
router.get('/:id', checkPermission('onboarding.dashboard', 'view'), ctrl.getInstanceDetail);

module.exports = router;
