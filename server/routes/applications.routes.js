const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth.jwt');
const workflowController = require('../controllers/recruitment.workflow.controller');
const { validateHiringFlow, isStrictHiringStatus } = require('../utils/validateHiringFlow');
const applicantCtrl = require('../controllers/applicant.controller');

// Same auth behavior as recruitment workflow routes
router.use(auth.authenticate);

// GET /api/applications/:id — Fetch single application with status
router.get('/:id', applicantCtrl.getApplicantById);

// POST /api/applications/:id/request-documents — HR requests documents from candidate
router.post('/:id/request-documents', applicantCtrl.requestDocuments);

// POST /api/applications/:id/approve-profile - HR approves profile
router.post('/:id/approve-profile', applicantCtrl.approveProfile);

// POST /api/applications/:id/request-reupload - HR requests profile re-upload
router.post('/:id/request-reupload', applicantCtrl.requestReupload);

// POST /api/applications/:id/convert-to-employee - Convert to Employee
router.post('/:id/convert-to-employee', applicantCtrl.convertToEmployee);

router.patch('/:id/status', (req, res, next) => {
  // Enforce strict flow on this alias endpoint
  try {
    const nextStatus = req.body?.status;
    // current status is loaded inside controller; we do a second validation there via model,
    // but we keep this guard here to guarantee "Invalid workflow transition" messaging.
    if (nextStatus && isStrictHiringStatus(nextStatus)) {
      req._enforceStrictHiringFlow = true;
    }
  } catch (_) {
    // ignore
  }

  req.params.applicationId = req.params.id;
  return workflowController.updateApplicationStatus(req, res, next);
});

module.exports = router;

