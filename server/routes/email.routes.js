const express = require('express');
const router = express.Router();
const emailController = require('../controllers/email.controller');

// Route to send test email
// Endpoint: POST /api/email/send
router.post('/send', emailController.sendTestEmail);

module.exports = router;
