const express = require('express');
const router = express.Router();
const activityCtrl = require('../controllers/activity.controller');
const auth = require('../middleware/auth.jwt');

// Task 5: Global Audit Logs API
router.get('/activities', auth.authenticate, auth.requirePsa, activityCtrl.getGlobalActivities);

module.exports = router;
