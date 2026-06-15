const express = require('express');
const router = express.Router();
const letterCtrl = require('../controllers/letter.controller');
const { authenticate, requireHr } = require('../middleware/auth.jwt');

router.get('/documents/:documentId/status', letterCtrl.getDocumentStatus);
router.get('/documents/:documentId/enforce-access', authenticate, letterCtrl.enforceDocumentAccess);
router.post('/documents/:documentId/revoke', authenticate, requireHr, letterCtrl.revokeLetter);
router.post('/revocations/:revocationId/reinstate', authenticate, letterCtrl.reinstateLetter);
router.get('/documents/:documentId/audit-trail', authenticate, requireHr, letterCtrl.getDocumentAuditTrail);
router.get('/documents/:documentId/revocation-history', authenticate, requireHr, letterCtrl.getRevocationHistory);

module.exports = router;
