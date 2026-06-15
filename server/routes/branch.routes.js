const router = require('express').Router();
const { authenticate } = require('../middleware/auth.jwt');
const { requireRoles } = require('../middleware/roleAccess.middleware');
const branchCtrl = require('../controllers/branch.controller');

const ADMIN_PERMITTED = ['company_super_admin', 'hr', 'admin', 'human_resource', 'hr_manager', 'hr_admin', 'manager'];

/*
// 1. Specific routes first (to avoid route shadowing /:id)
// Approve/Reject/Pending branch (Super Admin or Parent Admin only)
router.get('/pending', authenticate, requireRoles(...ADMIN_PERMITTED), branchCtrl.getPendingBranches);
router.put('/approve/:id', authenticate, requireRoles(...ADMIN_PERMITTED), branchCtrl.approveBranch);
router.put('/reject/:id', authenticate, requireRoles(...ADMIN_PERMITTED), branchCtrl.rejectBranch);

// 2. Resource-based routes
// Admins and HR can create
router.post('/create', authenticate, requireRoles(...ADMIN_PERMITTED, 'company_admin'), branchCtrl.createBranch);

// Both admins and HR can view list
router.get('/list', authenticate, requireRoles(...ADMIN_PERMITTED, 'company_admin'), branchCtrl.getBranches);

// Compatibility alias
router.get('/my', authenticate, requireRoles(...ADMIN_PERMITTED, 'company_admin'), branchCtrl.getBranches);

// 3. Generic ID-based routes (Must be last)
// Get single branch
router.get('/:id', authenticate, requireRoles(...ADMIN_PERMITTED, 'company_admin'), branchCtrl.getBranchById);

// Update branch
router.put('/:id', authenticate, requireRoles(...ADMIN_PERMITTED, 'company_admin'), branchCtrl.updateBranch);

// Delete branch
router.delete('/:id', authenticate, requireRoles(...ADMIN_PERMITTED, 'company_admin'), branchCtrl.deleteBranch);
*/

module.exports = router;
