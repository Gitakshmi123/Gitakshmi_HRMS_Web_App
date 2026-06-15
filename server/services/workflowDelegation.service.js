const { actorUserId, getWorkflowModels } = require('./workflowRuntimeCore.service');

async function listDelegations({ tenantDB, tenantId, query = {} }) {
  const { WorkflowDelegation } = getWorkflowModels(tenantDB);
  const criteria = { tenantId };
  if (query.fromEmployeeId) criteria.fromEmployeeId = query.fromEmployeeId;
  if (query.toEmployeeId) criteria.toEmployeeId = query.toEmployeeId;
  if (query.isActive !== undefined) criteria.isActive = String(query.isActive) !== 'false';
  return WorkflowDelegation.find(criteria).sort({ createdAt: -1 }).lean();
}

async function createDelegation({ tenantDB, tenantId, req, body }) {
  const { WorkflowDelegation } = getWorkflowModels(tenantDB);
  if (!body.fromEmployeeId || !body.toEmployeeId || !body.startDate || !body.endDate) {
    throw new Error('fromEmployeeId, toEmployeeId, startDate and endDate are required.');
  }

  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
    throw new Error('Invalid delegation date range.');
  }

  return WorkflowDelegation.create({
    tenantId,
    fromEmployeeId: body.fromEmployeeId,
    toEmployeeId: body.toEmployeeId,
    moduleKey: String(body.moduleKey || '').trim().toLowerCase(),
    reason: body.reason || '',
    startDate,
    endDate,
    isEmergency: !!body.isEmergency,
    createdBy: actorUserId(req),
  });
}

async function revokeDelegation({ tenantDB, tenantId, delegationId, req }) {
  const { WorkflowDelegation } = getWorkflowModels(tenantDB);
  const delegation = await WorkflowDelegation.findOne({ _id: delegationId, tenantId, isActive: true });
  if (!delegation) throw new Error('Active delegation not found.');
  delegation.isActive = false;
  delegation.revokedAt = new Date();
  delegation.revokedBy = actorUserId(req);
  await delegation.save();
  return delegation;
}

module.exports = {
  createDelegation,
  listDelegations,
  revokeDelegation,
};
