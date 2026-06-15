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

