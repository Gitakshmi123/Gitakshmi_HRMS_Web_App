const express = require('express');
const router = express.Router();
const { checkPermission } = require('../middleware/rbac.middleware');
const workflowController = require('../controllers/workflow.controller');

router.get(
  '/',
  checkPermission('approval.workflow.manage', 'view'),
  workflowController.listWorkflows
);

router.post(
  '/',
  checkPermission('approval.workflow.manage', 'create'),
  workflowController.createWorkflow
);

router.put(
  '/:id',
  checkPermission('approval.workflow.manage', 'edit'),
  workflowController.updateWorkflow
);

router.get(
  '/inbox',
  checkPermission('approval.view', 'view'),
  workflowController.getInbox
);

router.get(
  '/delegations',
  checkPermission('approval.workflow.manage', 'view'),
  workflowController.listDelegations
);

router.post(
  '/delegations',
  checkPermission('approval.workflow.manage', 'create'),
  workflowController.createDelegation
);

router.post(
  '/delegations/:id/revoke',
  checkPermission('approval.workflow.manage', 'edit'),
  workflowController.revokeDelegation
);

router.post(
  '/start',
  checkPermission('approval.workflow.manage', 'create'),
  workflowController.startWorkflow
);

router.get(
  '/instances/:id',
  checkPermission('approval.view', 'view'),
  workflowController.getInstance
);

router.post(
  '/instances/:id/actions',
  checkPermission('approval.approve', 'edit'),
  workflowController.processAction
);

router.get(
  '/:id',
  checkPermission('approval.workflow.manage', 'view'),
  workflowController.getWorkflow
);

router.post(
  '/:id/publish',
  checkPermission('approval.workflow.manage', 'edit'),
  workflowController.publishWorkflow
);

router.post(
  '/:id/disable',
  checkPermission('approval.workflow.manage', 'edit'),
  workflowController.disableWorkflow
);

module.exports = router;
