const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createOnboardingSuiteController } = require('./controller');
const { ALLOWED_MIME_TYPES } = require('./storage');

function createUpload() {
  const tempDir = path.join(__dirname, '..', '..', 'uploads', 'onboarding-suite', 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  return multer({
    dest: tempDir,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_MIME_TYPES.has(file.mimetype)) return cb(null, true);
      return cb(new Error('unsupported_file_type'));
    },
  });
}

function createOnboardingSuiteRouter({ authenticate, authorizeAdmin, controller } = {}) {
  const router = express.Router();
  const upload = createUpload();
  const ctrl = controller || createOnboardingSuiteController();

  if (authenticate) router.use(authenticate);

  const admin = authorizeAdmin || ((_req, _res, next) => next());

  router.get('/templates', admin, ctrl.listTemplates);
  router.post('/templates', admin, ctrl.createTemplate);

  router.get('/assignments', ctrl.listAssignments);
  router.post('/assignments', admin, ctrl.assignWorkflow);
  router.get('/assignments/:assignmentId', ctrl.getAssignment);

  router.post('/assignments/:assignmentId/steps/:stepKey/start', ctrl.startStep);
  router.post('/assignments/:assignmentId/steps/:stepKey/complete', ctrl.completeStep);
  router.post('/assignments/:assignmentId/steps/:stepKey/retry', ctrl.retryStep);

  router.post('/approvals/:approvalId/approve', admin, ctrl.approve);
  router.post('/approvals/:approvalId/reject', admin, ctrl.reject);

  router.post('/documents/upload', upload.single('file'), ctrl.uploadDocument);
  router.patch('/documents/:documentId/review', admin, ctrl.reviewDocument);

  router.post('/face/register', ctrl.registerFace);
  router.post('/face/:faceProfileId/approve', admin, ctrl.approveFace);
  router.post('/face/verify', ctrl.verifyFace);

  router.post('/attendance/:type(punch_in|punch_out)', ctrl.punch);

  router.post('/notification-templates', admin, ctrl.seedNotificationTemplate);

  router.use((error, _req, res, _next) => {
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'onboarding_suite_error',
    });
  });

  return router;
}

module.exports = { createOnboardingSuiteRouter };
