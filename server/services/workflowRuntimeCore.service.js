const mongoose = require('mongoose');
const path = require('path');
const emailService = require('./email.service');

function getWorkflowModels(tenantDB) {
  if (!tenantDB.models.Workflow) {
    tenantDB.model('Workflow', require('../models/Workflow'));
  }
  if (!tenantDB.models.WorkflowVersion) {
    tenantDB.model('WorkflowVersion', require('../models/WorkflowVersion'));
  }
  if (!tenantDB.models.WorkflowInstance) {
    tenantDB.model('WorkflowInstance', require('../models/WorkflowInstance'));
  }
  if (!tenantDB.models.WorkflowAssignment) {
    tenantDB.model('WorkflowAssignment', require('../models/WorkflowAssignment'));
  }
  if (!tenantDB.models.WorkflowHistory) {
    tenantDB.model('WorkflowHistory', require('../models/WorkflowHistory'));
  }
  if (!tenantDB.models.WorkflowDelegation) {
    tenantDB.model('WorkflowDelegation', require('../models/WorkflowDelegation'));
  }
  return {
    Workflow: tenantDB.model('Workflow'),
    WorkflowVersion: tenantDB.model('WorkflowVersion'),
    WorkflowInstance: tenantDB.model('WorkflowInstance'),
    WorkflowAssignment: tenantDB.model('WorkflowAssignment'),
    WorkflowHistory: tenantDB.model('WorkflowHistory'),
    WorkflowDelegation: tenantDB.model('WorkflowDelegation'),
    Notification: tenantDB.model('Notification'),
    Employee: tenantDB.model('Employee'),
    User: tenantDB.model('User'),
  };
}

function actorUserId(req) {
  const value = req?.user?.id || req?.user?._id || req?.user?.userId;
  return value && mongoose.Types.ObjectId.isValid(String(value)) ? value : null;
}

function normalizeAction(action) {
  const value = String(action || '').trim().toUpperCase();
  return {
    APPROVE: 'APPROVED',
    REJECT: 'REJECTED',
    REQUEST_CHANGES: 'SENT_BACK',
    REQUESTED_CHANGES: 'SENT_BACK',
    SEND_BACK: 'SENT_BACK',
  }[value] || value;
}

async function writeHistory({
  tenantDB,
  tenantId,
  instance,
  action,
  actorEmployeeId = null,
  actorUserId: userId = null,
  stepKey = '',
  fromStatus = '',
  toStatus = '',
  comment = '',
  metadata = {},
  req = null,
}) {
  const { WorkflowHistory } = getWorkflowModels(tenantDB);
  return WorkflowHistory.create({
    tenantId,
    instanceId: instance._id,
    workflowId: instance.workflowId,
    action,
    actorEmployeeId,
    actorUserId: userId,
    stepKey,
    fromStatus,
    toStatus,
    comment,
    metadata,
    ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || '',
    userAgent: req?.headers?.['user-agent'] || '',
  });
}

async function notifyAssignment({ tenantDB, tenantId, instance, assignment }) {
  try {
    const { Notification, Employee } = getWorkflowModels(tenantDB);
    const employee = await Employee.findById(assignment.assigneeEmployeeId).select('firstName lastName name email role').lean();
    const role = String(employee?.role || '').toLowerCase();
    const receiverRole = role.includes('hr') ? 'hr' : (role.includes('manager') ? 'manager' : 'employee');
    await Notification.create({
      tenant: tenantId,
      receiverId: assignment.assigneeEmployeeId,
      receiverRole,
      entityType: instance.entityType,
      entityId: instance.entityId,
      title: 'Approval Required',
      message: `You have a pending ${instance.entityType} approval.`,
    });

    if (instance.entityType === 'GeneratedLetter' && employee?.email) {
      await notifyLetterApprovalByEmail({ tenantDB, tenantId, instance, assignment, employee });
    }
  } catch (_) {
    // Notifications should never block approval routing.
  }
}

function buildOfferApprovalUrl(letterId, tenantId) {
  const baseUrl = String(
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    process.env.FRONTEND_BASE_URL ||
    'http://localhost:5176'
  ).replace(/\/+$/, '');
  return `${baseUrl}/public/offer-approval/${letterId}?tenantId=${tenantId}`;
}

function uploadedLetterPath(letter) {
  const rawPath = String(letter?.signedPdfPath || letter?.pdfPath || letter?.generatedPdf || '').trim();
  if (!rawPath) return '';
  const cleanPath = rawPath.replace(/^[\\/]+/, '').replace(/\\/g, '/').replace(/^uploads\//i, '');
  return path.isAbsolute(cleanPath)
    ? cleanPath
    : path.join(process.cwd(), 'uploads', cleanPath);
}

async function notifyLetterApprovalByEmail({ tenantDB, tenantId, instance, assignment, employee }) {
  try {
    const GeneratedLetter = tenantDB.model('GeneratedLetter');
    const Applicant = tenantDB.model('Applicant');
    const CompanyProfile = tenantDB.model('CompanyProfile');

    const letter = await GeneratedLetter.findOne({ _id: instance.entityId, tenant: tenantId }).lean();
    if (!letter || String(letter.letterType || '').toLowerCase() !== 'offer') return;

    const applicant = letter.applicantId
      ? await Applicant.findById(letter.applicantId).populate('requirementId').populate('salarySnapshotId').lean()
      : null;
    if (!applicant) return;

    const company = await CompanyProfile.findOne({ tenantId }).lean();
    const companyName = company?.companyName || 'Gitakshmi Technologies';
    const jobTitle = applicant.requirementId?.jobTitle || 'Role';
    const approvalUrl = buildOfferApprovalUrl(letter._id, tenantId);
    const approverName = employee.name || `${employee.firstName || ''} ${employee.lastName || ''}`.trim() || employee.email;

    await GeneratedLetter.findByIdAndUpdate(letter._id, {
      $set: {
        approverEmail: employee.email,
        workflowStatus: 'PENDING',
        approvalStatus: 'PENDING_APPROVAL',
      },
    }).catch(() => null);

    await emailService.sendOfferApprovalRequestEmail(
      employee.email,
      applicant.name,
      jobTitle,
      companyName,
      uploadedLetterPath(letter),
      approvalUrl,
      null,
      {
        ctcYearly: applicant.ctcYearly || applicant.expectedCTC || applicant.currentCTC,
        department: applicant.department || applicant.requirementId?.department,
        joiningDate: applicant.joiningDate,
        applicant: applicant
      }
    );

    await Notification.create({
      tenant: tenantId,
      receiverId: assignment.assigneeEmployeeId,
      receiverRole: 'employee',
      entityType: 'GeneratedLetter',
      entityId: letter._id,
      title: `${assignment.stepName} Approval Required`,
      message: `Offer approval is pending with ${approverName} for ${applicant.name}.`,
      isRead: false,
    }).catch(() => null);
  } catch (error) {
    console.error('[WORKFLOW_EMAIL] Offer approval email failed:', error.message);
  }
}

module.exports = {
  actorUserId,
  getWorkflowModels,
  normalizeAction,
  notifyAssignment,
  writeHistory,
};
