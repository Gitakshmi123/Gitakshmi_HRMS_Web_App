const express = require('express');
const router = express.Router();
const emailTemplateController = require('../controllers/emailTemplate.controller');
const auth = require('../middleware/auth.jwt'); // Assuming JWT auth middleware

// All routes require authentication
router.use(auth.authenticate);

// SMTP configuration
router.get('/smtp', emailTemplateController.getSmtpConfig);
router.put('/smtp', emailTemplateController.updateSmtpConfig);

// Templates CRUD
router.get('/', emailTemplateController.getTemplates);
router.post('/', emailTemplateController.createTemplate);
router.get('/:id', emailTemplateController.getTemplateById);
router.put('/:id', emailTemplateController.updateTemplate);
router.delete('/:id', emailTemplateController.deleteTemplate);

module.exports = router;
