const mongoose = require('mongoose');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { sendMail } = require('../utils/emailService');
const getTenantDB = require('../utils/tenantDB');
const { refreshInstanceMetrics } = require('../services/onboarding.service');

const ONBOARDING_TOKEN_TTL = '7d';

const STANDARD_HR_FORM = {
  name: 'Standard Onboarding Form',
  code: 'STANDARD_HR',
  description: 'Default HR onboarding form including Personal, Bank, Education, and Identity details.',
  isDefault: true,
  status: 'published',
  version: 1,
  sections: [
    {
      id: 'personal',
      title: 'Personal Details',
      fields: [
        { id: 'full_name', name: 'full_name', label: 'Full Name', type: 'text', isRequired: true },
        { id: 'dob', name: 'dob', label: 'Date of Birth', type: 'date', isRequired: true },
        { id: 'gender', name: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'], isRequired: true },
        { id: 'father_name', name: 'father_name', label: "Father's Name", type: 'text', isRequired: true }
      ]
    },
    {
      id: 'identification',
      title: 'Identification',
      fields: [
        { id: 'aadhaar', name: 'aadhaar', label: 'Aadhaar Number', type: 'text', isRequired: true, validation: { regex: '^[0-9]{12}$' } },
        { id: 'pan', name: 'pan', label: 'PAN Number', type: 'text', isRequired: true, validation: { regex: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$' } }
      ]
    },
    {
      id: 'bank',
      title: 'Bank Details',
      fields: [
        { id: 'bank_name', name: 'bank_name', label: 'Bank Name', type: 'text', isRequired: true },
        { id: 'acc_no', name: 'acc_no', label: 'Account Number', type: 'text', isRequired: true },
        { id: 'ifsc', name: 'ifsc', label: 'IFSC Code', type: 'text', isRequired: true }
      ]
    },
    {
      id: 'documents',
      title: 'Documents',
      fields: [
        { id: 'aadhaar_file', name: 'aadhaar_file', label: 'Aadhaar Card Copy', type: 'file', isRequired: true },
        { id: 'pan_file', name: 'pan_file', label: 'PAN Card Copy', type: 'file', isRequired: true },
        { id: 'photo', name: 'photo', label: 'Profile Photo', type: 'file', isRequired: true }
      ]
    },
    {
      id: 'declaration',
      title: 'Declaration',
      fields: [
        { id: 'accept', name: 'accept', label: 'I hereby declare that all information provided is true to the best of my knowledge.', type: 'checkbox', isRequired: true }
      ]
    }
  ]
};

const getModels = (req) => {
  const db = req.tenantDB;
  if (!db.models.OnboardingTemplate) db.model('OnboardingTemplate', require('../models/OnboardingTemplate'));
  if (!db.models.OnboardingSubmission) db.model('OnboardingSubmission', require('../models/OnboardingSubmission'));
  if (!db.models.OnboardingInstance) db.model('OnboardingInstance', require('../models/OnboardingInstance'));
  if (!db.models.OnboardingDocument) db.model('OnboardingDocument', require('../models/OnboardingDocument'));
  if (!db.models.OnboardingTask) db.model('OnboardingTask', require('../models/OnboardingTask'));
  if (!db.models.Candidate) db.model('Candidate', require('../models/Candidate'));
  if (!db.models.User) db.model('User', require('../models/User'));
  if (!db.models.Applicant) db.model('Applicant', require('../models/Applicant'));

  return {
    Template: db.model('OnboardingTemplate'),
    Submission: db.model('OnboardingSubmission'),
    Candidate: req.tenantDB.model('Candidate'),
    User: req.tenantDB.model('User'),
    OnboardingInstance: req.tenantDB.model('OnboardingInstance'),
    OnboardingDocument: req.tenantDB.model('OnboardingDocument'),
    OnboardingTask: db.model('OnboardingTask'),
    Applicant: db.model('Applicant')
  };
};

exports.getTemplates = async (req, res) => {
  try {
    const { Template } = getModels(req);
    const tenantId = req.tenantId;
    let templates = await Template.find({ tenant: tenantId, isActive: true }).sort({ version: -1 });
    
    if (templates.length === 0) {
      const defaultTemplate = await Template.create({
        ...STANDARD_HR_FORM,
        tenant: tenantId,
        createdBy: req.user?.id
      });
      templates = [defaultTemplate];
    }
    
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createTemplate = async (req, res) => {
  try {
    const { Template } = getModels(req);
    const { _id, name, description, sections } = req.body;
    const { id } = req.params;
    const targetId = _id || id;
    const tenantId = req.tenantId;

    if (!name || !sections) {
      return res.status(400).json({ success: false, message: 'Name and sections are required' });
    }

    if (targetId) {
      const existing = await Template.findOne({ _id: targetId, tenant: tenantId });
      if (!existing) return res.status(404).json({ success: false, message: 'Template not found' });
      if (existing.status === 'published') return res.status(400).json({ success: false, message: 'Cannot edit published template' });

      existing.name = name;
      existing.description = description;
      existing.sections = sections;
      await existing.save();
      return res.json({ success: true, template: existing });
    }

    const template = await Template.create({
      tenant: tenantId,
      name,
      description,
      sections,
      status: 'draft',
      version: 1,
      createdBy: req.user?.id
    });

    res.status(201).json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.publishTemplate = async (req, res) => {
  try {
    const { Template } = getModels(req);
    const { id } = req.params;
    const template = await Template.findById(id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    template.status = 'published';
    template.isPublished = true;
    await template.save();

    res.json({ success: true, message: 'Template published successfully', template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.duplicateTemplate = async (req, res) => {
  try {
    const { Template } = getModels(req);
    const { id } = req.params;
    const original = await Template.findById(id);
    if (!original) return res.status(404).json({ success: false, message: 'Template not found' });

    const latest = await Template.findOne({ tenant: original.tenant, name: original.name }).sort({ version: -1 });
    
    const newTemplate = await Template.create({
      tenant: original.tenant,
      name: original.name,
      description: original.description,
      sections: original.sections,
      version: (latest?.version || 1) + 1,
      status: 'draft',
      isPublished: false,
      createdBy: req.user?.id
    });

    res.status(201).json({ success: true, template: newTemplate });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.inviteCandidate = async (req, res) => {
  try {
    const { Template } = getModels(req);
    const { candidateId, templateId } = req.body;
    const tenantId = req.tenantId;

    const template = await Template.findById(templateId);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const models = getModels(req);
    const candidate = await models.Candidate.findById(candidateId);
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const submission = await OnboardingSubmission.findOneAndUpdate(
      { tenant: tenantId, candidateId },
      {
        templateId,
        templateVersion: template.version,
        inviteToken: token,
        expiresAt,
        status: 'INVITED',
        responses: {},
        documents: []
      },
      { upsert: true, new: true }
    );

    // Send Email
    const inviteLink = `${process.env.FRONTEND_URL}/onboarding/portal/${token}`;
    await sendMail({
      to: candidate.email,
      subject: 'Welcome Onboard! Please complete your onboarding formalities',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>Welcome to the team, ${candidate.name}!</h2>
          <p>We are excited to have you with us. Please click the link below to start your onboarding process and submit the required details.</p>
          <a href="${inviteLink}" style="display: inline-block; padding: 10px 20px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px;">Start Onboarding</a>
          <p>This link will expire in 7 days.</p>
        </div>
      `
    });

    res.json({ success: true, message: 'Invite sent successfully', inviteLink });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPublicPortal = async (req, res) => {
  try {
    const { token } = req.params;
    const Submission = mongoose.model('OnboardingSubmission');
    const submission = await Submission.findOne({ inviteToken: token })
      .populate('templateId')
      .populate({
        path: 'candidateId',
        select: 'name email'
      });

    if (!submission) return res.status(404).json({ success: false, message: 'Invalid or expired link' });
    if (submission.expiresAt < new Date()) return res.status(410).json({ success: false, message: 'Link expired' });

    res.json({
      success: true,
      template: submission.templateId,
      submission: {
        status: submission.status,
        responses: submission.responses,
        documents: submission.documents
      },
      candidate: submission.candidateId
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitPublicPortal = async (req, res) => {
  try {
    const { token } = req.params;
    const { responses } = req.body;

    const Submission = mongoose.model('OnboardingSubmission');
    const submission = await Submission.findOne({ inviteToken: token });
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

    submission.responses = responses;
    submission.status = 'VERIFICATION';
    submission.submittedAt = new Date();
    
    // Add log
    submission.logs.push({
      action: 'SUBMITTED',
      performedBy: submission.candidateId,
      performedByModel: 'Candidate',
      timestamp: new Date()
    });

    await submission.save();

    // Sync with OnboardingInstance if exists
    const models = getModels(req);
    const instance = await models.OnboardingInstance.findOne({ 
      tenant: submission.tenant, 
      candidate: submission.candidateId,
      status: { $ne: 'completed' }
    });

    if (instance) {
      instance.status = 'verification';
      instance.formSubmittedAt = new Date();
      
      // Map basic responses if possible (heuristic)
      const resMap = responses || {};
      if (resMap.full_name) {
        const parts = String(resMap.full_name).split(' ');
        instance.personalDetails = {
          ...instance.personalDetails,
          firstName: parts[0],
          lastName: parts.slice(1).join(' ')
        };
      }
      if (resMap.dob) instance.personalDetails.dob = resMap.dob;
      if (resMap.gender) instance.personalDetails.gender = resMap.gender;
      
      if (resMap.bank_name || resMap.acc_no || resMap.ifsc) {
        instance.bankDetails = {
          ...instance.bankDetails,
          bankName: resMap.bank_name,
          accountNumber: resMap.acc_no,
          ifsc: resMap.ifsc
        };
      }

      instance.status = 'verification';
      await instance.save();
      await refreshInstanceMetrics({ models, instanceId: instance._id });

      // Synchronize back to Applicant if linked
      if (instance.applicant) {
        try {
          const Applicant = models.Applicant;
          await Applicant.findByIdAndUpdate(instance.applicant, {
            onboardingStatus: 'verification'
          });
        } catch (syncErr) {
          console.warn('[submitPublicPortal] Applicant sync failed:', syncErr.message);
        }
      }
    }

    res.json({ success: true, message: 'Form submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadPublicDocument = async (req, res) => {
  try {
    const { token } = req.params;
    const { fieldId } = req.body;

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const Submission = mongoose.model('OnboardingSubmission');
    const submission = await Submission.findOne({ inviteToken: token });
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

    // Store in submission
    const fileUrl = `/uploads/onboarding/incoming/${req.file.filename}`;
    const docData = {
      fieldId,
      fileName: req.file.originalname,
      path: fileUrl,
      status: 'PENDING',
      uploadedAt: new Date()
    };

    // Remove old document for same field if exists
    submission.documents = submission.documents.filter(d => d.fieldId !== fieldId);
    submission.documents.push(docData);
    await submission.save();

    // Also create OnboardingDocument for standard HR panel visibility
    const models = getModels(req);
    const instance = await models.OnboardingInstance.findOne({ 
      tenant: submission.tenant, 
      candidate: submission.candidateId,
      status: { $ne: 'completed' }
    });

    if (instance) {
      // Determine document type from fieldId (rough mapping)
      let docType = 'OTHER';
      if (fieldId.includes('aadhaar')) docType = 'AADHAAR';
      else if (fieldId.includes('pan')) docType = 'PAN';
      else if (fieldId.includes('photo')) docType = 'PHOTO';
      else if (fieldId.includes('cheque') || fieldId.includes('bank')) docType = 'BANK_PROOF';
      else if (fieldId.includes('degree') || fieldId.includes('education')) docType = 'EDUCATION';

      await models.OnboardingDocument.create({
        tenant: submission.tenant,
        company: submission.tenant,
        onboardingInstance: instance._id,
        employee: instance.employee,
        type: docType,
        label: fieldId,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: fileUrl,
        secureUrl: fileUrl,
        storageProvider: 'local',
        status: 'pending',
        uploadedByRole: 'candidate'
      });

      await refreshInstanceMetrics({ models, instanceId: instance._id });
    }

    res.json({ success: true, fileUrl });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.verifySubmission = async (req, res) => {
  try {
    const { submissionId, status, remarks, verifiedDocuments } = req.body;
    const tenantId = req.tenantId;

    const models = getModels(req);
    const submission = await models.Submission.findOne({ _id: submissionId, tenant: tenantId });
    if (!submission) return res.status(404).json({ success: false, message: 'Submission not found' });

    submission.status = status; // COMPLETED or REJECTED
    if (status === 'COMPLETED') submission.completedAt = new Date();
    
    // Update individual documents status if provided
    if (verifiedDocuments && Array.isArray(verifiedDocuments)) {
      verifiedDocuments.forEach(vDoc => {
        const doc = submission.documents.find(d => d.fieldId === vDoc.fieldId);
        if (doc) {
          doc.status = vDoc.status;
          doc.remarks = vDoc.remarks;
          doc.verifiedBy = req.user.id;
          doc.verifiedAt = new Date();
        }
      });
    }

    submission.verifiedBy = req.user.id;
    submission.logs.push({
      action: status === 'COMPLETED' ? 'VERIFIED' : 'REJECTED',
      performedBy: req.user.id,
      performedByModel: 'User',
      timestamp: new Date(),
      metadata: { remarks }
    });

    await submission.save();

    res.json({ success: true, message: `Onboarding marked as ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
