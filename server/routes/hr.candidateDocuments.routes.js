const express = require('express');
const router = express.Router();
const candidateDocumentController = require('../controllers/candidateDocument.controller');

/**
 * HR Candidate Documents Management routes
 * (Base mount point: /api/recruitment/candidate-documents)
 */
router.post('/request/:applicationId', candidateDocumentController.sendDocumentRequest);
router.get('/records', candidateDocumentController.getRecords);
router.get('/records/:id', candidateDocumentController.getRecordDetails);
router.post('/approve/:id', candidateDocumentController.approveRecord);
router.post('/reject/:id', candidateDocumentController.rejectRecord);
router.post('/request-changes/:id', candidateDocumentController.requestChanges);

module.exports = router;
