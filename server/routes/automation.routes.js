const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automation.controller');
const auth = require('../middleware/auth.jwt'); // JWT auth middleware

// All routes require authentication
router.use(auth.authenticate);

router.get('/', automationController.getAutomations);
router.post('/', automationController.createAutomation);
router.put('/:id', automationController.updateAutomation);
router.delete('/:id', automationController.deleteAutomation);

module.exports = router;
