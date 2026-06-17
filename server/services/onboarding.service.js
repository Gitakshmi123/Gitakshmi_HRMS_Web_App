const mongoose = require('mongoose');
const { sendMail } = require('../utils/emailService');

function getModels(req) {
  const db = req.tenantDB || mongoose.connection;
  
  // Ensure models are registered on this connection
  if (!db.models.Employee) db.model('Employee', require('../models/Employee'));
  if (!db.models.Department) db.model('Department', require('../models/Department'));
  if (!db.models.Designation) db.model('Designation', require('../models/Designation'));
  if (!db.models.Branch) db.model('Branch', require('../models/Branch'));
  if (!db.models.Division) db.model('Division', require('../models/Division'));
  if (!db.models.EmployeeHierarchy) db.model('EmployeeHierarchy', require('../models/EmployeeHierarchy'));
  if (!db.models.Position) db.model('Position', require('../models/Position'));
  if (!db.models.Applicant) db.model('Applicant', require('../models/Applicant'));
  if (!db.models.Candidate) db.model('Candidate', require('../models/Candidate'));
  if (!db.models.OnboardingTemplate) db.model('OnboardingTemplate', require('../models/OnboardingTemplate'));
  if (!db.models.OnboardingSubmission) db.model('OnboardingSubmission', require('../models/OnboardingSubmission'));
  if (!db.models.OnboardingInstance) db.model('OnboardingInstance', require('../models/OnboardingInstance'));
  if (!db.models.OnboardingTask) db.model('OnboardingTask', require('../models/OnboardingTask'));
  if (!db.models.OnboardingDocument) db.model('OnboardingDocument', require('../models/OnboardingDocument'));
  if (!db.models.SalaryAssignment) db.model('SalaryAssignment', require('../models/SalaryAssignment'));
  if (!db.models.SalaryTemplate) db.model('SalaryTemplate', require('../models/SalaryTemplate'));
  if (!db.models.EmployeeSalarySnapshot) db.model('EmployeeSalarySnapshot', require('../models/EmployeeSalarySnapshot'));
  if (!db.models.Notification) db.model('Notification', require('../models/Notification'));
  if (!db.models.AuditLog) db.model('AuditLog', require('../models/AuditLog'));

  return {
    Tenant: mongoose.model('Tenant'),
    User: mongoose.model('User'),
    Employee: db.model('Employee'),
    Department: db.model('Department'),
    Designation: db.model('Designation'),
    Branch: db.model('Branch'),
    Division: db.model('Division'),
    EmployeeHierarchy: db.model('EmployeeHierarchy'),
    Position: db.model('Position'),
    Applicant: db.model('Applicant'),
    Candidate: db.model('Candidate'),
    Role: mongoose.model('Role'),
    SalaryAssignment: db.model('SalaryAssignment'),
    SalaryTemplate: db.model('SalaryTemplate'),
    EmployeeSalarySnapshot: db.model('EmployeeSalarySnapshot'),
    Notification: db.model('Notification'),
    AuditLog: db.model('AuditLog'),
    OnboardingTemplate: db.model('OnboardingTemplate'),
    OnboardingSubmission: db.model('OnboardingSubmission'),
    OnboardingInstance: db.model('OnboardingInstance'),
    OnboardingTask: db.model('OnboardingTask'),
    OnboardingDocument: db.model('OnboardingDocument'),
  };
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

async function resolveActorUser(req, models) {
  if (req.user?.role === 'psa') {
    return {
      id: null,
      name: req.user?.name || 'Super Admin',
      role: 'super_admin',
      email: req.user?.email || 'superadmin@hrms.com',
    };
  }

  const userId = req.user?.id;
  if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
    const user = await models.User.findById(userId).select('name email role').lean();
    if (user) {
      return { id: user._id, name: user.name, role: normalizeRole(user.role), email: user.email };
    }

    const employee = await models.Employee.findById(userId).select('firstName lastName email role').lean();
    if (employee) {
      return {
        id: employee._id,
        name: [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim(),
        role: normalizeRole(employee.role || 'employee'),
        email: employee.email,
      };
    }
  }

  return {
    id: null,
    name: req.user?.name || req.user?.email || 'System',
    role: normalizeRole(req.user?.role),
    email: req.user?.email || '',
  };
}

async function createInAppNotification({ models, tenantId, receiverId, receiverRole, entityType, entityId, title, message }) {
  if (!receiverId) return null;
  try {
    return await models.Notification.create({
      tenant: tenantId,
      receiverId,
      receiverRole: normalizeRole(receiverRole || 'employee'),
      entityType,
      entityId,
      title,
      message,
    });
  } catch (error) {
    console.warn('[onboarding] notification failed:', error.message);
    return null;
  }
}

async function createAuditLog({ models, tenantId, entity, entityId, action, performedBy, before, after, meta }) {
  try {
    await models.AuditLog.create({
      tenant: tenantId,
      entity,
      entityId,
      action,
      performedBy: performedBy || null,
      changes: { before, after },
      meta: meta || {},
    });
  } catch (error) {
    console.warn('[onboarding] audit log failed:', error.message);
  }
}

async function sendEmailSafe({ to, subject, html, text, tenantId }) {
  if (!to) return;
  try {
    await sendMail({ to, subject, html, text, tenantId });
  } catch (error) {
    console.warn('[onboarding] email failed:', error.message);
  }
}

function calculateDueDate(startDate, dueInDays) {
  const date = new Date(startDate || Date.now());
  date.setDate(date.getDate() + Number(dueInDays || 0));
  return date;
}

async function findAssigneeForRole({ models, tenantId, role, employee, stepAssignedUser }) {
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'employee') {
    return {
      assignedToUser: null,
      assignedToEmployee: employee?._id || null,
      email: employee?.email || '',
      name: [employee?.firstName, employee?.lastName].filter(Boolean).join(' ').trim() || employee?.email || 'Employee',
    };
  }

  if (stepAssignedUser) {
    const explicit = await models.User.findById(stepAssignedUser).select('name email role').lean();
    if (explicit) {
      return {
        assignedToUser: explicit._id,
        assignedToEmployee: null,
        email: explicit.email,
        name: explicit.name,
      };
    }
  }

  if (normalizedRole === 'manager' && employee?.manager) {
    const managerEmployee = await models.Employee.findById(employee.manager).select('firstName lastName email').lean();
    if (managerEmployee) {
      return {
        assignedToUser: null,
        assignedToEmployee: managerEmployee._id,
        email: managerEmployee.email,
        name: [managerEmployee.firstName, managerEmployee.lastName].filter(Boolean).join(' ').trim(),
      };
    }
  }

  const user = await models.User.findOne({ tenant: tenantId, role: normalizedRole }).select('name email role').lean();
  if (user) {
    return { assignedToUser: user._id, assignedToEmployee: null, email: user.email, name: user.name };
  }

  const employeeFallback = await models.Employee.findOne({ tenant: tenantId, role: normalizedRole }).select('firstName lastName email').lean();
  if (employeeFallback) {
    return {
      assignedToUser: null,
      assignedToEmployee: employeeFallback._id,
      email: employeeFallback.email,
      name: [employeeFallback.firstName, employeeFallback.lastName].filter(Boolean).join(' ').trim(),
    };
  }

  return { assignedToUser: null, assignedToEmployee: null, email: '', name: normalizedRole.toUpperCase() };
}

