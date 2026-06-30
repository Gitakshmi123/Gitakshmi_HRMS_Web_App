const router = require('express').Router();

const auth = require('../middleware/auth.jwt');
const ctrl = require('../controllers/tenant.controller');
const gstCtrl = require('../controllers/gst.controller');
const validate = require('../middleware/validation.middleware');
const { passwordOnlySchema } = require('../validations/auth.validation');

// console.log('[DEBUG] Loading Tenant Routes...');

// NOTE: Route order matters in Express.
// Keep specific paths like '/me' BEFORE '/:id' so they don't get swallowed.

// Activation link handler (public)
router.get('/activate', ctrl.activateTenant);

// tenant self info for authenticated users
router.get('/me', auth.authenticate, ctrl.getMyTenant);

// enabled modules - accessible to ALL authenticated users (including employees)
router.get('/my-modules', auth.authenticate, ctrl.getMyModules);

// PSA dashboard stats for Super Admin
router.get('/psa/stats', auth.authenticate, auth.requirePsa, ctrl.psaStats);

// Parent / Sub-company tree for PSA/Admin listing
router.get('/parent-companies', auth.authenticate, auth.requirePsa, ctrl.getParentCompanies);
router.get('/sub-companies', auth.authenticate, auth.requirePsa, ctrl.getSubCompaniesByParent);
router.get('/gst/:gstin', auth.authenticate, auth.requirePsa, gstCtrl.lookupGstin);

// DMS Integration — MUST be before /:id to avoid Express treating 'dms-integration' as an ID
router.get('/dms-integration', auth.authenticate, auth.requireHr, ctrl.getDmsIntegration);
router.put('/dms-integration', auth.authenticate, auth.requireHr, ctrl.saveDmsIntegration);

// List & create (PSA only)
router.get('/', auth.authenticate, auth.requirePsa, ctrl.listTenants);
router.post('/company', auth.authenticate, auth.requirePsa, ctrl.createCompany);
router.post('/', auth.authenticate, auth.requirePsa, ctrl.createCompany); // Keep legacy root post for compatibility

// Send activation (PSA only)
router.post('/:id/send-activation', auth.authenticate, auth.requirePsa, ctrl.sendActivationEmail);
router.post('/:id/send-activation-sms', auth.authenticate, auth.requirePsa, ctrl.sendActivationSms);

// Tenant details (PSA only) - keep LAST so it doesn't swallow '/me'
router.get('/:id', auth.authenticate, auth.requirePsa, ctrl.getTenant);
router.post(
  '/verify-password',
  auth.authenticate,
  auth.requirePsa,
  validate(passwordOnlySchema),
  require('../controllers/auth.controller').verifyPsaPassword
);

// NEW: Password security routes
router.post('/verify-password', auth.authenticate, auth.requirePsa, require('../controllers/auth.controller').verifyPsaPassword);
router.put('/:id/password', auth.authenticate, auth.requirePsa, ctrl.updateTenantPassword);
router.put('/company/:id/modules', auth.authenticate, auth.requirePsa, ctrl.updateModules);
router.put('/:id/modules', auth.authenticate, auth.requirePsa, ctrl.updateModules);

router.put('/:id', auth.authenticate, auth.requirePsa, ctrl.updateTenant);
router.delete('/:id', auth.authenticate, auth.requirePsa, ctrl.deleteTenant);

// DMS Integration routes moved above /:id (see above)

module.exports = router;
