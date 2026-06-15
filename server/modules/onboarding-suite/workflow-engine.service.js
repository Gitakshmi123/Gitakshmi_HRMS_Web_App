const mongoose = require('mongoose');
const { getOnboardingSuiteModels } = require('./models');

function includesOrEmpty(list, value) {
  if (!Array.isArray(list) || list.length === 0) return true;
  return list.map(String).map((v) => v.toLowerCase()).includes(String(value || '').toLowerCase());
}

function evaluateConditions(conditions = {}, employee = {}) {
  return (
    includesOrEmpty(conditions.roles, employee.role) &&
    includesOrEmpty(conditions.departments, employee.department) &&
    includesOrEmpty(conditions.locations, employee.location || employee.workLocation) &&
    includesOrEmpty(conditions.employeeTypes, employee.employeeType)
  );
}

function dueDate(slaHours = 48) {
  return new Date(Date.now() + Number(slaHours || 48) * 60 * 60 * 1000);
}

class WorkflowEngine {
  constructor({ notificationService = null } = {}) {
    this.notificationService = notificationService;
  }

  async createTemplate({ tenantId, companyId, payload, actorId }) {
    const models = getOnboardingSuiteModels();
    const activeVersion = await models.Template.findOne({ tenant: tenantId, code: String(payload.code).toUpperCase() })
      .sort({ version: -1 })
      .lean();
    return models.Template.create({
      tenant: tenantId,
      company: companyId || tenantId,
      ...payload,
      code: String(payload.code).toUpperCase(),
      version: Number(activeVersion?.version || 0) + 1,
      createdBy: actorId,
      updatedBy: actorId,
    });
  }

  async selectTemplate({ tenantId, employee }) {
    const models = getOnboardingSuiteModels();
    const templates = await models.Template.find({ tenant: tenantId, status: 'active' }).sort({ updatedAt: -1 }).lean();
    return templates.find((template) => (
      includesOrEmpty(template.targetRoles, employee.role) &&
      includesOrEmpty(template.targetDepartments, employee.department) &&
      includesOrEmpty(template.targetLocations, employee.location || employee.workLocation) &&
      includesOrEmpty(template.employeeTypes, employee.employeeType)
    )) || templates[0] || null;
  }

