const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const requireActiveEmployee = require('../middleware/requireActiveEmployee');
const checkModuleAccess = require('../middleware/moduleAccess.middleware');
const { checkPermission } = require('../middleware/rbac.middleware');
const trackingCtrl = require('../controllers/attendanceTracking.controller');

const attendanceCheck = checkModuleAccess('attendance');

router.use(auth.authenticate, attendanceCheck);

// Employee self-service tracking endpoints are guarded by auth, module access,
// and active employee status. They must not require admin-granted attendance
// create/view permissions because the controller resolves ownership from req.user.
router.post(
  '/update',
  requireActiveEmployee,
  trackingCtrl.updateLocation
);

router.get(
  '/my-status',
  requireActiveEmployee,
  trackingCtrl.getMyTrackingStatus
);

router.get(
  '/client-meeting/current',
  requireActiveEmployee,
  trackingCtrl.getMyTrackingStatus
);

router.get(
  '/client-meeting/places/search',
  requireActiveEmployee,
  trackingCtrl.searchClientMeetingPlaces
);

router.post(
  '/client-meeting/route/preview',
  requireActiveEmployee,
  trackingCtrl.previewClientMeetingRoute
);

router.post(
  '/client-meeting/start',
  requireActiveEmployee,
  trackingCtrl.startClientMeeting
);

router.post(
  '/client-meeting/update',
  requireActiveEmployee,
  trackingCtrl.updateClientMeetingLocation
);

router.post(
  '/client-meeting/stop',
  requireActiveEmployee,
  trackingCtrl.stopClientMeeting
);

router.get(
  '/client-meeting/history/:meetingId',
  requireActiveEmployee,
  trackingCtrl.getClientMeetingHistory
);

router.get(
  '/live',
  checkPermission('attendance.dashboard', 'view'),
  auth.requireHr,
  trackingCtrl.getLiveLocations
);

router.get(
  '/history/:userId',
  checkPermission('attendance.dashboard', 'view'),
  auth.requireHr,
  trackingCtrl.getLocationHistory
);

module.exports = router;