async function refreshInstanceMetrics({ models, instanceId }) {
  const [tasks, documents, instance] = await Promise.all([
    models.OnboardingTask.find({ onboardingInstance: instanceId }).lean(),
    models.OnboardingDocument.find({ onboardingInstance: instanceId }).lean(),
    models.OnboardingInstance.findById(instanceId),
  ]);

  if (!instance) return null;

  const totalTasks = tasks.length || 1;
  const completedTasks = tasks.filter((task) => task.status === 'completed').length;
  const nextTask = tasks.filter((task) => task.status !== 'completed').sort((a, b) => a.stepOrder - b.stepOrder)[0];
  const progressPercent = Math.round((completedTasks / totalTasks) * 100);

  instance.progressPercent = progressPercent;
  instance.currentStepOrder = nextTask?.stepOrder || instance.currentStepOrder;
  instance.documentSummary = {
    total: documents.length,
    approved: documents.filter((doc) => doc.status === 'approved').length,
    rejected: documents.filter((doc) => doc.status === 'rejected').length,
    pending: documents.filter((doc) => ['pending', 'resubmitted'].includes(doc.status)).length,
  };

  if (completedTasks === tasks.length && tasks.length > 0) {
    instance.status = 'completed';
    instance.completedAt = instance.completedAt || new Date();
  } else if (tasks.some((task) => task.status === 'overdue')) {
    instance.status = 'blocked';
  } else {
    // SECURITY: Prevent overwriting manually managed statuses like 'verification' or 'docs_pending'
    const autoProgressStates = ['not_started', 'invited', 'in_progress', 'blocked'];
    if (autoProgressStates.includes(instance.status)) {
      instance.status = 'in_progress';
    }
  }

  if (instance.dueDate && instance.dueDate < new Date() && instance.status !== 'completed') {
    instance.slaBreached = true;
  }

  await instance.save();
  return instance;
}