  async assignToEmployee({ tenantId, companyId, employee, templateId = null, actorId = null, meta = {} }) {
    const models = getOnboardingSuiteModels();
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const template = templateId
        ? await models.Template.findOne({ _id: templateId, tenant: tenantId }).session(session)
        : await this.selectTemplate({ tenantId, employee });

      if (!template) {
        const error = new Error('active_onboarding_template_not_found');
        error.status = 404;
        throw error;
      }

      const existing = await models.Assignment.findOne({
        tenant: tenantId,
        employee: employee._id,
        status: { $in: ['pending', 'in_progress', 'blocked'] },
      }).session(session);
      if (existing) {
        await session.commitTransaction();
        return existing;
      }

      const assignment = await models.Assignment.create([{
        tenant: tenantId,
        company: companyId || tenantId,
        employee: employee._id,
        template: template._id,
        templateSnapshot: template.toObject(),
        hrOwner: actorId,
        joiningDate: employee.joiningDate || null,
        employeeSnapshot: {
          role: employee.role,
          department: employee.department,
          location: employee.location || employee.workLocation,
          employeeType: employee.employeeType,
          email: employee.email,
          name: employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
        },
        meta,
      }], { session });

      const applicableSteps = template.steps
        .filter((step) => evaluateConditions(step.conditions, employee))
        .sort((a, b) => a.order - b.order);

      await models.StepProgress.insertMany(applicableSteps.map((step) => ({
        tenant: tenantId,
        company: companyId || tenantId,
        assignment: assignment[0]._id,
        employee: employee._id,
        template: template._id,
        stepId: step._id,
        stepKey: step.key,
        title: step.title,
        phase: step.phase,
        type: step.type,
        assignedRole: step.assignedRole,
        assignedUser: step.assignedUser,
        dependencies: step.dependencies || [],
        configSnapshot: step.config || {},
        isRequired: step.isRequired !== false,
        isBlocking: step.isBlocking !== false,
        dueAt: null,
      })), { session });

      await session.commitTransaction();
      await this.unlockEligibleSteps(assignment[0]._id);
      await this.publish(tenantId, companyId, 'onboarding.assigned', employee._id, assignment[0]._id, actorId, {});
      return assignment[0];
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async unlockEligibleSteps(assignmentId) {
    const models = getOnboardingSuiteModels();
    const steps = await models.StepProgress.find({ assignment: assignmentId });
    const byKey = new Map(steps.map((step) => [step.stepKey, step]));
    const unlocked = [];

    for (const step of steps) {
      if (step.status !== 'locked') continue;
      const dependenciesMet = (step.dependencies || []).every((dep) => {
        const prior = byKey.get(dep.stepKey);
        return prior && prior.status === (dep.status === 'approved' ? 'completed' : dep.status);
      });
      if (!dependenciesMet) continue;
      step.status = 'pending';
      step.unlockedAt = new Date();
      step.dueAt = dueDate(step.configSnapshot?.slaHours || 48);
      await step.save();
      unlocked.push(step);
    }

    if (unlocked.length) {
      const first = unlocked[0];
      await this.publish(first.tenant, first.company, 'onboarding.step.unlocked', first.employee, first.assignment, null, {
        steps: unlocked.map((step) => ({ key: step.stepKey, title: step.title })),
      });
    }
    await this.recalculate(assignmentId);
    return unlocked;
  }

  async startStep({ assignmentId, stepKey, actor }) {
    const models = getOnboardingSuiteModels();
    const progress = await models.StepProgress.findOne({ assignment: assignmentId, stepKey });
    if (!progress) throw Object.assign(new Error('step_not_found'), { status: 404 });
    if (progress.status !== 'pending') throw Object.assign(new Error(`step_not_startable_from_${progress.status}`), { status: 409 });
    progress.status = 'in_progress';
    progress.startedAt = new Date();
    await progress.save();
    await this.recalculate(assignmentId);
    await this.publish(progress.tenant, progress.company, 'onboarding.step.started', progress.employee, progress.assignment, actor?._id, { stepKey });
    return progress;
  }

  async completeStep({ assignmentId, stepKey, input = {}, actor }) {
    const models = getOnboardingSuiteModels();
    const progress = await models.StepProgress.findOne({ assignment: assignmentId, stepKey });
    if (!progress) throw Object.assign(new Error('step_not_found'), { status: 404 });
    if (!['pending', 'in_progress', 'failed', 'rejected'].includes(progress.status)) {
      throw Object.assign(new Error(`step_not_completable_from_${progress.status}`), { status: 409 });
    }

    try {
      if (progress.type === 'approval') {
        await this.createApprovals(progress);
        progress.status = 'in_progress';
      } else if (progress.type === 'api_trigger') {
        progress.output = await this.executeApiTrigger(progress.configSnapshot?.apiTrigger, input);
        progress.status = 'completed';
        progress.completedAt = new Date();
      } else {
        progress.output = { accepted: true };
        progress.status = 'completed';
        progress.completedAt = new Date();
      }
      progress.input = input;
      progress.completedBy = actor?._id || null;
      progress.lastError = null;
      await progress.save();
      await this.unlockEligibleSteps(assignmentId);
      await this.publish(progress.tenant, progress.company, 'onboarding.step.completed', progress.employee, progress.assignment, actor?._id, { stepKey });
      return progress;
    } catch (error) {
      progress.status = 'failed';
      progress.attemptCount += 1;
      progress.lastError = { message: error.message, at: new Date() };
      await progress.save();
      await this.publish(progress.tenant, progress.company, 'onboarding.step.failed', progress.employee, progress.assignment, actor?._id, { stepKey, error: error.message });
      throw error;
    }
  }

  async createApprovals(progress) {
    const models = getOnboardingSuiteModels();
    const levels = progress.configSnapshot?.approvalLevels?.length
      ? progress.configSnapshot.approvalLevels
      : [{ level: 1, role: progress.assignedRole || 'hr' }];
    const existing = await models.Approval.countDocuments({ stepProgress: progress._id });
    if (existing) return;
    await models.Approval.insertMany(levels.map((level) => ({
      tenant: progress.tenant,
      company: progress.company,
      assignment: progress.assignment,
      stepProgress: progress._id,
      approvalLevel: level.level || 1,
      approverRole: level.role || 'hr',
      approverUser: level.userId || null,
      status: Number(level.level || 1) === 1 ? 'pending' : 'locked',
    })));
  }

  async approve({ approvalId, actor, remarks = '' }) {
    const models = getOnboardingSuiteModels();
    const approval = await models.Approval.findOneAndUpdate(
      { _id: approvalId, status: 'pending' },
      { $set: { status: 'approved', remarks, actedBy: actor?._id || null, actedAt: new Date() } },
      { new: true }
    );
    if (!approval) throw Object.assign(new Error('approval_not_pending'), { status: 409 });

    const next = await models.Approval.findOne({ stepProgress: approval.stepProgress, approvalLevel: approval.approvalLevel + 1 });
    if (next) {
      next.status = 'pending';
      await next.save();
      return approval;
    }

    const progress = await models.StepProgress.findById(approval.stepProgress);
    progress.status = 'completed';
    progress.completedAt = new Date();
    progress.completedBy = actor?._id || null;
    await progress.save();
    await this.unlockEligibleSteps(progress.assignment);
    await this.publish(progress.tenant, progress.company, 'onboarding.approval.approved', progress.employee, progress.assignment, actor?._id, { stepKey: progress.stepKey });
    return approval;
  }

  async reject({ approvalId, actor, reason }) {
    const models = getOnboardingSuiteModels();
    const approval = await models.Approval.findOneAndUpdate(
      { _id: approvalId, status: 'pending' },
      { $set: { status: 'rejected', remarks: reason, actedBy: actor?._id || null, actedAt: new Date() } },
      { new: true }
    );
    if (!approval) throw Object.assign(new Error('approval_not_pending'), { status: 409 });
    const progress = await models.StepProgress.findById(approval.stepProgress);
    progress.status = 'rejected';
    progress.rejectionReason = reason || 'Rejected';
    await progress.save();
    await this.recalculate(progress.assignment);
    await this.publish(progress.tenant, progress.company, 'onboarding.approval.rejected', progress.employee, progress.assignment, actor?._id, { stepKey: progress.stepKey, reason });
    return approval;
  }

  async retryStep({ assignmentId, stepKey, actor }) {
    const models = getOnboardingSuiteModels();
    const progress = await models.StepProgress.findOne({ assignment: assignmentId, stepKey });
    if (!progress) throw Object.assign(new Error('step_not_found'), { status: 404 });
    if (!['failed', 'rejected'].includes(progress.status)) throw Object.assign(new Error('step_retry_not_allowed'), { status: 409 });
    const maxRetries = Number(progress.configSnapshot?.retryPolicy?.maxRetries || 3);
    if (progress.attemptCount >= maxRetries) throw Object.assign(new Error('max_retry_attempts_exceeded'), { status: 409 });
    progress.status = 'pending';
    progress.lastError = null;
    progress.rejectionReason = '';
    await progress.save();
    await this.publish(progress.tenant, progress.company, 'onboarding.step.retried', progress.employee, progress.assignment, actor?._id, { stepKey });
    return progress;
  }

  async executeApiTrigger(config = {}, input = {}) {
    if (!config.url) return { skipped: true, reason: 'api_trigger_url_missing' };
    const axios = require('axios');
    const response = await axios.request({
      method: config.method || 'POST',
      url: config.url,
      data: { ...config.staticPayload, ...input },
      timeout: Number(config.timeoutMs || 10000),
      headers: config.headers || {},
    });
    return { status: response.status, data: response.data };
  }

  async recalculate(assignmentId) {
    const models = getOnboardingSuiteModels();
    const steps = await models.StepProgress.find({ assignment: assignmentId }).lean();
    const required = steps.filter((step) => step.isRequired && step.status !== 'skipped');
    const completed = required.filter((step) => step.status === 'completed');
    const blocked = required.some((step) => ['failed', 'rejected'].includes(step.status) && step.isBlocking);
    const progressPercent = required.length ? Math.round((completed.length / required.length) * 100) : 100;
    const status = progressPercent === 100 ? 'completed' : blocked ? 'blocked' : 'in_progress';
    await models.Assignment.findByIdAndUpdate(assignmentId, {
      progressPercent,
      status,
      startedAt: status === 'in_progress' ? new Date() : undefined,
      completedAt: status === 'completed' ? new Date() : null,
    });
  }

  async publish(tenantId, companyId, type, employeeId, assignmentId, actorId, payload) {
    if (!this.notificationService) return null;
    return this.notificationService.publish({ tenantId, companyId, type, employeeId, assignmentId, actorId, payload });
  }
}

module.exports = { WorkflowEngine, evaluateConditions };
