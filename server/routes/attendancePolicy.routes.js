const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const policyCtrl = require('../controllers/attendancePolicy.controller');

// Attendance Policy update (HR/Admin only)
router.put('/update', auth.authenticate, auth.requireHr, policyCtrl.updateAttendancePolicy);

module.exports = router;

