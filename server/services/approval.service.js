const mongoose = require('mongoose');
const getTenantDB = require('../utils/tenantDB');
const { emitToUser } = require('./socket.service');
const emailService = require('./email.service');
const path = require('path');
const fs = require('fs');

/**
 * Identify the next approvers based on the step configuration
 */
const resolveApprovers = async (step, requesterId, tenantDB) => {
  if (step.approverType === 'SPECIFIC_USER') {
    return [step.approverId];
  }
  if (step.approverType === 'ROLE') {
    const User = tenantDB.model('User');
    // Assuming user has a 'role' field referencing the role or just a string role name
    // Here we query users with that role
    const users = await User.find({ role: step.approverRole, isActive: true }).select('_id');
    return users.map(u => u._id);
  }
  if (step.approverType === 'RELATIONSHIP') {
    const User = tenantDB.model('User');
    const requester = await User.findById(requesterId);
    if (!requester) return [];
    
    if (step.relationshipType === 'REPORTING_MANAGER') {
      return requester.reportingManager ? [requester.reportingManager] : [];
    }
    // Add logic for DEPARTMENT_HEAD if needed by fetching department and its head
  }
  return [];
};

exports.initiateApproval = async (tenantId, entityId, entityModel, workflowId, requesterId) => {
  const tenantDB = await getTenantDB(tenantId);
  const Workflow = tenantDB.model('ApprovalWorkflow');
  const ApprovalModel = tenantDB.model('Approval');
  const LogModel = tenantDB.model('ApprovalLog');

  const workflow = await Workflow.findById(workflowId);
  if (!workflow) throw new Error('Workflow not found');

  const step1 = workflow.steps.find(s => s.level === 1);
  if (!step1) {
    const approval = new ApprovalModel({
      tenantId,
      entityId,
      entityModel,
      workflowId,
      requesterId,
      currentLevel: 0,
      status: 'APPROVED',
      currentApprovers: []
    });

    await approval.save();

    await LogModel.create({
      approvalId: approval._id,
      actionBy: requesterId,
      action: 'INITIATED',
      level: 0,
      comments: 'Approval workflow initiated and auto-approved because no levels are configured.'
    });

    await executeFinalAction(tenantDB, entityModel, entityId, 'APPROVED');
    return approval;
  }

  const currentApprovers = await resolveApprovers(step1, requesterId, tenantDB);
  if (!currentApprovers.length) {
    throw new Error('No approvers found for the first approval level');
  }

  const approval = new ApprovalModel({
    tenantId,
    entityId,
    entityModel,
    workflowId,
    requesterId,
    currentLevel: 1,
    status: 'PENDING_APPROVAL',
    currentApprovers
  });

  await approval.save();

  await LogModel.create({
    approvalId: approval._id,
    actionBy: requesterId,
    action: 'INITIATED',
    level: 1,
    comments: 'Approval workflow initiated.'
  });

  // Notify Approvers
  const NotificationModel = tenantDB.model('Notification');
  for (const approverId of currentApprovers) {
    const notif = await NotificationModel.create({
      tenant: tenantId,
      user: approverId,
      type: 'APPROVAL_PENDING',
      title: 'Action Required',
      message: `You have a pending approval for ${entityModel}`,
      relatedEntity: entityId,
      relatedModel: entityModel,
      isRead: false
    });
    emitToUser(tenantId, approverId, 'notification:new', notif);
  }

  return approval;
};