async function appendActivity({ models, instanceId, actor, action, message, meta }) {
  await models.OnboardingInstance.findByIdAndUpdate(instanceId, {
    $push: {
      activity: {
        actorId: actor?.id || null,
        actorName: actor?.name || 'System',
        actorRole: actor?.role || 'system',
        action,
        message,
        meta: meta || {},
        createdAt: new Date(),
      },
    },
  });
}

async function notifyTaskAssignment({ models, tenantId, task, employee, assignee, companyName }) {
  const title = `New onboarding task: ${task.title}`;
  const message = `${employee?.firstName || employee?.email || 'Employee'} has a ${task.assignedRole} onboarding task due on ${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'TBD'}.`;

  await createInAppNotification({
    models,
    tenantId,
    receiverId: task.assignedToUser || task.assignedToEmployee,
    receiverRole: task.assignedRole,
    entityType: 'OnboardingTask',
    entityId: task._id,
    title,
    message,
  });

  if (assignee?.email) {
    await sendEmailSafe({
      to: assignee.email,
      subject: title,
      text: message,
      tenantId,
      html: `<p>${message}</p><p>Company: <strong>${companyName || 'HRMS'}</strong></p>`,
    });
  }
}

async function activatePendingTasks({ models, instanceId }) {
  const tasks = await models.OnboardingTask.find({ onboardingInstance: instanceId }).sort({ stepOrder: 1 });
  let activated = false;
  for (const task of tasks) {
    if (task.status === 'completed') continue;
    if (!activated) {
      task.status = 'in_progress';
      task.startedAt = task.startedAt || new Date();
      await task.save();
      activated = true;
    }
    break;
  }
  return refreshInstanceMetrics({ models, instanceId });
}

