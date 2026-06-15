const { actorUserId, getWorkflowModels } = require('./workflowRuntimeCore.service');
const { getDefaultDefinition } = require('./workflowDefinitionDefaults.service');

function normalizeModuleKey(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeEntityType(value) {
  return String(value || '').trim();
}

async function findPublishedWorkflow({ tenantDB, tenantId, moduleKey, entityType, employeeUnitId }) {
  const { Workflow, WorkflowVersion } = getWorkflowModels(tenantDB);
  const targetUnitId = employeeUnitId || tenantId;

  let workflow = await Workflow.findOne({
    tenantId,
    moduleKey: normalizeModuleKey(moduleKey),
    entityType: normalizeEntityType(entityType),
    status: 'PUBLISHED',
    isActive: true,
    isDeleted: { $ne: true },
    isGlobal: false,
    applicableUnitIds: { $in: [targetUnitId] }, // We should pass unitId here, but fallback tenantId for now
  }).lean();

  if (!workflow) {
    workflow = await Workflow.findOne({
      tenantId,
      moduleKey: normalizeModuleKey(moduleKey),
      entityType: normalizeEntityType(entityType),
      status: 'PUBLISHED',
      isActive: true,
      isDeleted: { $ne: true },
      isGlobal: true,
    }).lean();
  }

  if (!workflow?.activeVersionId) return null;
  const version = await WorkflowVersion.findOne({
    _id: workflow.activeVersionId,
    tenantId,
    status: 'PUBLISHED',
  }).lean();
  if (!version) return null;

  return { workflow, version };
}

async function ensureDefaultWorkflow({ tenantDB, tenantId, moduleKey, entityType, req = null, employeeUnitId = null }) {
  const published = await findPublishedWorkflow({ tenantDB, tenantId, moduleKey, entityType, employeeUnitId });
  const defaults = getDefaultDefinition(normalizeModuleKey(moduleKey), normalizeEntityType(entityType));
  if (published) {
    const stepKeys = (published.version?.definition?.steps || []).map((step) => step.key);
    const isLegacyDefaultRecruitmentLetter =
      defaults &&
      published.workflow?.name === defaults.name &&
      normalizeModuleKey(moduleKey) === 'recruitment' &&
      normalizeEntityType(entityType) === 'GeneratedLetter' &&
      stepKeys.includes('reporting_manager');

    if (!isLegacyDefaultRecruitmentLetter) return published;

    const { Workflow, WorkflowVersion } = getWorkflowModels(tenantDB);
    const workflow = await Workflow.findOne({ _id: published.workflow._id, tenantId });
    if (!workflow) return published;
    const versionNo = Number(workflow.activeVersion || 0) + 1;
    const version = await WorkflowVersion.create({
      tenantId,
      workflowId: workflow._id,
      version: versionNo,
      status: 'PUBLISHED',
      definition: defaults.definition,
      publishedAt: new Date(),
      publishedBy: actorUserId(req),
      createdBy: actorUserId(req),
    });
    workflow.activeVersion = versionNo;
    workflow.activeVersionId = version._id;
    workflow.updatedBy = actorUserId(req);
    await workflow.save();
    return { workflow: workflow.toObject(), version: version.toObject() };
  }

  if (!defaults) return null;

  const { Workflow, WorkflowVersion } = getWorkflowModels(tenantDB);
  let workflow = await Workflow.findOne({
    tenantId,
    moduleKey: normalizeModuleKey(moduleKey),
    entityType: normalizeEntityType(entityType),
    isDeleted: { $ne: true },
  });

  if (!workflow) {
    workflow = await Workflow.create({
      tenantId,
      moduleKey: normalizeModuleKey(moduleKey),
      entityType: normalizeEntityType(entityType),
      name: defaults.name,
      description: defaults.description,
      createdBy: actorUserId(req),
      updatedBy: actorUserId(req),
    });
  }

  const versionNo = Number(workflow.activeVersion || 0) + 1;
  const version = await WorkflowVersion.create({
    tenantId,
    workflowId: workflow._id,
    version: versionNo,
    status: 'PUBLISHED',
    definition: defaults.definition,
    publishedAt: new Date(),
    publishedBy: actorUserId(req),
    createdBy: actorUserId(req),
  });

  workflow.status = 'PUBLISHED';
  workflow.isActive = true;
  workflow.activeVersion = versionNo;
  workflow.activeVersionId = version._id;
  workflow.updatedBy = actorUserId(req);
  await workflow.save();

  return { workflow: workflow.toObject(), version: version.toObject() };
}

async function listWorkflows({ tenantDB, tenantId, moduleKey, entityType }) {
  const { Workflow } = getWorkflowModels(tenantDB);
  const query = { tenantId, isDeleted: { $ne: true } };
  if (moduleKey) query.moduleKey = normalizeModuleKey(moduleKey);
  if (entityType) query.entityType = normalizeEntityType(entityType);
  return Workflow.find(query).sort({ updatedAt: -1 }).lean();
}

async function createDraftWorkflow({ tenantDB, tenantId, req, body }) {
  const { Workflow, WorkflowVersion } = getWorkflowModels(tenantDB);
  const moduleKey = normalizeModuleKey(body.moduleKey);
  const entityType = normalizeEntityType(body.entityType);
  if (!moduleKey || !entityType || !body.name) {
    throw new Error('moduleKey, entityType and name are required.');
  }

  const workflow = await Workflow.create({
    tenantId,
    moduleKey,
    entityType,
    name: body.name,
    description: body.description || '',
    isGlobal: body.isGlobal !== false,
    applicableUnitIds: body.applicableUnitIds || [],
    createdBy: actorUserId(req),
    updatedBy: actorUserId(req),
  });
  const version = await WorkflowVersion.create({
    tenantId,
    workflowId: workflow._id,
    version: 1,
    status: 'DRAFT',
    definition: body.definition || { steps: [], rules: [], settings: {} },
    createdBy: actorUserId(req),
  });

  return { workflow, version };
}

async function updateDraftWorkflow({ tenantDB, tenantId, workflowId, req, body }) {
  const { Workflow, WorkflowVersion } = getWorkflowModels(tenantDB);
  const workflow = await Workflow.findOne({ _id: workflowId, tenantId, isDeleted: { $ne: true } });
  if (!workflow) throw new Error('Workflow not found.');

  if (body.name) workflow.name = body.name;
  if (body.description !== undefined) workflow.description = body.description;
  if (body.isGlobal !== undefined) workflow.isGlobal = body.isGlobal;
  if (body.applicableUnitIds !== undefined) workflow.applicableUnitIds = body.applicableUnitIds;
  workflow.updatedBy = actorUserId(req);

  let draft = await WorkflowVersion.findOne({
    tenantId,
    workflowId: workflow._id,
    status: 'DRAFT',
  }).sort({ version: -1 });

  if (!draft) {
    draft = await WorkflowVersion.create({
      tenantId,
      workflowId: workflow._id,
      version: Number(workflow.activeVersion || 0) + 1,
      status: 'DRAFT',
      definition: body.definition || { steps: [], rules: [], settings: {} },
      createdBy: actorUserId(req),
    });
  } else if (body.definition) {
    draft.definition = body.definition;
    await draft.save();
  }

  await workflow.save();
  return { workflow, version: draft };
}

module.exports = {
  createDraftWorkflow,
  ensureDefaultWorkflow,
  findPublishedWorkflow,
  listWorkflows,
  updateDraftWorkflow,
};