exports.processAction = async (tenantId, approvalId, actionBy, action, comments) => {
  const tenantDB = await getTenantDB(tenantId);
  const ApprovalModel = tenantDB.model('Approval');
  const Workflow = tenantDB.model('ApprovalWorkflow');
  const LogModel = tenantDB.model('ApprovalLog');

  const approval = await ApprovalModel.findById(approvalId);
  if (!approval) throw new Error('Approval not found');

  if (approval.status !== 'PENDING_APPROVAL') {
    throw new Error(`Approval is already ${approval.status}`);
  }

  const isCurrentApprover = (approval.currentApprovers || []).some(
    approverId => String(approverId) === String(actionBy)
  );

  if (!isCurrentApprover) {
    throw new Error('You are not authorized to perform this action');
  }

  const workflow = await Workflow.findById(approval.workflowId);

  await LogModel.create({
    approvalId,
    actionBy,
    action,
    level: approval.currentLevel,
    comments
  });

  if (action === 'REJECTED') {
    approval.status = 'REJECTED';
    approval.currentApprovers = [];
    await approval.save();
    
    // Notify Requester
    await notifyUser(tenantDB, tenantId, approval.requesterId, 'APPROVAL_REJECTED', 'Approval Rejected', `Your request for ${approval.entityModel} was rejected.`, approval.entityId, approval.entityModel);

    // Call webhook / entity specific rejection logic here
    await executeFinalAction(tenantDB, approval.entityModel, approval.entityId, 'REJECTED');
    return approval;
  }

  if (action === 'REQUESTED_CHANGES') {
    approval.status = 'CHANGES_REQUESTED';
    approval.currentApprovers = [];
    await approval.save();

    await notifyUser(tenantDB, tenantId, approval.requesterId, 'APPROVAL_CHANGES', 'Changes Requested', `Changes were requested for your ${approval.entityModel} request.`, approval.entityId, approval.entityModel);
    await executeFinalAction(tenantDB, approval.entityModel, approval.entityId, 'CHANGES_REQUESTED');
    return approval;
  }

  if (action === 'APPROVED') {
    const nextLevel = approval.currentLevel + 1;
    const nextStep = workflow.steps.find(s => s.level === nextLevel);

    if (nextStep) {
      // Move to next level
      approval.currentLevel = nextLevel;
      const nextApprovers = await resolveApprovers(nextStep, approval.requesterId, tenantDB);
      if (!nextApprovers.length) {
        throw new Error(`No approvers found for approval level ${nextLevel}`);
      }
      approval.currentApprovers = nextApprovers;
      await approval.save();

      // Notify next approvers
      for (const approverId of nextApprovers) {
        await notifyUser(tenantDB, tenantId, approverId, 'APPROVAL_PENDING', 'Action Required', `You have a pending approval for ${approval.entityModel}`, approval.entityId, approval.entityModel);
      }
    } else {
      // Fully approved
      approval.status = 'APPROVED';
      approval.currentApprovers = [];
      await approval.save();

      await notifyUser(tenantDB, tenantId, approval.requesterId, 'APPROVAL_APPROVED', 'Approved!', `Your request for ${approval.entityModel} was fully approved.`, approval.entityId, approval.entityModel);

      // Call final approval logic
      await executeFinalAction(tenantDB, approval.entityModel, approval.entityId, 'APPROVED');
    }
    return approval;
  }
};

async function notifyUser(tenantDB, tenantId, userId, type, title, message, entityId, entityModel) {
  const NotificationModel = tenantDB.model('Notification');
  const notif = await NotificationModel.create({
    tenant: tenantId,
    user: userId,
    type,
    title,
    message,
    relatedEntity: entityId,
    relatedModel: entityModel,
    isRead: false
  });
  emitToUser(tenantId, userId, 'notification:new', notif);
}

