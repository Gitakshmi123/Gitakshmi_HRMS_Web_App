const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const { getWorkflowModels } = require('../services/workflowRuntimeCore.service');
const emailService = require('../services/email.service');
const { actorUserId } = require('../services/workflowRuntimeCore.service');

const generateMagicToken = (tenantId) => {
  return `${tenantId}_${crypto.randomBytes(16).toString('hex')}`;
};

exports.startCustomWorkflow = async (req, res) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { applicantId, generatedLetterId, steps } = req.body;
    
    // steps should be an array of: { roleName, email, name }
    if (!applicantId || !generatedLetterId || !steps || !steps.length) {
      return res.status(400).json({ success: false, message: 'Missing required parameters.' });
    }

    const { getModels } = require('../utils/tenantUtils');
    const { GeneratedLetter, Candidate, Employee, User } = getModels(req.tenantDB);
    const { WorkflowInstance, WorkflowAssignment } = getWorkflowModels(req.tenantDB);

    const letter = await GeneratedLetter.findOne({ _id: generatedLetterId, tenant: tenantId });
    if (!letter) {
      return res.status(404).json({ success: false, message: 'Generated letter not found.' });
    }

    // Prepare custom definition
    const definition = {
      steps: steps.map((step, index) => ({
        key: `step_${index + 1}`,
        name: step.roleName || `Approver ${index + 1}`,
        order: index + 1,
        type: 'CUSTOM_EXTERNAL',
        approverEmail: step.email,
        approverName: step.name || 'Approver'
      })),
      rules: [],
      settings: {}
    };

    // Create a custom instance
    const instance = await WorkflowInstance.create({
      tenantId,
      workflowId: new mongoose.Types.ObjectId(),
      workflowVersionId: new mongoose.Types.ObjectId(),
      workflowVersion: 1,
      moduleKey: 'recruitment',
      entityType: 'GeneratedLetter',
      entityId: letter._id,
      requesterEmployeeId: req.user?.employeeId || null,
      requesterUserId: req.user?.id || req.user?.userId,
      contextSnapshot: {
        applicantId: applicantId.toString(),
        tenantId: tenantId.toString(),
        letterType: req.body.letterType || 'offer',
        customDefinition: definition
      },
      currentStepKey: definition.steps[0].key,
      currentStepOrder: 1,
      status: 'PENDING'
    });

    // Create first assignment
    const firstStep = definition.steps[0];
    const magicToken = generateMagicToken(tenantId);
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Attempt to map email to an internal user/employee for security
    let assigneeUserId = null;
    let assigneeEmployeeId = null;
    try {
      const emailRegex = new RegExp(`^${String(firstStep.approverEmail).replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}$`, 'i');
      const user = await User.findOne({ email: { $regex: emailRegex }, $or: [{ mainCompanyId: tenantId }, { tenantId }] }).select('_id employeeId').lean();
      if (user) {
        assigneeUserId = user._id;
        assigneeEmployeeId = user.employeeId;
      }
    } catch (e) {
      console.warn('Failed to resolve internal user for email:', firstStep.approverEmail);
    }

    const assignment = await WorkflowAssignment.create({
      tenantId,
      instanceId: instance._id,
      workflowId: null, // Custom
      workflowVersionId: null,
      stepKey: firstStep.key,
      stepName: firstStep.name,
      stepOrder: firstStep.order,
      assigneeEmployeeId: assigneeEmployeeId,
      assigneeUserId: assigneeUserId,
      assigneeEmail: firstStep.approverEmail,
      magicToken: magicToken,
      status: 'PENDING',
      dueAt
    });

    // Link workflow to letter
    letter.workflowInstanceId = instance._id;
    letter.workflowStatus = 'PENDING';
    letter.approvalStatus = 'PENDING_APPROVAL';
    letter.approverEmail = firstStep.approverEmail;
    await letter.save();

    // Fire email
    const approvalUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/public/offer-approval/${magicToken}`;
    
    // We need to fetch candidate details to populate email correctly
    const Applicant = req.tenantDB ? req.tenantDB.model("Applicant") : require('mongoose').model("Applicant");
    const applicant = await Applicant.findById(applicantId).populate('requirementId').populate('salarySnapshotId');
    const candidateName = applicant ? applicant.name : 'Candidate';
    const jobTitle = applicant?.requirementId?.jobTitle || 'Role';
    
    const { CompanyProfile } = getModels(req.tenantDB);
    const companyProfile = await CompanyProfile.findOne({ tenantId });
    const companyName = companyProfile?.companyName || 'Our Company';

    const pdfPath = path.isAbsolute(letter.pdfPath) ? letter.pdfPath : path.join(__dirname, '../uploads', letter.pdfPath);

    let EmailTemplate;
    if (req.tenantDB) {
      if (!req.tenantDB.models.EmailTemplate) {
        req.tenantDB.model('EmailTemplate', require('../models/EmailTemplate'));
      }
      EmailTemplate = req.tenantDB.model('EmailTemplate');
    } else {
      if (!mongoose.models.EmailTemplate) {
        mongoose.model('EmailTemplate', require('../models/EmailTemplate'));
      }
      EmailTemplate = mongoose.model('EmailTemplate');
    }
    
    let customTemplate = null;

    if ((req.body.letterType || 'offer') === 'joining') {
      const triggerType = `JOINING_APPROVAL_${firstStep.name.toUpperCase().replace(/\s+/g, '_')}`;
      const template = await EmailTemplate.findOne({ tenantId, triggerType, isActive: true });
      if (template) customTemplate = template;

      await emailService.sendJoiningApprovalRequestEmail(
        firstStep.approverEmail,
        candidateName,
        jobTitle,
        companyName,
        pdfPath,
        approvalUrl,
        assignment._id,
        {
          department: applicant?.department || applicant?.requirementId?.department,
          joiningDate: applicant?.joiningDate,
          applicant: applicant
        },
        firstStep.name, // approverRole
        tenantId,
        customTemplate
      );
    } else {
      const triggerType = `OFFER_APPROVAL_${firstStep.name.toUpperCase().replace(/\s+/g, '_')}`;
      const template = await EmailTemplate.findOne({ tenantId, triggerType, isActive: true });
      if (template) customTemplate = template;

      await emailService.sendOfferApprovalRequestEmail(
        firstStep.approverEmail,
        candidateName,
        jobTitle,
        companyName,
        pdfPath,
        approvalUrl,
        assignment._id,
        {
          ctcYearly: applicant?.ctcYearly || applicant?.expectedCTC || applicant?.currentCTC,
          department: applicant?.department || applicant?.requirementId?.department,
          joiningDate: applicant?.joiningDate,
          applicant: applicant
        },
        firstStep.name, // approverRole
        tenantId,
        customTemplate
      );
    }

    res.json({ success: true, message: 'Custom workflow started and email sent.' });

  } catch (error) {
    console.error('Error starting custom workflow:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