async function createTasksFromTemplate({ req, template, employee, hrOwner, managerOwner }) {
  const models = getModels(req);
  const tenantId = req.tenantId || req.user?.tenantId;
  const company = await models.Tenant.findById(tenantId).select('companyName').lean();
  const actor = await resolveActorUser(req, models);

  const steps = Array.isArray(template.steps) ? template.steps : [];
  const dueDate = steps.reduce((latest, step) => {
    const current = calculateDueDate(new Date(), step.dueInDays);
    return !latest || current > latest ? current : latest;
  }, null);

  const instance = await models.OnboardingInstance.create({
    tenant: tenantId,
    company: tenantId,
    template: template._id,
    templateSnapshot: {
      name: template.name,
      code: template.code,
      version: template.version,
      steps: template.steps,
    },
    employee: employee._id,
    hrOwner: hrOwner || actor.id,
    managerOwner: managerOwner || employee.manager || null,
    dueDate,
    activity: [{
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action: 'ONBOARDING_STARTED',
      message: `Onboarding started for ${[employee.firstName, employee.lastName].filter(Boolean).join(' ').trim()}`,
      meta: { templateId: template._id },
      createdAt: new Date(),
    }],
  });

  for (const step of steps.sort((a, b) => a.order - b.order)) {
    const assignee = await findAssigneeForRole({
      models,
      tenantId,
      role: step.assignedRole,
      employee,
      stepAssignedUser: step.assignedUser,
    });

    const task = await models.OnboardingTask.create({
      tenant: tenantId,
      company: tenantId,
      onboardingInstance: instance._id,
      template: template._id,
      stepId: step._id,
      stepOrder: step.order,
      title: step.title,
      description: step.description,
      type: step.type,
      assignedRole: step.assignedRole,
      assignedToUser: assignee.assignedToUser,
      assignedToEmployee: assignee.assignedToEmployee,
      employee: employee._id,
      status: step.order === 1 ? 'in_progress' : 'pending',
      dueDate: calculateDueDate(new Date(), step.dueInDays),
      startedAt: step.order === 1 ? new Date() : null,
      slaHours: step.slaHours,
      completionPayload: {
        checklist: step.checklist || [],
        requiresDocument: step.requiresDocument || false,
        documentType: step.documentType || '',
        instructions: step.instructions || '',
      },
    });

    await notifyTaskAssignment({
      models,
      tenantId,
      task,
      employee,
      assignee,
      companyName: company?.companyName,
    });
  }

  await createAuditLog({
    models,
    tenantId,
    entity: 'OnboardingInstance',
    entityId: instance._id,
    action: 'ONBOARDING_STARTED',
    performedBy: actor.id,
    before: null,
    after: { employeeId: employee._id, templateId: template._id },
    meta: { employeeEmail: employee.email, templateName: template.name },
  });

  return refreshInstanceMetrics({ models, instanceId: instance._id });
}

async function runReminderCycle() {
  const OnboardingTask = mongoose.connection.models.OnboardingTask;
  const OnboardingInstance = mongoose.connection.models.OnboardingInstance;
  const Notification = mongoose.connection.models.Notification;
  if (!OnboardingTask || !OnboardingInstance || !Notification) return;

  const now = new Date();
  const dueSoon = new Date(now.getTime() + (24 * 60 * 60 * 1000));
  const tasks = await OnboardingTask.find({
    status: { $in: ['pending', 'in_progress', 'overdue'] },
    dueDate: { $lte: dueSoon },
  }).limit(100);

  for (const task of tasks) {
    if (task.dueDate && task.dueDate < now && task.status !== 'completed') task.status = 'overdue';
    task.reminderCount += 1;
    task.lastReminderAt = now;
    await task.save();

    await Notification.create({
      tenant: task.tenant,
      receiverId: task.assignedToUser || task.assignedToEmployee,
      receiverRole: task.assignedRole,
      entityType: 'OnboardingTask',
      entityId: task._id,
      title: `Reminder: ${task.title}`,
      message: 'This onboarding task is due soon.',
    }).catch(() => null);

    await OnboardingInstance.findByIdAndUpdate(task.onboardingInstance, {
      $set: {
        lastReminderAt: now,
        slaBreached: task.status === 'overdue',
      },
    }).catch(() => null);
  }
}

module.exports = {
  getModels,
  normalizeRole,
  resolveActorUser,
  createInAppNotification,
  createAuditLog,
  refreshInstanceMetrics,
  appendActivity,
  activatePendingTasks,
  createTasksFromTemplate,
  runReminderCycle,
};
