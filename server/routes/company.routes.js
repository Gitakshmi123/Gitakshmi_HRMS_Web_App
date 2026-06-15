const router = require('express').Router();
const mongoose = require('mongoose');
const ctrl = require('../controllers/tenant.controller');
const subCompanyCtrl = require('../controllers/subCompany.controller');
const auth = require('../middleware/auth.jwt');
const Tenant = require('../models/Tenant');

// Public verification link
if (typeof ctrl.verifyCompany === 'function') {
  router.get('/verify-company/:token', ctrl.verifyCompany);
}

// Company admin / HR sub-company management
router.get('/me', auth.authenticate, auth.requireHr, subCompanyCtrl.getMyCompanyDetails);
router.get('/modules', auth.authenticate, auth.requireHr, subCompanyCtrl.getParentCompanyModules);
router.get('/sub-companies', auth.authenticate, auth.requireHr, subCompanyCtrl.getSubCompanyList);
router.get('/sub-companies/:id', auth.authenticate, auth.requireHr, subCompanyCtrl.getSubCompanyById);
router.post('/sub-companies', auth.authenticate, auth.requireHr, subCompanyCtrl.createSubCompany);
router.put('/sub-companies/:id', auth.authenticate, auth.requireHr, subCompanyCtrl.updateSubCompany);
router.put('/sub-companies/:id/status', auth.authenticate, auth.requireHr, subCompanyCtrl.toggleSubCompanyStatus);

// PSA company management helpers
router.get('/count', auth.authenticate, auth.requirePsa, async (req, res) => {
  try {
    const groupId = String(req.query.groupId || '').trim();
    if (!groupId) {
      return res.status(400).json({ success: false, message: 'groupId is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ success: false, message: 'Invalid groupId' });
    }

    const total = await Tenant.countDocuments({
      groupId,
      status: { $ne: 'deleted' }
    });

    return res.json({ success: true, total });
  } catch (error) {
    console.error('getCompanyCount error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to count companies',
      error: error.message
    });
  }
});

router.post('/create', auth.authenticate, auth.requirePsa, ctrl.createCompany);
router.get('/parents', auth.authenticate, auth.requirePsa, ctrl.getParentCompanies);
router.get('/sub-companies', auth.authenticate, auth.requirePsa, ctrl.getSubCompaniesByParent);

module.exports = router;