async function executeFinalAction(tenantDB, entityModel, entityId, status) {
  if (entityModel === 'GeneratedLetter' || entityModel === 'OfferLetter') {
    const modelName = entityModel === 'OfferLetter' && tenantDB.models.OfferLetter
      ? 'OfferLetter'
      : 'GeneratedLetter';
    const LetterModel = tenantDB.model(modelName);
    const letter = await LetterModel.findById(entityId);
    if (!letter) return;

    letter.approvalStatus = status;
    if (status === 'APPROVED') {
      letter.status = 'approved';
    } else if (status === 'REJECTED') {
      letter.status = 'rejected';
    } else if (status === 'CHANGES_REQUESTED') {
      letter.status = 'changes_requested';
    }
    await letter.save();

    // Automate applicant update and candidate notification
    try {
      const Applicant = tenantDB.model('Applicant');
      const applicant = await Applicant.findById(letter.applicantId).populate('requirementId');

      if (applicant) {
        if (status === 'APPROVED') {
          if (letter.letterType === 'joining') {
            // 1. Update applicant status and timeline
            applicant.status = 'Joining Letter Issued';
            applicant.joiningLetterStatus = 'SENT';
            applicant.joiningLetterPath = letter.pdfPath || letter.generatedPdf;
            if (!applicant.timeline) applicant.timeline = [];
            applicant.timeline.push({
              status: 'Joining Letter Issued',
              message: `Joining Letter approved by ${letter.approverEmail || 'approver'} via ESS dashboard and issued to candidate.`,
              updatedBy: 'Approver',
              timestamp: new Date()
            });
            await applicant.save();

            // 2. Send email to candidate and create notification
            const CompanyProfile = tenantDB.model('CompanyProfile');
            const Notification = tenantDB.model('Notification');

            const company = await CompanyProfile.findOne({ tenantId: letter.tenant });
            const companyName = company?.companyName || 'Gitakshmi Technologies';
            const jobTitle = applicant.requirementId?.jobTitle || 'Role';

            const attachmentPath = resolveUploadedLetterPath(letter);

            // Dispatch email in background
            setImmediate(async () => {
              try {
                if (applicant.email) {
                  const formattedJoiningDate = applicant.joiningDate
                    ? new Date(applicant.joiningDate).toLocaleDateString('en-GB')
                    : new Date().toLocaleDateString('en-GB');

                  await emailService.sendJoiningLetterEmail(
                    applicant.email,
                    applicant.name,
                    jobTitle,
                    companyName,
                    formattedJoiningDate,
                    attachmentPath
                  );
                }

                if (applicant.candidateId && Notification) {
                  await Notification.create({
                    tenant: letter.tenant,
                    receiverId: applicant.candidateId,
                    receiverRole: 'candidate',
                    entityType: 'JoiningLetter',
                    entityId: letter._id,
                    title: 'Joining Letter Issued',
                    message: `Congratulations! Your joining letter for ${jobTitle} has been issued. Please check your email or download it from here.`,
                    isRead: false
                  });
                }
              } catch (notifyErr) {
                console.error("⚠️ [APPROVE JOINING ESS] Failed to send candidate notification:", notifyErr.message);
              }
            });
          } else {
            // 1. Update applicant status and timeline
            applicant.status = 'Offer Issued';
            applicant.offerStatus = 'SENT';
            if (!applicant.timeline) applicant.timeline = [];
            applicant.timeline.push({
              status: 'Offer Issued',
              message: `Offer Letter approved by ${letter.approverEmail || 'approver'} via ESS dashboard and issued to candidate.`,
              updatedBy: 'Approver',
              timestamp: new Date()
            });
            await applicant.save();

            // 2. Send email to candidate and create notification
            const CompanyProfile = tenantDB.model('CompanyProfile');
            const Notification = tenantDB.model('Notification');

            const company = await CompanyProfile.findOne({ tenantId: letter.tenant });
            const companyName = company?.companyName || 'Gitakshmi Technologies';
            const jobTitle = applicant.requirementId?.jobTitle || 'Role';

            const attachmentPath = resolveUploadedLetterPath(letter);

            // Dispatch email in background
            setImmediate(async () => {
              try {
                if (applicant.email) {
                  const emailTemplateId = letter.snapshotData?.get ? letter.snapshotData.get('emailTemplateId') : letter.snapshotData?.emailTemplateId;
                  let emailTemplateHtml = null;
                  if (emailTemplateId) {
                      try {
                          const EmailTemplate = mongoose.model('EmailTemplate');
                          const emailTemplate = await EmailTemplate.findOne({ _id: emailTemplateId, tenantId: letter.tenant });
                          if (emailTemplate) {
                              emailTemplateHtml = emailTemplate.bodyHtml;
                          }
                      } catch (err) {
                          console.warn("⚠️ Failed to load selected email template for approved offer in approval service:", err.message);
                      }
                  }

                  await emailService.sendOfferLetterEmail(
                    applicant.email,
                    applicant.name,
                    jobTitle,
                    companyName,
                    attachmentPath,
                    emailTemplateHtml, // customHtml
                    applicant, // applicant
                    letter.tenant // tenantId
                  );
                }

                if (applicant.candidateId && Notification) {
                  await Notification.create({
                    tenant: letter.tenant,
                    receiverId: applicant.candidateId,
                    receiverRole: 'candidate',
                    entityType: 'OfferLetter',
                    entityId: letter._id,
                    title: 'Offer Letter Issued',
                    message: `Congratulations! Your offer letter for ${jobTitle} has been issued. Please check your email or download it from here.`,
                    isRead: false
                  });
                }
              } catch (notifyErr) {
                console.error("⚠️ [APPROVE OFFER ESS] Failed to send candidate notification:", notifyErr.message);
              }
            });
          }

        } else if (status === 'REJECTED') {
          if (letter.letterType === 'joining') {
            applicant.status = 'Joining Letter Rejected';
            applicant.joiningLetterStatus = 'REJECTED';
            if (!applicant.timeline) applicant.timeline = [];
            applicant.timeline.push({
              status: 'Joining Letter Rejected',
              message: `❌ Joining Letter Rejected by Approver.`,
              updatedBy: 'Approver',
              timestamp: new Date()
            });
            await applicant.save();
          } else {
            // Update applicant status and timeline
            applicant.status = 'Offer Rejected';
            applicant.offerStatus = 'REJECTED';
            if (!applicant.timeline) applicant.timeline = [];
            applicant.timeline.push({
              status: 'Offer Rejected',
              message: `❌ Offer Letter Rejected by Approver.`,
              updatedBy: 'Approver',
              timestamp: new Date()
            });
            await applicant.save();
        }
      }
    }
  } catch (err) {
    console.error("⚠️ [executeFinalAction] Failed to update applicant or notify candidate:", err.message);
  }
  }
}

