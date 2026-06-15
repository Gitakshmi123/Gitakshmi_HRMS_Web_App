const path = require('path');
const { getOnboardingSuiteModels } = require('./models');
const { storeLocalOnboardingFile } = require('./storage');

const CATEGORY_BY_TYPE = {
  AADHAAR: 'kyc',
  PAN: 'kyc',
  PASSPORT_PHOTO: 'kyc',
  BANK_PROOF: 'bank',
  DEGREE: 'education',
  DEGREE_CERTIFICATE: 'education',
  MARKSHEET: 'education',
  EXPERIENCE_LETTER: 'employment',
  RELIEVING_LETTER: 'employment',
  PAYSLIP: 'employment',
  NDA: 'policies',
  CODE_OF_CONDUCT: 'policies',
  BGV_CONSENT: 'bgv',
  BGV_REPORT: 'bgv',
};

function classifyDocument({ documentType, fileName = '', fallbackCategory = 'uncategorized' }) {
  const explicitType = String(documentType || '').trim().toUpperCase();
  if (explicitType && CATEGORY_BY_TYPE[explicitType]) {
    return { category: CATEGORY_BY_TYPE[explicitType], documentType: explicitType, confidence: 1 };
  }

  const name = String(fileName || '').toLowerCase();
  const matched = Object.keys(CATEGORY_BY_TYPE).find((type) => name.includes(type.toLowerCase()) || name.includes(type.toLowerCase().replace(/_/g, '')));
  if (matched) return { category: CATEGORY_BY_TYPE[matched], documentType: matched, confidence: 0.75 };

  return { category: fallbackCategory, documentType: explicitType || 'OTHER', confidence: 0.2 };
}

function folderPath({ tenantId, employeeId, category }) {
  return `/tenants/${tenantId}/employees/${employeeId}/onboarding/${category}`;
}

function canAccessDocument({ user, document, action }) {
  const role = String(user?.role || '').toLowerCase();
  const tenantId = String(user?.tenantId || user?.companyId || '');
  if (tenantId && String(document.tenant) !== tenantId) return false;
  if (['psa', 'super_admin', 'company_admin', 'hr', 'admin'].includes(role)) return true;
  if (role === 'finance') return document.category === 'bank' && ['view', 'download', 'review'].includes(action);
  if (role === 'employee') {
    const employeeId = String(user?.employeeId || user?.id || user?._id || '');
    if (String(document.employee) !== employeeId) return false;
    if (document.accessLevel === 'hr_only' || document.accessLevel === 'finance_only') return false;
    return ['upload', 'view', 'download'].includes(action);
  }
  return false;
}

class DmsService {
  async upload({ tenantId, companyId, assignmentId, stepProgressId = null, employeeId, file, documentType, category, actor }) {
    const models = getOnboardingSuiteModels();
    const classification = classifyDocument({ documentType, fileName: file.originalname, fallbackCategory: category || 'uncategorized' });
    const title = classification.documentType.replace(/_/g, ' ');

    let document = await models.Document.findOne({
      tenant: tenantId,
      assignment: assignmentId,
      employee: employeeId,
      documentType: classification.documentType,
      status: { $ne: 'archived' },
    });

    const nextVersion = Number(document?.currentVersion || 0) + 1;
    const storage = await storeLocalOnboardingFile({
      file,
      tenantId,
      employeeId,
      category: classification.category,
      documentType: classification.documentType,
      version: nextVersion,
    });

    if (!document) {
      document = await models.Document.create({
        tenant: tenantId,
        company: companyId || tenantId,
        assignment: assignmentId,
        stepProgress: stepProgressId,
        employee: employeeId,
        folderPath: folderPath({ tenantId, employeeId, category: classification.category }),
        category: classification.category,
        documentType: classification.documentType,
        title,
        currentVersion: nextVersion,
        status: 'pending',
        tags: ['onboarding', classification.category],
      });
    } else {
      document.currentVersion = nextVersion;
      document.status = 'pending';
      document.rejectionReason = '';
      await document.save();
    }

    const version = await models.DocumentVersion.create({
      tenant: tenantId,
      company: companyId || tenantId,
      document: document._id,
      version: nextVersion,
      originalName: file.originalname || path.basename(file.filename || storage.storageKey),
      mimeType: file.mimetype,
      size: file.size,
      storageProvider: storage.storageProvider,
      storageKey: storage.storageKey,
      secureUrl: storage.secureUrl,
      checksum: storage.checksum,
      uploadedBy: actor?._id || actor?.id || null,
      uploadedByRole: actor?.role || '',
      classificationConfidence: classification.confidence,
    });

    return { document, version };
  }

  async review({ documentId, status, reason, actor }) {
    const models = getOnboardingSuiteModels();
    const document = await models.Document.findById(documentId);
    if (!document) throw Object.assign(new Error('document_not_found'), { status: 404 });
    if (!canAccessDocument({ user: actor, document, action: 'review' })) {
      throw Object.assign(new Error('document_access_denied'), { status: 403 });
    }
    if (!['approved', 'rejected'].includes(status)) {
      throw Object.assign(new Error('invalid_document_review_status'), { status: 400 });
    }
    document.status = status;
    document.rejectionReason = status === 'rejected' ? (reason || 'Document rejected') : '';
    await document.save();
    return document;
  }

  async listForAssignment({ tenantId, assignmentId }) {
    const models = getOnboardingSuiteModels();
    return models.Document.find({ tenant: tenantId, assignment: assignmentId })
      .sort({ category: 1, documentType: 1, updatedAt: -1 })
      .lean();
  }
}

module.exports = { DmsService, classifyDocument, canAccessDocument };
