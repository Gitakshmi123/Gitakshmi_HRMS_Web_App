const { actorUserId, getWorkflowModels } = require('./workflowRuntimeCore.service');

async function getWorkflowDetails({ tenantDB, tenantId, workflowId }) {
  const { Workflow, WorkflowVersion } = getWorkflowModels(tenantDB);
  const workflow = await Workflow.findOne({
    _id: workflowId,
    tenantId,
    isDeleted: { $ne: true },
  }).lean();
  if (!workflow) return null;

  const versions = await WorkflowVersion.find({ tenantId, workflowId: workflow._id })
    .sort({ version: -1 })
    .lean();
  return { workflow, versions };
}

async function publishWorkflow({ tenantDB, tenantId, workflowId, req }) {
  const { Workflow, WorkflowVersion } = getWorkflowModels(tenantDB);
  const workflow = await Workflow.findOne({
    _id: workflowId,
    tenantId,
    isDeleted: { $ne: true },
  });
  if (!workflow) throw new Error('Workflow not found.');

  const draft = await WorkflowVersion.findOne({
    tenantId,
    workflowId: workflow._id,
    status: 'DRAFT',
  }).sort({ version: -1 });
  if (!draft) throw new Error('No draft version found to publish.');
  if (!draft.definition?.steps?.length) throw new Error('Workflow must have at least one step.');

  await Workflow.updateMany(
    {
      tenantId,
      moduleKey: workflow.moduleKey,
      entityType: workflow.entityType,
      _id: { $ne: workflow._id },
    },
    { $set: { isActive: false, status: 'DISABLED' } }
  );

  draft.status = 'PUBLISHED';
  draft.publishedAt = new Date();
  draft.publishedBy = actorUserId(req);
  await draft.save();

  workflow.status = 'PUBLISHED';
  workflow.isActive = true;
  workflow.activeVersion = draft.version;
  workflow.activeVersionId = draft._id;
  workflow.updatedBy = actorUserId(req);
  await workflow.save();

  return { workflow, version: draft };
}

async function disableWorkflow({ tenantDB, tenantId, workflowId, req }) {
  const { Workflow } = getWorkflowModels(tenantDB);
  const workflow = await Workflow.findOne({ _id: workflowId, tenantId, isDeleted: { $ne: true } });
  if (!workflow) throw new Error('Workflow not found.');
  workflow.status = 'DISABLED';
  workflow.isActive = false;
  workflow.updatedBy = actorUserId(req);
  await workflow.save();
  return workflow;
}

module.exports = {
  disableWorkflow,
  getWorkflowDetails,
  publishWorkflow,
};
