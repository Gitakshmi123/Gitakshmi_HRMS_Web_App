const { resolveEmployeeForUser } = require('./approverResolver.service');
const { finalizeWorkflowEntity } = require('./workflowAdapter.service');
const { activateNextStep } = require('./workflowStart.service');
const {
  actorUserId,
  getWorkflowModels,
  normalizeAction,
  writeHistory,
} = require('./workflowRuntimeCore.service');

function isStepApproved(step, assignments) {
  const approvedCount = assignments.filter((item) => item.status === 'APPROVED').length;
  const totalCount = assignments.length;
  const mode = String(step?.approvalMode || 'ANY').toUpperCase();

  if (mode === 'ALL') return totalCount > 0 && approvedCount === totalCount;
  if (mode === 'MAJORITY') {
    const required = Number(step?.minApprovals || Math.floor(totalCount / 2) + 1);
    return approvedCount >= Math.max(1, required);
  }
  return approvedCount >= Number(step?.minApprovals || 1);
}

async function finishWorkflow({ tenantDB, tenantId, instance, status, actorEmployeeId, actorUserId: userId, comment, req }) {
  const { WorkflowAssignment } = getWorkflowModels(tenantDB);
  await WorkflowAssignment.updateMany(
    { tenantId, instanceId: instance._id, status: 'PENDING' },
    { $set: { status: 'CANCELLED' } }
  );

  const fromStatus = instance.status;
  instance.status = status;
  instance.completedAt = new Date();
  await instance.save();
  await writeHistory({
    tenantDB,
    tenantId,
    instance,
    action: status,
    actorEmployeeId,
    actorUserId: userId,
    fromStatus,
    toStatus: status,
    comment,
    req,
  });

  try {
    await finalizeWorkflowEntity({
      tenantDB,
      tenantId,
      moduleKey: instance.moduleKey,
      entityType: instance.entityType,
      entityId: instance.entityId,
      status,
      actorEmployeeId,
      actorUserId: userId,
      comment,
    });
  } catch (error) {
    instance.status = 'FAILED';
    instance.finalActionError = error.message;
    await instance.save();
    throw error;
  }

  return instance;
}

async function processWorkflowAction({ tenantDB, tenantId, instanceId, req, action, comment = '' }) {
  const normalizedAction = normalizeAction(action);
  if (!['APPROVED', 'REJECTED', 'SENT_BACK'].includes(normalizedAction)) {
    throw new Error('Unsupported workflow action.');
  }

  const { WorkflowInstance, WorkflowVersion, WorkflowAssignment } = getWorkflowModels(tenantDB);
  const actorEmployee = await resolveEmployeeForUser(req, tenantDB);
  const userId = actorUserId(req);
  if (!actorEmployee?._id && !userId) throw new Error('Approver identity not found.');

  const instance = await WorkflowInstance.findOne({ _id: instanceId, tenantId, status: 'PENDING' });
  if (!instance) throw new Error('Pending workflow instance not found.');

  const assignment = await WorkflowAssignment.findOne({
    tenantId,
    instanceId: instance._id,
    status: 'PENDING',
    $or: [
      ...(actorEmployee?._id ? [{ assigneeEmployeeId: actorEmployee._id }] : []),
      ...(userId ? [{ assigneeUserId: userId }] : []),
    ],
  });
  if (!assignment) {
    const error = new Error('You are not assigned to this approval step.');
    error.statusCode = 403;
    throw error;
  }

  assignment.status = normalizedAction;
  assignment.actionByEmployeeId = actorEmployee?._id || null;
  assignment.actionByUserId = userId;
  assignment.actionAt = new Date();
  assignment.comment = comment;
  await assignment.save();
  await writeHistory({
    tenantDB,
    tenantId,
    instance,
    action: normalizedAction,
    actorEmployeeId: actorEmployee?._id || null,
    actorUserId: userId,
    stepKey: assignment.stepKey,
    comment,
    req,
  });

  if (normalizedAction === 'REJECTED' || normalizedAction === 'SENT_BACK') {
    return finishWorkflow({
      tenantDB,
      tenantId,
      instance,
      status: normalizedAction,
      actorEmployeeId: actorEmployee?._id || null,
      actorUserId: userId,
      comment,
      req,
    });
  }

  const version = await WorkflowVersion.findById(instance.workflowVersionId).lean();
  const step = (version?.definition?.steps || []).find((item) => item.key === assignment.stepKey);
  const stepAssignments = await WorkflowAssignment.find({
    tenantId,
    instanceId: instance._id,
    stepKey: assignment.stepKey,
  }).lean();

  if (!isStepApproved(step, stepAssignments)) {
    return instance;
  }

  await WorkflowAssignment.updateMany(
    { tenantId, instanceId: instance._id, stepKey: assignment.stepKey, status: 'PENDING' },
    { $set: { status: 'SKIPPED' } }
  );

  const activation = await activateNextStep({
    tenantDB,
    tenantId,
    instance,
    version,
    afterOrder: assignment.stepOrder,
    req,
  });
  if (activation.assigned) return instance;

  return finishWorkflow({
    tenantDB,
    tenantId,
    instance,
    status: 'APPROVED',
    actorEmployeeId: actorEmployee?._id || null,
    actorUserId: userId,
    comment,
    req,
  });
}

module.exports = {
  processWorkflowAction,
};
