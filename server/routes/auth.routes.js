const express = require('express');

const authCtrl = require('../controllers/auth.controller');
const ssoCtrl = require('../controllers/sso.controller');

const router = express.Router();

// ================ GT-ONE SSO (DISABLED) ================
// router.get('/sso/start', ssoCtrl.ssoStart);
// router.get('/sso/callback', ssoCtrl.ssoCallback);
// router.get('/sso/login-url', ssoCtrl.getSsoLoginUrl);

if (typeof authCtrl.registerController === 'function') {
  router.post('/register', authCtrl.registerController);
}

const { authenticate } = require('../middleware/auth.jwt');

// Direct login endpoints unconditionally enabled
router.post('/login-unified', authCtrl.unifiedLogin);
router.post('/login/unified', authCtrl.unifiedLogin);
/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate a user and return a JWT token
 *     description: Unified login endpoint for HR and Employees.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@company.com
 *               password:
 *                 type: string
 *                 example: securePassword123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', authCtrl.unifiedLogin);
router.post('/login-hr', authCtrl.loginHrController);
router.post('/login-employee', authCtrl.loginEmployeeController);
router.post('/employee-otp/request', authCtrl.requestEmployeeOtp);
router.post('/employee-otp/verify', authCtrl.verifyEmployeeOtp);

// [TOKEN REFRESH]
router.post('/refresh-token', authCtrl.refreshTokenController);

// [LOGOUT] Clears HRMS auth cookies (access + refresh)
router.post('/logout', authCtrl.logoutController);
router.get('/logout', authCtrl.logoutController);

// [SYNC] Fetch user profile
router.get('/me', authenticate, authCtrl.getMe);
router.get('/sso/me', authenticate, authCtrl.getSsoMe);

// [RBAC] Fetch ONLY page-level permissions (lightweight, used by frontend RBAC system)
router.get('/me/permissions', authenticate, authCtrl.getMyPermissions);

module.exports = router;
