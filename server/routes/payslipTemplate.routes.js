const express = require('express');
const router = express.Router();
const payslipTemplateController = require('../controllers/payslipTemplate.controller');
const auth = require('../middleware/auth.jwt');
const tenantMiddleware = require('../middleware/tenant.middleware');

// Apply protection to all routes
router.use(auth.authenticate);
router.use(auth.requireHr);
// Ensure tenantDB is resolved AFTER auth (global tenant middleware runs before auth on some mounts).
router.use(tenantMiddleware);

router.get('/', payslipTemplateController.getTemplates);
router.get('/:id', payslipTemplateController.getTemplateById);
router.post('/', payslipTemplateController.createTemplate);
router.post('/upload-word', payslipTemplateController.uploadWordTemplate);
router.put('/:id', payslipTemplateController.updateTemplate);
router.delete('/:id', payslipTemplateController.deleteTemplate);

// Specific actions
router.post('/preview', payslipTemplateController.previewTemplate);
router.post('/render/:payslipId', payslipTemplateController.renderPayslipPDF);

module.exports = router;
