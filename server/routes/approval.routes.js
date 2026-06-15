const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth.jwt');
const { checkPermission } = require('../middleware/rbac.middleware');

const approvalController = require('../controllers/approval.controller');
const approvalWorkflowController = require('../controllers/approvalWorkflow.controller');

// Need a valid token for all routes. The app-level route does not wrap this
// router with auth because approval routes also serve workflow setup screens.
router.use(authenticate);

// ----------------------------------------------------
// Approval Workflows (Admin / Setup)
// ----------------------------------------------------
// Optionally protect with permission: checkPermission('approval.workflow.manage', 'read')
router.get('/workflows', checkPermission('approval.workflow.manage', 'view'), approvalWorkflowController.getWorkflows);
router.get('/workflows/:id', checkPermission('approval.workflow.manage', 'view'), approvalWorkflowController.getWorkflow);
router.post('/workflows', checkPermission('approval.workflow.manage', 'create'), approvalWorkflowController.createWorkflow);
router.put('/workflows/:id', checkPermission('approval.workflow.manage', 'edit'), approvalWorkflowController.updateWorkflow);
router.delete('/workflows/:id', checkPermission('approval.workflow.manage', 'delete'), approvalWorkflowController.deleteWorkflow);

// ----------------------------------------------------
// Approvals (Managers / Approvers)
// ----------------------------------------------------
router.get('/my-approvals', checkPermission('approval.view', 'view'), approvalController.getPendingApprovals);
router.get('/history', checkPermission('approval.view', 'view'), approvalController.getApprovalHistory);
router.get('/:id', checkPermission('approval.view', 'view'), approvalController.getApprovalDetails);

// Process an action on an approval (approve, reject, request_changes)
router.post('/:id/action', checkPermission('approval.approve', 'edit'), approvalController.processAction);

module.exports = router;
