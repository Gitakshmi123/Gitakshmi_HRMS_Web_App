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
