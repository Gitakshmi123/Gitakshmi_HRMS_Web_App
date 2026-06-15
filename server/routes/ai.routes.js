const express = require('express');
const router = express.Router();
const aiCtrl = require('../controllers/ai.controller');
const auth = require('../middleware/auth.jwt');

router.post('/generate-job-description', auth.authenticate, auth.requireHr, aiCtrl.generateJobDescription);
// Chatbot endpoints disabled
// router.post('/hrms-assistant', auth.authenticate, aiCtrl.hrmsAssistantQuery);
// router.post('/hrms-assistant/parse', auth.authenticate, aiCtrl.hrmsAssistantParse);
// router.post('/hrms-assistant/respond', auth.authenticate, aiCtrl.hrmsAssistantRespond);

module.exports = router;
