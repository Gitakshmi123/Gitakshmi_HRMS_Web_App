const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.jwt');
const checkModuleAccess = require('../middleware/moduleAccess.middleware');
const requireActiveEmployee = require('../middleware/requireActiveEmployee');
const attendCtrl = require('../controllers/attendance.controller');
const faceAttendCtrl = require('../controllers/face-attendance.controller');
const trackingCtrl = require('../controllers/attendanceTracking.controller');
const { checkPermission } = require('../middleware/rbac.middleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const attendanceCheck = checkModuleAccess('attendance');
const DEBUG_ATTENDANCE_ROUTES = String(process.env.DEBUG_ATTENDANCE_ROUTES || '').toLowerCase() === 'true';

router.use(auth.authenticate, attendanceCheck);

router.use((req, res, next) => {
    if (DEBUG_ATTENDANCE_ROUTES) {
        console.log(`[DEBUG_ATTENDANCE_ROUTE] Path: ${req.path} Method: ${req.method}`);
    }
    next();
});


// --- emp service (write actions blocked for deactivated accounts) ---
// Employee self-service attendance writes are guarded by auth, module access,
// and active employee status. They must not require an admin-granted create
// permission because the controller resolves the employee from req.user.
router.post('/punch', auth.authenticate, requireActiveEmployee, attendCtrl.punch);
router.post('/mark', auth.authenticate, requireActiveEmployee, trackingCtrl.markAttendance);
/**
 * @swagger
 * /api/attendance/my:
 *   get:
 *     summary: Get my attendance
 *     description: Retrieve attendance records for the authenticated employee.
 *     tags: [Attendance]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: A list of attendance records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Attendance'
 */
router.get('/my', auth.authenticate, checkPermission('employee.attendance', 'view'), attendCtrl.getMyAttendance);
router.get(['/today-summary', '/today_summary'], auth.authenticate, (req, res, next) => {
    console.log(`[ATTENDANCE_DEBUG] Hit today-summary. Tenant: ${req.tenantId || 'NONE'}`);
    next();
}, checkPermission('employee.attendance', 'view'), attendCtrl.getTodaySummary);

router.post('/validateAttendance', auth.authenticate, checkPermission('employee.attendance', 'create'), requireActiveEmployee, attendCtrl.validateLocation);

// --- Face Authentication Routes ---
router.post('/face/register', auth.authenticate, requireActiveEmployee, faceAttendCtrl.registerFace);
router.post('/face/match', auth.authenticate, requireActiveEmployee, trackingCtrl.matchFaceForAttendance);
router.post('/face/verify', auth.authenticate, requireActiveEmployee, trackingCtrl.markAttendance);
router.get('/face/status', auth.authenticate, checkPermission('employee.attendance', 'view'), faceAttendCtrl.getFaceStatus);
router.delete('/face/delete', auth.authenticate, checkPermission('employee.attendance', 'delete'), requireActiveEmployee, faceAttendCtrl.deleteFace);
router.post('/face/request-update', auth.authenticate, requireActiveEmployee, attendCtrl.requestFaceUpdate);
router.get('/face/requests', auth.authenticate, checkPermission('attendance.face', 'view'), auth.requireHr, attendCtrl.getFaceUpdateRequests);
router.post('/face/action-request', auth.authenticate, checkPermission('attendance.face', 'edit'), auth.requireHr, attendCtrl.actionFaceUpdate);
router.get('/face/registered-users', auth.authenticate, checkPermission('attendance.face', 'view'), auth.requireHr, attendCtrl.getRegisteredFaces);
router.delete('/face/delete-user/:employeeId', auth.authenticate, checkPermission('attendance.face', 'edit'), auth.requireHr, attendCtrl.deleteEmployeeFaceHR);

// --- Manager Routes ---
router.get('/team', auth.authenticate, checkPermission('attendance.dashboard', 'view'), attendCtrl.getTeamAttendance);

// --- HR / Admin Routes ---
router.get('/stats', auth.authenticate, checkPermission('attendance.dashboard', 'view'), attendCtrl.getHRStats);
router.get('/trend', auth.authenticate, checkPermission('attendance.dashboard', 'view'), attendCtrl.getTrend);
router.get('/all', auth.authenticate, checkPermission('attendance.dashboard', 'view'), attendCtrl.getAllAttendance);
router.get('/settings', auth.authenticate, checkPermission('employee.attendance', 'view'), attendCtrl.getSettings);
router.put('/settings', auth.authenticate, checkPermission('attendance.dashboard', 'edit'), auth.requireHr, attendCtrl.updateSettings);
router.post('/override', auth.authenticate, checkPermission('attendance.dashboard', 'edit'), auth.requireHr, attendCtrl.override);
router.post('/upload-excel', auth.authenticate, checkPermission('attendance.dashboard', 'create'), auth.requireHr, upload.single('file'), attendCtrl.uploadExcel);
router.get('/bulk/template', auth.authenticate, checkPermission('attendance.dashboard', 'view'), auth.requireHr, attendCtrl.downloadBulkUploadTemp);
router.post('/bulk-upload', auth.authenticate, checkPermission('attendance.dashboard', 'create'), auth.requireHr, attendCtrl.bulkUpload);
router.get('/calendar', auth.authenticate, checkPermission('attendance.calendar', 'view'), attendCtrl.getCalendar);
// Attendance by date for admin/HR - shows employees list + summary for the date
router.get('/by-date', auth.authenticate, checkPermission('attendance.dashboard', 'view'), auth.requireHr, attendCtrl.getByDate);
router.get('/employee/:employeeId/:date', auth.authenticate, checkPermission('attendance.dashboard', 'view'), auth.requireHr, attendCtrl.getEmployeeDateDetail);

module.exports = router;
