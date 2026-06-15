const { getOnboardingSuiteModels } = require('./models');
const { WorkflowEngine } = require('./workflow-engine.service');
const { DmsService } = require('./dms.service');
const { AttendanceFaceService } = require('./attendance-face.service');
const { NotificationService } = require('./notification.service');

function tenantId(req) {
  return req.tenantId || req.user?.tenantId || req.user?.companyId;
}

function companyId(req) {
  return req.user?.companyId || req.tenantId || req.user?.tenantId;
}

function actor(req) {
  return req.user || {};
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function createOnboardingSuiteController(deps = {}) {
  const notificationService = deps.notificationService || new NotificationService({ io: deps.io });
  const engine = deps.workflowEngine || new WorkflowEngine({ notificationService });
  const dms = deps.dmsService || new DmsService();
  const attendance = deps.attendanceFaceService || new AttendanceFaceService();

  return {
    createTemplate: asyncHandler(async (req, res) => {
      const template = await engine.createTemplate({
        tenantId: tenantId(req),
        companyId: companyId(req),
        payload: req.body,
        actorId: actor(req).id || actor(req)._id,
      });
      res.status(201).json({ success: true, template });
    }),

    listTemplates: asyncHandler(async (req, res) => {
      const models = getOnboardingSuiteModels();
      const templates = await models.Template.find({ tenant: tenantId(req) }).sort({ updatedAt: -1 }).lean();
      res.json({ success: true, templates });
    }),

    assignWorkflow: asyncHandler(async (req, res) => {
      const Employee = require('../../models/Employee');
      const employee = await Employee.findById(req.body.employeeId).lean();
      if (!employee) return res.status(404).json({ success: false, message: 'employee_not_found' });
      const assignment = await engine.assignToEmployee({
        tenantId: tenantId(req),
        companyId: companyId(req),
        employee,
        templateId: req.body.templateId,
        actorId: actor(req).id || actor(req)._id,
        meta: req.body.meta || {},
      });
      res.status(201).json({ success: true, assignment });
    }),

    getAssignment: asyncHandler(async (req, res) => {
      const models = getOnboardingSuiteModels();
      const [assignment, steps, documents, approvals] = await Promise.all([
        models.Assignment.findOne({ _id: req.params.assignmentId, tenant: tenantId(req) }).lean(),
        models.StepProgress.find({ assignment: req.params.assignmentId, tenant: tenantId(req) }).sort({ phase: 1, createdAt: 1 }).lean(),
        models.Document.find({ assignment: req.params.assignmentId, tenant: tenantId(req) }).lean(),
        models.Approval.find({ assignment: req.params.assignmentId, tenant: tenantId(req) }).lean(),
      ]);
      if (!assignment) return res.status(404).json({ success: false, message: 'assignment_not_found' });
      res.json({ success: true, assignment, steps, documents, approvals });
    }),

    listAssignments: asyncHandler(async (req, res) => {
      const models = getOnboardingSuiteModels();
      const query = { tenant: tenantId(req) };
      if (req.query.status) query.status = req.query.status;
      if (req.query.employeeId) query.employee = req.query.employeeId;
      const assignments = await models.Assignment.find(query).sort({ updatedAt: -1 }).limit(Number(req.query.limit || 50)).lean();
      res.json({ success: true, assignments });
    }),

    startStep: asyncHandler(async (req, res) => {
      const step = await engine.startStep({ assignmentId: req.params.assignmentId, stepKey: req.params.stepKey, actor: actor(req) });
      res.json({ success: true, step });
    }),

    completeStep: asyncHandler(async (req, res) => {
      const step = await engine.completeStep({
        assignmentId: req.params.assignmentId,
        stepKey: req.params.stepKey,
        input: req.body.payload || req.body,
        actor: actor(req),
      });
      res.json({ success: true, step });
    }),

    retryStep: asyncHandler(async (req, res) => {
      const step = await engine.retryStep({ assignmentId: req.params.assignmentId, stepKey: req.params.stepKey, actor: actor(req) });
      res.json({ success: true, step });
    }),

    approve: asyncHandler(async (req, res) => {
      const approval = await engine.approve({ approvalId: req.params.approvalId, actor: actor(req), remarks: req.body.remarks || '' });
      res.json({ success: true, approval });
    }),

    reject: asyncHandler(async (req, res) => {
      const approval = await engine.reject({ approvalId: req.params.approvalId, actor: actor(req), reason: req.body.reason || req.body.remarks || '' });
      res.json({ success: true, approval });
    }),

    uploadDocument: asyncHandler(async (req, res) => {
      const result = await dms.upload({
        tenantId: tenantId(req),
        companyId: companyId(req),
        assignmentId: req.body.assignmentId,
        stepProgressId: req.body.stepProgressId || null,
        employeeId: req.body.employeeId,
        documentType: req.body.documentType,
        category: req.body.category,
        file: req.file,
        actor: actor(req),
      });
      res.status(201).json({ success: true, ...result });
    }),

    reviewDocument: asyncHandler(async (req, res) => {
      const document = await dms.review({ documentId: req.params.documentId, status: req.body.status, reason: req.body.reason, actor: actor(req) });
      res.json({ success: true, document });
    }),

    registerFace: asyncHandler(async (req, res) => {
      const faceProfile = await attendance.registerFace({
        tenantId: tenantId(req),
        companyId: companyId(req),
        assignmentId: req.body.assignmentId,
        employeeId: req.body.employeeId,
        descriptor: req.body.descriptor || req.body.faceDescriptor || req.body.faceEmbedding,
        geo: req.body.geo,
        liveness: req.body.liveness || {},
        deviceId: req.body.deviceId,
      });
      res.status(201).json({ success: true, faceProfile });
    }),

    approveFace: asyncHandler(async (req, res) => {
      const faceProfile = await attendance.approveFace({
        faceProfileId: req.params.faceProfileId,
        actor: actor(req),
        approved: req.body.approved !== false,
        reason: req.body.reason || '',
      });
      res.json({ success: true, faceProfile });
    }),

    verifyFace: asyncHandler(async (req, res) => {
      const result = await attendance.verifyFace({
        tenantId: tenantId(req),
        employeeId: req.body.employeeId,
        descriptor: req.body.descriptor || req.body.faceDescriptor || req.body.faceEmbedding,
        geo: req.body.geo,
        liveness: req.body.liveness || {},
        deviceId: req.body.deviceId,
      });
      res.json({ success: true, ...result });
    }),

    punch: asyncHandler(async (req, res) => {
      const punch = await attendance.punch({
        tenantId: tenantId(req),
        companyId: companyId(req),
        employeeId: req.body.employeeId,
        type: req.params.type,
        verification: req.body.verification || {},
        geo: req.body.geo,
        device: {
          deviceId: req.body.deviceId,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        },
      });
      res.status(201).json({ success: true, punch });
    }),

    seedNotificationTemplate: asyncHandler(async (req, res) => {
      const models = getOnboardingSuiteModels();
      const template = await models.NotificationTemplate.findOneAndUpdate(
        { tenant: tenantId(req), code: String(req.body.code).toUpperCase(), channel: req.body.channel },
        {
          $set: {
            company: companyId(req),
            subject: req.body.subject || '',
            bodyText: req.body.bodyText,
            bodyHtml: req.body.bodyHtml || '',
            variables: req.body.variables || [],
            isActive: req.body.isActive !== false,
          },
        },
        { upsert: true, new: true }
      );
      res.status(201).json({ success: true, template });
    }),
  };
}

module.exports = { createOnboardingSuiteController };