function resolveUploadedLetterPath(letterOrPath) {
  const candidates = typeof letterOrPath === 'string'
      ? [letterOrPath]
      : [letterOrPath?.signedPdfPath, letterOrPath?.pdfPath, letterOrPath?.generatedPdf, letterOrPath?.pdfUrl];

  const uploadsRoot = path.resolve(__dirname, '../uploads');
  for (const candidate of candidates) {
      let cleanPath = String(candidate || '').trim();
      if (!cleanPath) continue;

      try {
          if (/^https?:\/\//i.test(cleanPath)) {
              cleanPath = new URL(cleanPath).pathname;
          }
          cleanPath = decodeURIComponent(cleanPath);
      } catch (_) {}

      cleanPath = cleanPath.split('#')[0].split('?')[0].replace(/\\/g, '/');
      const possiblePaths = [];

      if (path.isAbsolute(cleanPath)) {
          possiblePaths.push(path.resolve(cleanPath));
      }

      const relativePath = cleanPath.replace(/^\/+/, '').replace(/^uploads\//i, '');
      if (relativePath) {
          possiblePaths.push(path.resolve(uploadsRoot, relativePath));
          possiblePaths.push(path.resolve(process.cwd(), relativePath));
      }

      for (const possiblePath of possiblePaths) {
          if (fs.existsSync(possiblePath)) return possiblePath;
      }
  }

  return null;
}
