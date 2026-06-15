const express = require('express');
const attendanceCtrl = require('../controllers/attendance.controller');
const trackingCtrl = require('../controllers/attendanceTracking.controller');

const router = express.Router();

router.post('/match', trackingCtrl.matchFaceForAttendance);
router.post('/mark', trackingCtrl.markAttendance);
router.post('/request-update', attendanceCtrl.requestFaceUpdate);

module.exports = router;
