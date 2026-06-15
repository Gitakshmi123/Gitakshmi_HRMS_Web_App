const { resolveApprovers } = require('./approverResolver.service');
const { getEmployeeHierarchy } = require('./employeeHierarchy.service');
const { ensureDefaultWorkflow } = require('./workflowDefinition.service');
const { orderedActiveSteps } = require('./workflowCondition.service');
const {
  actorUserId,
  getWorkflowModels,
  notifyAssignment,
  writeHistory,
} = require('./workflowRuntimeCore.service');

async function findDelegation(tenantDB, tenantId, moduleKey, employeeId) {
  const { WorkflowDelegation } = getWorkflowModels(tenantDB);
  const now = new Date();
  const delegation = await WorkflowDelegation.findOne({
    tenantId,
    fromEmployeeId: employeeId,
    isActive: true,
    startDate: { $lte: now },
    endDate: { $gte: now },
    $or: [{ moduleKey }, { moduleKey: '' }, { moduleKey: { $exists: false } }],
  }).lean();
  return delegation
    ? { assigneeEmployeeId: delegation.toEmployeeId, delegatedFromEmployeeId: employeeId }
    : { assigneeEmployeeId: employeeId, delegatedFromEmployeeId: null };
}

async function assignStep({ tenantDB, tenantId, instance, version, step, req }) {
  const { WorkflowAssignment, Employee, User } = getWorkflowModels(tenantDB);
  const contextSnapshot = {
    ...(instance.contextSnapshot || {}),
    workflowSettings: version.definition?.settings || {},
  };
  const approvers = await resolveApprovers({
    tenantDB,
    requesterEmployeeId: instance.requesterEmployeeId,
    step,
    contextSnapshot,
  });

  const dueAt = new Date(Date.now() + Number(step.slaHours || 24) * 60 * 60 * 1000);
  const assignments = [];
  for (const approverId of approvers) {
    const delegated = await findDelegation(tenantDB, tenantId, instance.moduleKey, approverId);
    let assigneeUserId = null;
    try {
      const employee = await Employee.findById(delegated.assigneeEmployeeId).select('email').lean();
      if (employee?.email) {
        const emailRegex = new RegExp(`^${String(employee.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        const user = await User.findOne({
          email: { $regex: emailRegex },
          $or: [{ mainCompanyId: tenantId }, { tenantId }, { companyId: tenantId }],
        }).select('_id').lean();
        assigneeUserId = user?._id || null;
      }
    } catch (_) {
      assigneeUserId = null;
    }
    const assignment = await WorkflowAssignment.create({
      tenantId,
      instanceId: instance._id,
      workflowId: instance.workflowId,
      workflowVersionId: instance.workflowVersionId,
      stepKey: step.key,
      stepName: step.name,
      stepOrder: step.order,
      assigneeEmployeeId: delegated.assigneeEmployeeId,
      assigneeUserId,
      delegatedFromEmployeeId: delegated.delegatedFromEmployeeId,
      dueAt,
    });
    assignments.push(assignment);
    await notifyAssignment({ tenantDB, tenantId, instance, assignment });
  }
  return assignments;
}

async function activateNextStep({ tenantDB, tenantId, instance, version, afterOrder = 0, req = null }) {
  const steps = orderedActiveSteps(version.definition, instance.contextSnapshot)
    .filter((step) => Number(step.order || 0) > Number(afterOrder || 0));
  for (const step of steps) {
    const assignments = await assignStep({ tenantDB, tenantId, instance, version, step, req });
    if (!assignments.length) continue;
    instance.currentStepKey = step.key;
    instance.currentStepOrder = step.order;
    await instance.save();
    await writeHistory({
      tenantDB,
      tenantId,
      instance,
      action: 'ASSIGNED',
      actorUserId: actorUserId(req),
      stepKey: step.key,
      metadata: { assignmentIds: assignments.map((item) => item._id) },
      req,
    });
    return { assigned: true, step, assignments };
  }
  return { assigned: false };
}

async function startWorkflow(payload) {
  const { tenantDB, tenantId, moduleKey, entityType, entityId, req = null } = payload;
  const { WorkflowInstance } = getWorkflowModels(tenantDB);
  const existing = await WorkflowInstance.findOne({ tenantId, entityType, entityId, status: 'PENDING' });
  if (existing) return { started: false, reason: 'already_started', instance: existing };

  let hierarchySnapshot = null;
  let employeeUnitId = null;

  if (payload.requesterEmployeeId) {
    try {
      const hierarchy = await getEmployeeHierarchy({
        tenantDB,
        tenantId,
        employeeId: payload.requesterEmployeeId,
        rebuild: false,
        actorUserId: actorUserId(req),
      });
      hierarchySnapshot = (hierarchy?.chain || []).map((node) => ({
        level: node.level,
        relationKey: node.relationKey,
        employeeId: node.employeeId,
        userId: node.userId,
        name: node.name,
        role: node.role,
      }));
      employeeUnitId = hierarchy?.employee?.departmentId || hierarchy?.employee?.branchId || tenantId;
    } catch (error) {
      hierarchySnapshot = [{ error: error.message }];
      employeeUnitId = tenantId;
    }
  }

  const match = await ensureDefaultWorkflow({ tenantDB, tenantId, moduleKey, entityType, req, employeeUnitId });
  if (!match) return { started: false, reason: 'no_workflow' };

  const instance = await WorkflowInstance.create({
    tenantId,
    workflowId: match.workflow._id,
    workflowVersionId: match.version._id,
    workflowVersion: match.version.version,
    moduleKey,
    entityType,
    entityId,
    requesterEmployeeId: payload.requesterEmployeeId || null,
    requesterUserId: payload.requesterUserId || actorUserId(req),
    contextSnapshot: {
      ...(payload.contextSnapshot || {}),
      hierarchyChain: hierarchySnapshot || [],
    },
  });
  await writeHistory({ tenantDB, tenantId, instance, action: 'STARTED', actorUserId: actorUserId(req), req });

  const activation = await activateNextStep({ tenantDB, tenantId, instance, version: match.version, req });
  if (!activation.assigned) {
    instance.status = 'FAILED';
    instance.completedAt = new Date();
    instance.finalActionError = 'No approvers resolved for workflow.';
    await instance.save();
    await writeHistory({ tenantDB, tenantId, instance, action: 'FAILED', toStatus: 'FAILED', req });
    return { started: false, reason: 'no_approvers', instance };
  }

  return { started: true, instance, currentStep: activation.step, assignments: activation.assignments };
}

module.exports = {
  activateNextStep,
  startWorkflow,
};
