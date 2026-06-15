const { asyncHandler } = require('../../shared/enterprise.errors');
const { writeTenantAudit } = require('../../core/services/audit.service');

const RESOURCE_MODELS = {
  employees: 'TenantEmployee',
  attendance: 'TenantAttendance',
  payroll: 'TenantPayroll',
  recruitment: 'TenantRecruitment',
  onboarding: 'TenantOnboarding',
  leaves: 'TenantLeave',
  documents: 'TenantDocument',
  assets: 'TenantAsset',
  workflows: 'TenantWorkflow',
  social_media: 'TenantSocialMedia',
  dms: 'TenantDms'
};

function resolveModel(req) {
  const moduleKey = req.params.moduleKey;
  const modelName = RESOURCE_MODELS[moduleKey];
  if (!modelName) {
    const error = new Error(`Unsupported tenant module: ${moduleKey}`);
    error.statusCode = 404;
    throw error;
  }
  return req.tenantDB.model(modelName);
}

exports.list = asyncHandler(async (req, res) => {
  const Model = resolveModel(req);
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const page = Math.max(Number(req.query.page || 1), 1);
  const docs = await Model.find({})
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  res.json({ success: true, data: docs, page, limit });
});

exports.create = asyncHandler(async (req, res) => {
  const Model = resolveModel(req);
  const doc = await Model.create(req.body);
  await writeTenantAudit({
    req,
    action: `${req.params.moduleKey}.created`,
    resource: req.params.moduleKey,
    resourceId: doc._id.toString()
  });
  res.status(201).json({ success: true, data: doc });
});

exports.getOne = asyncHandler(async (req, res) => {
  const Model = resolveModel(req);
  const doc = await Model.findById(req.params.id).lean();
  if (!doc) return res.status(404).json({ success: false, message: 'Record not found' });
  res.json({ success: true, data: doc });
});

exports.update = asyncHandler(async (req, res) => {
  const Model = resolveModel(req);
  const doc = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) return res.status(404).json({ success: false, message: 'Record not found' });
  await writeTenantAudit({
    req,
    action: `${req.params.moduleKey}.updated`,
    resource: req.params.moduleKey,
    resourceId: doc._id.toString()
  });
  res.json({ success: true, data: doc });
});

exports.remove = asyncHandler(async (req, res) => {
  const Model = resolveModel(req);
  const doc = await Model.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ success: false, message: 'Record not found' });
  await writeTenantAudit({
    req,
    action: `${req.params.moduleKey}.deleted`,
    resource: req.params.moduleKey,
    resourceId: doc._id.toString()
  });
  res.json({ success: true, deleted: true });
});

exports.RESOURCE_MODELS = RESOURCE_MODELS;
