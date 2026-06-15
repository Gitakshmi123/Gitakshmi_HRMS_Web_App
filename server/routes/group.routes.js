const router = require('express').Router();
const { authenticate } = require('../middleware/auth.jwt');
const { requireRoles } = require('../middleware/roleAccess.middleware');
const groupCtrl = require('../controllers/group.controller');

// Create group (Product Super Admin only)
router.post('/create', authenticate, requireRoles('super_admin'), groupCtrl.createGroup);
router.get('/all', authenticate, requireRoles('super_admin'), groupCtrl.getAllGroups);

module.exports = router;
