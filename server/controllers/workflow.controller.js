const workflowEngine = require('../services/workflowEngine.service');

function tenantContext(req) {
  if (!req.tenantDB || !req.tenantId) {
    throw new Error('Tenant context is required.');
  }
  return { tenantDB: req.tenantDB, tenantId: req.tenantId };
}

function handleError(res, error) {
  const status = error.statusCode || (String(error.message || '').includes('not found') ? 404 : 400);
  return res.status(status).json({
    success: false,
    message: error.message || 'Workflow request failed.',
  });
}

exports.listWorkflows = async (req, res) => {
  try {
    const data = await workflowEngine.listWorkflows({
      ...tenantContext(req),
      moduleKey: req.query.moduleKey,
      entityType: req.query.entityType,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getWorkflow = async (req, res) => {
  try {
    const data = await workflowEngine.getWorkflowDetails({
      ...tenantContext(req),
      workflowId: req.params.id,
    });
    if (!data) return res.status(404).json({ success: false, message: 'Workflow not found.' });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.createWorkflow = async (req, res) => {
  try {
    const data = await workflowEngine.createDraftWorkflow({
      ...tenantContext(req),
      req,
      body: req.body,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.updateWorkflow = async (req, res) => {
  try {
    const data = await workflowEngine.updateDraftWorkflow({
      ...tenantContext(req),
      workflowId: req.params.id,
      req,
      body: req.body,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.publishWorkflow = async (req, res) => {
  try {
    const data = await workflowEngine.publishWorkflow({
      ...tenantContext(req),
      workflowId: req.params.id,
      req,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.disableWorkflow = async (req, res) => {
  try {
    const data = await workflowEngine.disableWorkflow({
      ...tenantContext(req),
      workflowId: req.params.id,
      req,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getInbox = async (req, res) => {
  try {
    const data = await workflowEngine.getApprovalInbox({
      ...tenantContext(req),
      req,
      status: req.query.status || 'PENDING',
      limit: req.query.limit,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.listDelegations = async (req, res) => {
  try {
    const data = await workflowEngine.listDelegations({
      ...tenantContext(req),
      query: req.query,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.createDelegation = async (req, res) => {
  try {
    const data = await workflowEngine.createDelegation({
      ...tenantContext(req),
      req,
      body: req.body,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.revokeDelegation = async (req, res) => {
  try {
    const data = await workflowEngine.revokeDelegation({
      ...tenantContext(req),
      delegationId: req.params.id,
      req,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.getInstance = async (req, res) => {
  try {
    const data = await workflowEngine.getWorkflowInstanceDetails({
      ...tenantContext(req),
      instanceId: req.params.id,
    });
    if (!data) return res.status(404).json({ success: false, message: 'Workflow instance not found.' });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.processAction = async (req, res) => {
  try {
    const data = await workflowEngine.processWorkflowAction({
      ...tenantContext(req),
      instanceId: req.params.id,
      req,
      action: req.body.action,
      comment: req.body.comment || req.body.comments || req.body.reason || '',
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

exports.startWorkflow = async (req, res) => {
  try {
    const data = await workflowEngine.startWorkflow({
      ...tenantContext(req),
      req,
      moduleKey: req.body.moduleKey,
      entityType: req.body.entityType,
      entityId: req.body.entityId,
      requesterEmployeeId: req.body.requesterEmployeeId,
      requesterUserId: req.user?.id,
      contextSnapshot: req.body.contextSnapshot || {},
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};
