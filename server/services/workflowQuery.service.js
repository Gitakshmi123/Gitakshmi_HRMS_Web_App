const { resolveEmployeeForUser } = require('./approverResolver.service');
const { actorUserId, getWorkflowModels } = require('./workflowRuntimeCore.service');

async function getApprovalInbox({ tenantDB, tenantId, req, status = 'PENDING', limit = 50 }) {
  const { WorkflowAssignment, WorkflowInstance } = getWorkflowModels(tenantDB);
  const actorEmployee = await resolveEmployeeForUser(req, tenantDB);
  const userId = actorUserId(req);
  if (!actorEmployee?._id && !userId) return [];

  const assigneeFilter = [];
  if (actorEmployee?._id) assigneeFilter.push({ assigneeEmployeeId: actorEmployee._id });
  if (userId) assigneeFilter.push({ assigneeUserId: userId });

  const assignments = await WorkflowAssignment.find({
    tenantId,
    status,
    $or: assigneeFilter,
  }).sort({ dueAt: 1, createdAt: -1 }).limit(Number(limit) || 50).lean();

  const instanceIds = assignments.map((assignment) => assignment.instanceId);
  const instances = await WorkflowInstance.find({ tenantId, _id: { $in: instanceIds } }).lean();
  const byId = new Map(instances.map((instance) => [String(instance._id), instance]));

  return assignments.map((assignment) => ({
    ...assignment,
    instance: byId.get(String(assignment.instanceId)) || null,
  }));
}

async function getWorkflowInstanceDetails({ tenantDB, tenantId, instanceId }) {
  const { WorkflowInstance, WorkflowAssignment, WorkflowHistory } = getWorkflowModels(tenantDB);
  const instance = await WorkflowInstance.findOne({ tenantId, _id: instanceId }).lean();
  if (!instance) return null;

  const [assignments, history] = await Promise.all([
    WorkflowAssignment.find({ tenantId, instanceId }).sort({ stepOrder: 1, createdAt: 1 }).lean(),
    WorkflowHistory.find({ tenantId, instanceId }).sort({ createdAt: 1 }).lean(),
  ]);

  return { instance, assignments, history };
}

module.exports = {
  getApprovalInbox,
  getWorkflowInstanceDetails,
};
