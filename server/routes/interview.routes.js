const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const interviewCtrl = require('../controllers/interview.controller');

// All routes here are prefixed with /api/interviews
router.get('/:id', auth.authenticate, interviewCtrl.getInterview);

module.exports = router;
