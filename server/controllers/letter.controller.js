const mongoose = require('mongoose');
const SalaryStructure = require('../models/SalaryStructure'); // Global Model
const letterPDFGenerator = require('../services/letterPDFGenerator');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');
const mammoth = require('mammoth');
const joiningLetterUtils = require('../utils/joiningLetterUtils');
const emailService = require('../services/email.service');
const { verifyJwtWithCandidates } = require('../middleware/auth.jwt');
require('../services/LibreOfficeService');

// PDF conversion uses LibreOfficeService (reliable cross-platform solution)
// // console.log('🚀 LETTER CONTROLLER VERSION: 3.2 (Async LibreOffice + Fast Preview)');

const GENERATED_PREVIEW_CONTENT_TYPES = {
    '.pdf': 'application/pdf',
    '.html': 'text/html; charset=utf-8',
    '.htm': 'text/html; charset=utf-8'
};

function resolveGeneratedPreviewPath(rawPath) {
    let cleanPath = String(rawPath || '').trim();
    if (!cleanPath) return null;

    try {
        if (/^https?:\/\//i.test(cleanPath)) {
            cleanPath = new URL(cleanPath).pathname;
        }
        cleanPath = decodeURIComponent(cleanPath);
    } catch (_) {
        // Keep the original value if URL parsing/decoding fails.
    }

    cleanPath = cleanPath
        .split('#')[0]
        .split('?')[0]
        .replace(/\\/g, '/')
        .replace(/^\/+/, '');

    if (cleanPath.toLowerCase().startsWith('uploads/')) {
        cleanPath = cleanPath.slice('uploads/'.length);
    }

    const uploadsRoot = path.resolve(__dirname, '../uploads');
    const absolutePath = path.resolve(uploadsRoot, cleanPath);
    const normalizedRoot = uploadsRoot.toLowerCase();
    const normalizedPath = absolutePath.toLowerCase();
    const rootWithSep = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`;

    if (normalizedPath !== normalizedRoot && !normalizedPath.startsWith(rootWithSep)) {
        return null;
    }

    return { absolutePath, relativePath: cleanPath };
}

function resolveUploadedLetterPath(letter) {
    const rawPath = String(letter?.signedPdfPath || letter?.pdfPath || letter?.generatedPdf || '').trim();
    if (!rawPath) return '';
    const cleanPath = rawPath
        .replace(/^[\\/]+/, '')
        .replace(/\\/g, '/')
        .replace(/^uploads\//i, '');
    return path.isAbsolute(cleanPath)
        ? cleanPath
        : path.join(process.cwd(), 'uploads', cleanPath);
}

function buildOfferApprovalUrl(req, letterId, tenantId) {
    let baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.FRONTEND_BASE_URL;
    
    if (!baseUrl) {
        const host = req.get?.('host') || 'localhost:5176';
        const protocol = req.protocol || 'http';
        baseUrl = `${protocol}://${host}`;
        
        const backendPort = process.env.PORT || '5006';
        let frontendPort = '5176';
        if (process.env.FRONTEND_URL) {
            try {
                const u = new URL(process.env.FRONTEND_URL);
                if (u.port) frontendPort = u.port;
            } catch (_) {}
        }
        
        baseUrl = baseUrl.replace(new RegExp(`:${backendPort}$`), `:${frontendPort}`);
    }
    
    baseUrl = String(baseUrl).replace(/\/+$/, '');
    return `${baseUrl}/public/offer-approval/${letterId}?tenantId=${tenantId}`;
}

function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function buildLetterRenderCache({ kind, template, target, snapshot, payload = {} }) {
    const sourcePath = template?.filePath ? normalizeFilePath(template.filePath) : '';
    let templateFileMtime = '';
    try {
        templateFileMtime = sourcePath && fs.existsSync(sourcePath) ? String(fs.statSync(sourcePath).mtimeMs) : '';
    } catch {
        templateFileMtime = '';
    }

    const cachePayload = {
        kind,
        templateId: String(template?._id || ''),
        templateUpdatedAt: template?.updatedAt || '',
        templateFileMtime,
        targetId: String(target?._id || ''),
        targetUpdatedAt: target?.updatedAt || '',
        snapshotId: String(snapshot?._id || ''),
        snapshotUpdatedAt: snapshot?.updatedAt || '',
        payload
    };
    const key = crypto.createHash('sha256').update(stableStringify(cachePayload)).digest('hex').slice(0, 24);
    const cacheDir = path.join(__dirname, '../uploads/letter-cache');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    const baseName = `${kind}_${key}`;
    return {
        key,
        dir: cacheDir,
        docxPath: path.join(cacheDir, `${baseName}.docx`),
        pdfPath: path.join(cacheDir, `${baseName}.pdf`),
        pdfUrl: `/uploads/letter-cache/${baseName}.pdf`
    };
}

async function copyIfExists(source, destination) {
    if (!source || !destination || !fs.existsSync(source)) return false;
    await fsPromises.copyFile(source, destination);
    return true;
}

async function extractPlaceholders(filePath) {
    try {
        const buffer = await fsPromises.readFile(filePath);
        const zip = new PizZip(buffer);
        const xmlParts = zip.file(/word\/(document|header\d*|footer\d*)\.xml/);
        if (!Array.isArray(xmlParts) || xmlParts.length === 0) return [];

        const placeholderRegex = /\{\{([^}]+)\}\}/g;
        const placeholders = new Set();

        const decodeXmlEntities = (value) => value
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");

        for (const xmlEntry of xmlParts) {
            const xmlText = decodeXmlEntities(
                xmlEntry
                    .asText()
                    .replace(/<w:tab\/>/g, '\t')
                    .replace(/<w:br\/>/g, '\n')
                    .replace(/<w:p\b[^>]*>/g, '\n')
                    .replace(/<[^>]+>/g, '')
            );

            let match;
            while ((match = placeholderRegex.exec(xmlText)) !== null) {
                const cleaned = sanitizePlaceholderToken(match[1]);
                if (cleaned) placeholders.add(cleaned);
            }
        }

        return Array.from(placeholders);
    } catch (error) {
        console.warn('⚠️ Error extracting placeholders (non-critical):', error.message);
        return [];
    }
}

async function validateWordTemplateSyntax(filePath) {
    try {
        const buffer = await fsPromises.readFile(filePath);
        const zip = new PizZip(buffer);
        new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            nullGetter: () => '',
            delimiters: { start: '{{', end: '}}' }
        });
        return { valid: true };
    } catch (error) {
        const nestedErrors = error.properties?.errors || error.properties?.error || [];
        const firstError = Array.isArray(nestedErrors) ? nestedErrors[0] : nestedErrors;
        const details = firstError?.properties || error.properties || {};
        const tag = details.xtag ? ` near "${String(details.xtag).slice(0, 80)}"` : '';
        const explanation = details.explanation || error.message || 'Invalid Word template syntax';

        return {
            valid: false,
            message: `Invalid template placeholder${tag}. ${explanation}. Please fix all {{placeholder}} tags and upload again.`,
            details: {
                code: details.id || error.properties?.id || 'INVALID_TEMPLATE_SYNTAX',
                tag: details.xtag || null,
                file: details.file || null
            }
        };
    }
}

function sanitizePlaceholderToken(raw) {
    const cleaned = String(raw || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return null;
    if (cleaned.length > 120) return null;
    if (/mergefield/i.test(cleaned)) return null;
    if (/^w:/i.test(cleaned)) return null;
    if (!/[a-z0-9]/i.test(cleaned)) return null;

    return cleaned;
}

function sanitizePlaceholderList(placeholders = []) {
    if (!Array.isArray(placeholders)) return [];
    const seen = new Set();
    const result = [];

    for (const token of placeholders) {
        const cleaned = sanitizePlaceholderToken(token);
        if (!cleaned || seen.has(cleaned)) continue;
        seen.add(cleaned);
        result.push(cleaned);
    }

    return result;
}

function normalizeVariableKey(value) {
    return String(value || '')
        .trim()
        .replace(/<[^>]+>/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase();
}

function humanizeVariableKey(value) {
    const normalized = normalizeVariableKey(value);
    if (!normalized) return 'Custom Field';
    return normalized
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

const STANDARD_LETTER_VARIABLES = new Set([
    'employee_name', 'candidate_name', 'name', 'applicant_name', 'applicantname', 'candidatename',
    'father_name', 'father_names', 'fathername', 'fathernames',
    'relation_type', 'relationtype', 'relationship_type', 'relationship',
    'designation', 'job_title', 'department', 'grade', 'grade_name', 'grade_code', 'grade_level',
    'joining_date', 'joiningdate', 'location', 'work_location', 'address', 'candidate_address',
    'offer_ref_no', 'ref_no', 'refno', 'ref_code', 'reference_number', 'reference_no', 'ref', 'reference',
    'issued_date', 'issueddate', 'issue_date', 'current_date', 'today', 'date', 'date_odt',
    'dear_name', 'dearname', 'dear_name_only', 'signature', 'candidate_signature',
    'company_name', 'candidate_email', 'email', 'mobile', 'phone', 'date_of_birth'
]);

function looksLikeSalaryVariable(key) {
    return /_(monthly|yearly|annual)$/.test(key)
        || /^(basic|hra|medical|conveyance|transport|education|books|uniform|mobile|special|pf|pt|gratuity|insurance|gross_a|gross_b|gross_c|ctc|total_ctc|net_salary)/.test(key);
}

function sanitizeCustomFields(customFields = [], placeholders = []) {
    const seen = new Set();
    const result = [];

    const addField = (field) => {
        const key = normalizeVariableKey(field?.key || field?.name || field?.label);
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push({
            key,
            label: String(field?.label || humanizeVariableKey(key)).trim(),
            type: ['text', 'textarea', 'date', 'number', 'email', 'phone'].includes(field?.type) ? field.type : 'text',
            required: field?.required === true || field?.required === 'true',
            placeholder: String(field?.placeholder || '').trim()
        });
    };

    if (typeof customFields === 'string') {
        try {
            customFields = JSON.parse(customFields);
        } catch (_) {
            customFields = [];
        }
    }

    if (Array.isArray(customFields)) {
        customFields.forEach(addField);
    }

    sanitizePlaceholderList(placeholders).forEach((placeholder) => {
        const key = normalizeVariableKey(placeholder);
        if (!key || STANDARD_LETTER_VARIABLES.has(key) || looksLikeSalaryVariable(key)) return;
        addField({ key, label: humanizeVariableKey(key) });
    });

    return result;
}

function expandCustomData(customData = {}) {
    if (!customData || typeof customData !== 'object' || Array.isArray(customData)) return {};
    const expanded = {};

    Object.entries(customData).forEach(([rawKey, rawValue]) => {
        const key = normalizeVariableKey(rawKey);
        if (!key) return;
        const value = rawValue === undefined || rawValue === null ? '' : String(rawValue);
        const spaced = key.replace(/_/g, ' ');
        const camel = key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());

        expanded[key] = value;
        expanded[key.toUpperCase()] = value;
        expanded[spaced] = value;
        expanded[spaced.toUpperCase()] = value;
        expanded[camel] = value;
    });

    return expanded;
}

function replaceTemplateVariables(content, data) {
    let output = String(content || '');
    Object.entries(data || {}).forEach(([key, value]) => {
        const escaped = String(key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        output = output.replace(new RegExp(`\\{\\{\\s*${escaped}\\s*\\}\\}`, 'gi'), value ?? '');
    });
    return output;
}

function extractPlaceholdersFromText(content = '') {
    const placeholders = new Set();
    const regex = /\{\{(.*?)\}\}/g;
    let match;
    while ((match = regex.exec(String(content || ''))) !== null) {
        const cleaned = sanitizePlaceholderToken(match[1]);
        if (cleaned) placeholders.add(cleaned);
    }
    return Array.from(placeholders);
}

function normalizeRelationType(value) {
    const normalized = String(value || '').trim().toUpperCase();
    if (!normalized) return '';
    if (['S/O', 'D/O', 'W/O', 'H/O', 'M/O', 'P/O', 'G/O'].includes(normalized)) return normalized;
    const legacyMap = {
        FATHER: 'S/O',
        DAUGHTER: 'D/O',
        WIFE: 'W/O',
        HUSBAND: 'H/O',
        MOTHER: 'M/O',
        GUARDIAN: 'G/O',
        OTHER: 'P/O'
    };
    return legacyMap[normalized] || '';
}

function pickCandidateContact(applicant) {
    const mobile = String(
        applicant?.mobile ||
        applicant?.phone ||
        applicant?.contactNo ||
        applicant?.phone_no ||
        ''
    ).trim();

    if (mobile) return mobile;

    // Fallback to 'contact' only if it doesn't match the name (which would mean it's a name, not a number)
    const contact = String(applicant?.contact || '').trim();
    if (contact && contact.toLowerCase() !== String(applicant?.name || '').trim().toLowerCase()) {
        return contact;
    }

    return '';
}

function sanitizeDocxTemplateDelimiters(zip) {
    try {
        const files = zip.file(/word\/(document|header\d*|footer\d*)\.xml/);
        if (!Array.isArray(files) || files.length === 0) return;

        files.forEach((entry) => {
            const xml = entry.asText();
            const sanitized = xml
                // Convert triple/quadruple brace runs to standard docxtemplater delimiters.
                .replace(/\{{3,}/g, '{{')
                .replace(/\}{3,}/g, '}}');

            if (sanitized !== xml) {
                zip.file(entry.name, sanitized);
            }
        });
    } catch (e) {
        console.warn('⚠️ [DOCX SANITIZE] Failed to sanitize template delimiters:', e.message);
    }
}

function buildTemplateCompileError(error) {
    const issues = Array.isArray(error?.properties?.errors) ? error.properties.errors : [];
    const details = issues.map((item) => ({
        id: item?.properties?.id || item?.id || 'template_error',
        file: item?.properties?.file || 'word/document.xml',
        context: item?.properties?.context || item?.properties?.xtag || item?.message || 'Invalid template tag'
    }));

    return {
        success: false,
        code: 'INVALID_TEMPLATE_SYNTAX',
        message: 'Template contains invalid placeholder syntax. Use {{placeholder}} format with exactly two braces.',
        details
    };
}

// Helper to get models from tenant database
function getModels(req) {
    if (!req.tenantDB) {
        throw new Error("Tenant database connection not available");
    }
    const db = req.tenantDB;
    try {
        // Safe Lazy Loading for all required models
        if (!db.models.GeneratedLetter) {
            try { db.model('GeneratedLetter', require('../models/GeneratedLetter')); } catch (e) { }
        }
        if (!db.models.LetterTemplate) {
            try { db.model('LetterTemplate', require('../models/LetterTemplate')); } catch (e) { }
        }
        if (!db.models.Applicant) {
            try { db.model('Applicant', require('../models/Applicant')); } catch (e) { }
        }
        if (!db.models.Candidate) {
            try { db.model('Candidate', require('../models/Candidate')); } catch (e) { }
        }
        if (!db.models.Employee) {
            try { db.model('Employee', require('../models/Employee')); } catch (e) { }
        }
        if (!db.models.CompanyProfile) {
            try { db.model('CompanyProfile', require('../models/CompanyProfile')); } catch (e) { }
        }
        if (!db.models.LetterApproval) {
            try { db.model('LetterApproval', require('../models/LetterApproval')); } catch (e) { }
        }
        if (!db.models.Notification) {
            try { db.model('Notification', require('../models/Notification')); } catch (e) { }
        }
        if (!db.models.SignedLetter) {
            try { db.model('SignedLetter', require('../models/SignedLetter')); } catch (e) { }
        }
        if (!db.models.BGVCase) {
            try { db.model('BGVCase', require('../models/BGVCase')); } catch (e) { }
        }
        if (!db.models.LetterRevocation) {
            try { db.model('LetterRevocation', require('../models/LetterRevocation')); } catch (e) { }
        }
        if (!db.models.EmployeeSalarySnapshot) {
            try { db.model('EmployeeSalarySnapshot', require('../models/EmployeeSalarySnapshot')); } catch (e) { }
        }
        if (!db.models.SalaryAssignment) {
            try { db.model('SalaryAssignment', require('../models/SalaryAssignment')); } catch (e) { }
        }
        if (!db.models.SalaryTemplate) {
            try { db.model('SalaryTemplate', require('../models/SalaryTemplate')); } catch (e) { }
        }
        if (!db.models.AuditLog) {
            try { db.model('AuditLog', require('../models/AuditLog')); } catch (e) { }
        }
        if (!db.models.User) {
            try { db.model('User', require('../models/User')); } catch (e) { }
        }
        if (!db.models.Approval) {
            try { db.model('Approval', require('../models/Approval')); } catch (e) { }
        }
        if (!db.models.ApprovalWorkflow) {
            try { db.model('ApprovalWorkflow', require('../models/ApprovalWorkflow')); } catch (e) { }
        }
        if (!db.models.ApprovalLog) {
            try { db.model('ApprovalLog', require('../models/ApprovalLog')); } catch (e) { }
        }

        return {
            GeneratedLetter: db.model("GeneratedLetter"),
            LetterTemplate: db.model("LetterTemplate"),
            Applicant: db.model("Applicant"),
            Candidate: db.model("Candidate"),
            Employee: db.model("Employee"),
            CompanyProfile: db.model("CompanyProfile"),
            LetterApproval: db.model("LetterApproval"),
            LetterRevocation: db.model("LetterRevocation"),
            EmployeeSalarySnapshot: db.model("EmployeeSalarySnapshot"),
            SalaryAssignment: db.model("SalaryAssignment"),
            SalaryTemplate: db.model("SalaryTemplate"),
            SignedLetter: db.model("SignedLetter"),
            BGVCase: db.model("BGVCase"),
            Notification: db.model("Notification"),
            AuditLog: db.models.AuditLog ? db.model("AuditLog") : null,
            User: db.model("User"),
            Approval: db.model("Approval"),
            ApprovalWorkflow: db.model("ApprovalWorkflow"),
            ApprovalLog: db.model("ApprovalLog")
        };
    } catch (err) {
        console.error("[letter.controller] Error retrieving models:", err);
        throw new Error(`Failed to retrieve models from tenant database: ${err.message}`);
    }
}

async function resolveOfferApprovalChainForApplicant({ tenantDB, tenantId, applicantId, requesterEmployeeId = null }) {
    const { resolveApprovers } = require('../services/approverResolver.service');
    const { ensureDefaultWorkflow } = require('../services/workflowDefinition.service');
    const Applicant = tenantDB.model('Applicant');
    const Employee = tenantDB.model('Employee');
    const User = mongoose.models.User || mongoose.model('User');

    const applicant = await Applicant.findById(applicantId).populate('requirementId').lean();
    if (!applicant) {
        const error = new Error('Applicant not found');
        error.statusCode = 404;
        throw error;
    }

    const match = await ensureDefaultWorkflow({
        tenantDB,
        tenantId,
        moduleKey: 'recruitment',
        entityType: 'GeneratedLetter',
    });

    const steps = match?.version?.definition?.steps || [
        {
            key: 'department_head',
            name: 'Department Head',
            order: 1,
            approver: { type: 'DEPARTMENT_HEAD', value: null },
            fallbackApprover: { type: 'HR_HEAD', value: 'hr_head' },
        },
        {
            key: 'ceo',
            name: 'CEO',
            order: 2,
            approver: { type: 'CEO', value: null },
            fallbackApprover: { type: 'ROLE', value: 'admin' },
        },
    ];

    const settings = match?.version?.definition?.settings || { allowRequesterApproval: true };

    const contextSnapshot = {
        applicantId: String(applicant._id),
        tenantId: String(tenantId),
        letterType: 'offer',
        candidateName: applicant.name,
        jobTitle: applicant.requirementId?.jobTitle || 'Role',
        workflowSettings: settings,
    };

    const chain = [];
    for (const step of steps) {
        const approverIds = await resolveApprovers({
            tenantDB,
            requesterEmployeeId,
            step,
            contextSnapshot,
        });

        if (!approverIds.length) {
            chain.push({
                key: step.key,
                label: step.name,
                order: step.order,
                missing: true,
                message: `${step.name} is not configured in Organization.`,
            });
            continue;
        }

        const employee = await Employee.findById(approverIds[0])
            .select('_id firstName lastName name email role employeeCode employeeId')
            .lean();
        let user = null;
        if (employee?.email) {
            user = await User.findOne({
                email: { $regex: new RegExp(`^${String(employee.email).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
                $or: [{ mainCompanyId: tenantId }, { tenantId }, { companyId: tenantId }],
            }).select('_id name email role').lean();
        }

        chain.push({
            key: step.key,
            label: step.name,
            order: step.order,
            employeeId: employee?._id || approverIds[0],
            userId: user?._id || null,
            name: employee?.name || `${employee?.firstName || ''} ${employee?.lastName || ''}`.trim() || user?.name || employee?.email || 'Approver',
            email: employee?.email || user?.email || '',
            role: employee?.role || user?.role || '',
            missing: !employee,
        });
    }

    return {
        applicant: {
            id: applicant._id,
            name: applicant.name,
            email: applicant.email,
            jobTitle: applicant.requirementId?.jobTitle || 'Role',
            department: applicant.requirementId?.department || applicant.department || '',
        },
        chain,
        complete: chain.every((item) => !item.missing && (item.employeeId || item.userId || item.email)),
    };
}

async function actionPendingOfferWorkflow({ tenantDB, tenantId, letter, action, comment = '', req = null }) {
    const normalizedAction = String(action || '').toUpperCase() === 'REJECTED' ? 'REJECTED' : 'APPROVED';
    const workflowEngine = {
        activateNextStep: require('../services/workflowStart.service').activateNextStep,
        finalizeWorkflowEntity: require('../services/workflowAdapter.service').finalizeWorkflowEntity,
        writeHistory: require('../services/workflowRuntimeCore.service').writeHistory,
    };
    const WorkflowInstance = tenantDB.model('WorkflowInstance');
    const WorkflowAssignment = tenantDB.model('WorkflowAssignment');
    const WorkflowVersion = tenantDB.model('WorkflowVersion');

    const instance = await WorkflowInstance.findOne({
        tenantId,
        entityType: 'GeneratedLetter',
        entityId: letter._id,
        status: 'PENDING',
        ...(letter.workflowInstanceId ? { _id: letter.workflowInstanceId } : {}),
    });
    if (!instance) return { handled: false };

    const assignment = await WorkflowAssignment.findOne({
        tenantId,
        instanceId: instance._id,
        status: 'PENDING',
    }).sort({ stepOrder: 1, createdAt: 1 });
    if (!assignment) return { handled: false };

    assignment.status = normalizedAction;
    assignment.actionByEmployeeId = assignment.assigneeEmployeeId || null;
    assignment.actionByUserId = assignment.assigneeUserId || null;
    assignment.actionAt = new Date();
    assignment.comment = comment;
    await assignment.save();

    await workflowEngine.writeHistory({
        tenantDB,
        tenantId,
        instance,
        action: normalizedAction,
        actorEmployeeId: assignment.assigneeEmployeeId || null,
        actorUserId: assignment.assigneeUserId || null,
        stepKey: assignment.stepKey,
        comment,
        req,
    });

    if (normalizedAction === 'REJECTED') {
        await WorkflowAssignment.updateMany(
            { tenantId, instanceId: instance._id, status: 'PENDING' },
            { $set: { status: 'CANCELLED' } }
        );
        const fromStatus = instance.status;
        instance.status = 'REJECTED';
        instance.completedAt = new Date();
        await instance.save();
        await workflowEngine.writeHistory({
            tenantDB,
            tenantId,
            instance,
            action: 'REJECTED',
            actorEmployeeId: assignment.assigneeEmployeeId || null,
            actorUserId: assignment.assigneeUserId || null,
            fromStatus,
            toStatus: 'REJECTED',
            comment,
            req,
        });
        await workflowEngine.finalizeWorkflowEntity({
            tenantDB,
            tenantId,
            moduleKey: instance.moduleKey,
            entityType: instance.entityType,
            entityId: instance.entityId,
            status: 'REJECTED',
            actorEmployeeId: assignment.assigneeEmployeeId || null,
            actorUserId: assignment.assigneeUserId || null,
            comment,
        });
        return { handled: true, completed: true, status: 'REJECTED' };
    }

    await WorkflowAssignment.updateMany(
        { tenantId, instanceId: instance._id, stepKey: assignment.stepKey, status: 'PENDING' },
        { $set: { status: 'SKIPPED' } }
    );

    const version = await WorkflowVersion.findById(instance.workflowVersionId).lean();
    const activation = await workflowEngine.activateNextStep({
        tenantDB,
        tenantId,
        instance,
        version,
        afterOrder: assignment.stepOrder,
        req,
    });
    if (activation.assigned) {
        return {
            handled: true,
            completed: false,
            status: 'PENDING',
            nextStepName: activation.step?.name || activation.step?.key || 'next approver',
        };
    }

    const fromStatus = instance.status;
    instance.status = 'APPROVED';
    instance.completedAt = new Date();
    await instance.save();
    await workflowEngine.writeHistory({
        tenantDB,
        tenantId,
        instance,
        action: 'APPROVED',
        actorEmployeeId: assignment.assigneeEmployeeId || null,
        actorUserId: assignment.assigneeUserId || null,
        fromStatus,
        toStatus: 'APPROVED',
        comment,
        req,
    });
    await workflowEngine.finalizeWorkflowEntity({
        tenantDB,
        tenantId,
        moduleKey: instance.moduleKey,
        entityType: instance.entityType,
        entityId: instance.entityId,
        status: 'APPROVED',
        actorEmployeeId: assignment.assigneeEmployeeId || null,
        actorUserId: assignment.assigneeUserId || null,
        comment,
    });

    return { handled: true, completed: true, status: 'APPROVED' };
}
// Helper to get correct Applicant model (for backward compatibility)
function getApplicantModel(req) {
    if (req.tenantDB) {
        return req.tenantDB.model("Applicant");
    } else {
        return mongoose.model("Applicant");
    }
}

function formatCustomDate(date, format = 'Do MMM. YYYY') {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';

    const day = d.getDate();
    const monthIndex = d.getMonth();
    const year = d.getFullYear();

    // Helpers
    const pad = (n) => n < 10 ? '0' + n : n;
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthsLong = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // Ordinal Suffix logic
    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    else if (day % 10 === 2 && day !== 12) suffix = 'nd';
    else if (day % 10 === 3 && day !== 13) suffix = 'rd';

    // Switch based on requested format
    switch (format) {
        case 'DD/MM/YYYY':
            return `${pad(day)}/${pad(monthIndex + 1)}/${year}`;
        case 'YYYY-MM-DD':
            return `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
        case 'Do MMMM YYYY':
            return `${day}${suffix} ${monthsLong[monthIndex]} ${year}`;
        case 'Do MMM. YYYY':
        default:
            return `${day}${suffix} ${monthsShort[monthIndex]}. ${year}`;
    }
}

// Helper to format currency safe
const safeCur = (val) => {
    if (val === undefined || val === null || isNaN(val)) return '0';
    return Math.round(val).toLocaleString('en-IN');
};

// Helper to format date safe
const safeDate = (d) => {
    if (!d) return '';
    const timestamp = Date.parse(d);
    if (isNaN(timestamp)) return '';
    return new Date(timestamp).toLocaleDateString('en-IN');
};

// =========================================================================
// A) UNIVERSAL SALARY KEY NORMALIZER (STABLE FOREVER)
// =========================================================================
const normalizeSalaryKey = (name) => {
    if (!name) return 'unknown';
    const n = name.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, '_')   // spaces/dashes to underscores
        .replace(/^_+|_+$/g, '');      // trim underscores

    if (/gross_a|gross_earnings/i.test(n)) return 'gross_a';
    if (/gross_b|annual_benefits|benefit_b/i.test(n)) return 'gross_b';
    if (/gross_c|retirals|benefit_c/i.test(n)) return 'gross_c';
    if (/gross_salary|gross/i.test(n)) return 'gross';
    if (/ctc|total_ctc|cost_to_company/i.test(n)) return 'total_ctc';
    if (/net|take_home/i.test(n)) return 'net_salary';
    if (/basic/i.test(n)) return 'basic';
    if (/hra|house|rent/i.test(n)) return 'hra';
    if (/medical|health/i.test(n)) return 'medical';
    if (/conveyance|travel/i.test(n)) return 'conveyance';
    if (/transport/i.test(n)) return 'transport';
    if (/education/i.test(n)) return 'education';
    if (/book|periodical/i.test(n)) return 'books';
    if (/uniform/i.test(n)) return 'uniform';
    if (/mobile|phone/i.test(n)) return 'mobile';
    if (/compensatory/i.test(n)) return 'compensatory';
    if (/leave/i.test(n)) return 'leave';
    if (/special|allowance/i.test(n)) return 'special';
    if (/pt|prof|tax/i.test(n)) return 'pt';
    if (/^pf$|provident/i.test(n) && !/employer/i.test(n)) return 'pf';
    if (/employer_pf|employer_contribution_to_pf/i.test(n)) return 'employer_pf';
    if (/gratuity/i.test(n)) return 'gratuity';
    if (/insur/i.test(n)) return 'insurance';

    return n;
};

// =========================================================================
// B) UNIVERSAL SAFE PATCH ENGINE (PREVENTS BLANK FIELDS)
// =========================================================================
const applyUniversalSalaryPatches = (data, snapshot, totals) => {
    let patched = { ...data };

    // 1. Normalized Global Keys (e.g., {{basic}}, {{hra}}, {{pf}})
    if (snapshot) {
        const allComponents = [
            ...(snapshot.earnings || []),
            ...(snapshot.employeeDeductions || snapshot.deductions || []),
            ...(snapshot.benefits || [])
        ];

        allComponents.forEach(comp => {
            const canonical = normalizeSalaryKey(comp.name);
            const m = comp.monthlyAmount || comp.monthly || 0;
            const y = comp.yearlyAmount || comp.yearly || (m * 12) || 0;

            patched[`${canonical}_monthly`] = safeCur(m);
            patched[`${canonical}_yearly`] = safeCur(y);
            patched[`${canonical}_annual`] = safeCur(y);

            // Hardcoded specific match for "Basic Salary"
            if (canonical === 'basic') {
                patched['basic_salary_monthly'] = safeCur(m);
                patched['basic_salary_yearly'] = safeCur(y);
            }
        });
    }

    // 2. Totals Hardening
    if (totals) {
        const tMap = {
            gross_a: totals.grossA,
            gross_b: totals.grossB,
            gross_c: totals.grossC,
            ctc: totals.computedCTC || totals.totalCTC || totals.ctc,
            net_salary: totals.netSalary || totals.net
        };

        Object.entries(tMap).forEach(([key, val]) => {
            if (val) {
                patched[`${key}_monthly`] = val.formattedM || safeCur(val.monthly);
                patched[`${key}_yearly`] = val.formattedY || safeCur(val.yearly);
                patched[`${key}_annual`] = val.formattedY || safeCur(val.yearly);
            }
        });
    }

    // 3. Support for ALL DOCX placeholder variants (Case-Insensitive, Space vs Underscore)
    const expanded = { ...patched };
    Object.keys(patched).forEach(key => {
        const val = patched[key];
        if (typeof val !== 'string' && typeof val !== 'number') return;

        expanded[key.toUpperCase()] = val;
        expanded[key.toLowerCase()] = val;

        const spaced = key.replace(/_/g, ' ');
        expanded[spaced] = val;
        expanded[spaced.toUpperCase()] = val;

        const underscored = key.replace(/ /g, '_');
        expanded[underscored] = val;
        expanded[underscored.toUpperCase()] = val;
    });

    return expanded;
};

const toMoneyNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const amountPair = (component = {}) => {
    const monthly = toMoneyNumber(component.monthlyAmount ?? component.monthly ?? component.amount);
    const yearly = toMoneyNumber(component.yearlyAmount ?? component.annualAmount ?? component.yearly ?? component.annual ?? (monthly * 12));
    return { monthly, yearly: yearly || monthly * 12 };
};

const addSalaryAlias = (salary, key, monthly, yearly) => {
    const normalized = normalizeSalaryKey(key);
    const m = safeCur(monthly);
    const y = safeCur(yearly);
    const keys = new Set([
        normalized,
        String(key || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    ]);

    keys.forEach((alias) => {
        if (!alias) return;
        salary[alias] = { monthly: m, yearly: y, annual: y };
    });
};

const buildSalaryTemplatePayload = (snapshot = {}, totals = {}) => {
    const salary = {};
    const earnings = snapshot.earnings || [];
    const employeeDeductions = snapshot.employeeDeductions || snapshot.deductions || [];
    const benefits = snapshot.benefits || [];

    [...earnings, ...employeeDeductions, ...benefits].forEach((component) => {
        const { monthly, yearly } = amountPair(component);
        addSalaryAlias(salary, component.name || component.code, monthly, yearly);
    });

    const sumYearly = (items) => items.reduce((sum, item) => sum + amountPair(item).yearly, 0);
    const earningsYearly = toMoneyNumber(snapshot.summary?.grossEarnings || snapshot.breakdown?.totalEarnings || sumYearly(earnings));
    const deductionsYearly = toMoneyNumber(snapshot.summary?.totalDeductions || snapshot.breakdown?.totalDeductions || sumYearly(employeeDeductions));

    const benefitYearlyBy = (pattern) => benefits
        .filter((item) => pattern.test(`${item.name || ''} ${item.code || ''}`))
        .reduce((sum, item) => sum + amountPair(item).yearly, 0);

    const employerPfYearly = benefitYearlyBy(/pf|provident/i);
    const employerEsicYearly = benefitYearlyBy(/esic|esi|state\s*insurance/i);
    const gratuityYearly = benefitYearlyBy(/gratuity/i);
    const paPolicyYearly = benefitYearlyBy(/pa\s*policy|personal\s*accident|insurance|mediclaim|medical\s*insurance/i);
    const totalAYearly = earningsYearly + employerPfYearly + employerEsicYearly;
    const totalBYearly = gratuityYearly;
    const totalCYearly = paPolicyYearly;
    const totalCTCYearly = toMoneyNumber(snapshot.ctc || snapshot.annualCTC || totals.computedCTC?.yearly || (totalAYearly + totalBYearly + totalCYearly));
    const takeHomeYearly = toMoneyNumber(snapshot.summary?.netPay || snapshot.breakdown?.netPay || totals.net?.yearly || (earningsYearly - deductionsYearly));

    const setTotal = (key, yearly) => addSalaryAlias(salary, key, yearly / 12, yearly);
    setTotal('gross', earningsYearly);
    setTotal('gross_salary', earningsYearly);
    setTotal('total_a', totalAYearly);
    setTotal('take_home', takeHomeYearly);
    setTotal('take_home_salary', takeHomeYearly);
    setTotal('total_b', totalBYearly);
    setTotal('total_c', totalCYearly);
    setTotal('total_ctc', totalCTCYearly);
    setTotal('ctc', totalCTCYearly);

    addSalaryAlias(salary, 'pf_employer', employerPfYearly / 12, employerPfYearly);
    addSalaryAlias(salary, 'esic_employer', employerEsicYearly / 12, employerEsicYearly);
    addSalaryAlias(salary, 'gratuity', gratuityYearly / 12, gratuityYearly);
    addSalaryAlias(salary, 'pa_policy', paPolicyYearly / 12, paPolicyYearly);

    employeeDeductions.forEach((component) => {
        const text = `${component.name || ''} ${component.code || ''}`;
        const { monthly, yearly } = amountPair(component);
        if (/pf|provident/i.test(text)) addSalaryAlias(salary, 'pf_employee', monthly, yearly);
        if (/esic|esi|state\s*insurance/i.test(text)) addSalaryAlias(salary, 'esic_employee', monthly, yearly);
        if (/professional|prof|pt|tax/i.test(text)) addSalaryAlias(salary, 'professional_tax', monthly, yearly);
    });

    [
        'minimum_wage', 'basic', 'hra', 'conveyance', 'compensatory_allowance', 'bonus',
        'pf_employer', 'esic_employer', 'pf_employee', 'esic_employee',
        'professional_tax', 'gratuity', 'pa_policy', 'gross', 'gross_salary',
        'total_a', 'take_home', 'take_home_salary', 'total_b', 'total_c', 'total_ctc'
    ].forEach((key) => {
        if (!salary[key]) salary[key] = { monthly: '0', yearly: '0', annual: '0' };
    });

    return {
        salary,
        salary_flat: Object.fromEntries(
            Object.entries(salary).flatMap(([key, value]) => [
                [`salary_${key}_monthly`, value.monthly],
                [`salary_${key}_yearly`, value.yearly],
                [`salary_${key}_annual`, value.annual || value.yearly]
            ])
        )
    };
};

const normalizeAssignmentComponent = (item = {}) => ({
    code: item.code || item.componentCode || '',
    name: item.name || item.componentName || item.code || item.componentCode || 'Component',
    monthlyAmount: toMoneyNumber(item.monthlyAmount ?? item.monthly),
    yearlyAmount: toMoneyNumber(item.yearlyAmount ?? item.annualAmount ?? item.yearly ?? item.annual)
});

const buildSnapshotFromSalaryAssignment = (assignment) => {
    if (!assignment) return null;
    const plain = assignment.toObject ? assignment.toObject() : assignment;
    const template = plain.salaryTemplateId && typeof plain.salaryTemplateId === 'object' ? plain.salaryTemplateId : {};
    const sourceEarnings = plain.earnings?.length ? plain.earnings : (template.earnings || []);
    const sourceDeductions = plain.deductions?.length ? plain.deductions : (template.employeeDeductions || []);
    const sourceBenefits = plain.benefits?.length ? plain.benefits : (template.employerDeductions || []);

    const earnings = sourceEarnings.map(normalizeAssignmentComponent);
    const employeeDeductions = sourceDeductions.map(normalizeAssignmentComponent);
    const benefits = sourceBenefits.map(normalizeAssignmentComponent);
    const totalEarnings = earnings.reduce((sum, item) => sum + amountPair(item).yearly, 0);
    const totalDeductions = employeeDeductions.reduce((sum, item) => sum + amountPair(item).yearly, 0);
    const totalBenefits = benefits.reduce((sum, item) => sum + amountPair(item).yearly, 0);
    const ctc = toMoneyNumber(plain.ctcAnnual || template.annualCTC || (totalEarnings + totalBenefits));

    return {
        _id: plain._id,
        employee: plain.employeeId,
        applicant: plain.applicantId,
        tenant: plain.tenantId,
        ctc,
        monthlyCTC: toMoneyNumber(plain.monthlyCTC || template.monthlyCTC || ctc / 12),
        earnings,
        employeeDeductions,
        benefits,
        breakdown: {
            totalEarnings,
            totalDeductions,
            totalBenefits,
            netPay: totalEarnings - totalDeductions
        },
        summary: {
            grossEarnings: totalEarnings,
            totalDeductions,
            totalBenefits,
            netPay: totalEarnings - totalDeductions
        },
        effectiveFrom: plain.effectiveFrom,
        locked: plain.isConfirmed === true
    };
};

async function resolveLetterSalarySnapshot(req, { employeeId, applicantId, target, targetType }) {
    const { EmployeeSalarySnapshot, SalaryAssignment } = getModels(req);
    const query = employeeId ? { employee: employeeId } : { applicant: applicantId };
    let snapshot = await EmployeeSalarySnapshot.findOne(query).sort({ createdAt: -1 }).lean();

    if (!snapshot && target) {
        const snapId = target.currentSalarySnapshotId || target.salarySnapshotId;
        if (snapId) snapshot = await EmployeeSalarySnapshot.findById(snapId).lean();
        if (!snapshot && targetType === 'employee' && target.salarySnapshots?.length > 0) {
            snapshot = await EmployeeSalarySnapshot.findById(target.salarySnapshots[target.salarySnapshots.length - 1]).lean();
        }
    }

    if (snapshot) return snapshot;

    // 🔄 Fallback: if applicant/employee target document has salarySnapshot directly
    if (target && target.salarySnapshot) {
        const snapObj = target.salarySnapshot.toObject ? target.salarySnapshot.toObject() : target.salarySnapshot;
        if (snapObj.totals || snapObj.earnings || snapObj.annualCTC || snapObj.ctc) {
            // Helper to clean and cast money values
            const toMoneyVal = (v) => {
                const n = Number(v);
                return Number.isFinite(n) ? n : 0;
            };
            const normComp = (item) => ({
                code: item.key || item.code || '',
                name: item.label || item.name || 'Component',
                monthlyAmount: toMoneyVal(item.monthly ?? item.monthlyAmount),
                yearlyAmount: toMoneyVal(item.yearly ?? item.yearlyAmount ?? item.annualAmount ?? ((item.monthly ?? item.monthlyAmount ?? 0) * 12))
            });

            const earnings = (snapObj.earnings || []).map(normComp);
            const employeeDeductions = (snapObj.deductions || snapObj.employeeDeductions || []).map(normComp);
            const benefits = (snapObj.employerBenefits || snapObj.benefits || []).map(normComp);

            const grossEarnings = toMoneyVal(snapObj.totals?.grossEarnings || earnings.reduce((sum, item) => sum + item.yearlyAmount, 0));
            const totalDeductions = toMoneyVal(snapObj.totals?.totalDeductions || employeeDeductions.reduce((sum, item) => sum + item.yearlyAmount, 0));
            const totalBenefits = toMoneyVal(snapObj.totals?.employerBenefits || benefits.reduce((sum, item) => sum + item.yearlyAmount, 0));
            const ctc = toMoneyVal(snapObj.totals?.annualCTC || snapObj.ctc || snapObj.annualCTC || (grossEarnings + totalBenefits));
            const netPay = toMoneyVal(snapObj.totals?.netSalary || snapObj.totals?.netPay || (grossEarnings - totalDeductions));

            return {
                _id: snapObj._id || target._id,
                applicant: applicantId,
                employee: employeeId,
                tenant: target.tenant || req.user?.tenantId || req.tenantId,
                ctc,
                monthlyCTC: toMoneyVal(snapObj.totals?.monthlyCTC || ctc / 12),
                earnings,
                employeeDeductions,
                benefits,
                breakdown: {
                    totalEarnings: grossEarnings,
                    totalDeductions,
                    totalBenefits,
                    netPay
                },
                summary: {
                    grossEarnings,
                    totalDeductions,
                    totalBenefits,
                    netPay
                },
                updatedAt: snapObj.calculatedAt || snapObj.generatedAt || target.updatedAt || new Date()
            };
        }
    }

    const assignmentQuery = {
        tenantId: req.user?.tenantId || req.tenantId,
        ...(employeeId ? { employeeId } : { applicantId }),
        isCurrent: { $ne: false }
    };
    const assignment = await SalaryAssignment.findOne(assignmentQuery)
        .populate('salaryTemplateId')
        .sort({ effectiveFrom: -1, createdAt: -1 })
        .lean();

    return buildSnapshotFromSalaryAssignment(assignment);
}

const getFirstValue = (...values) => {
    for (const value of values) {
        if (value === undefined || value === null) continue;
        const str = String(value).trim();
        if (str) return str;
    }
    return '';
};

function getNestedRenderValue(source = {}, pathKey = '') {
    if (!pathKey || !String(pathKey).includes('.')) return '';
    return String(pathKey)
        .split('.')
        .reduce((current, part) => (current && current[part] !== undefined ? current[part] : undefined), source);
}

function collectGeneratedVariableReport(placeholders = [], data = {}) {
    const generatedVariables = {};
    const missingVariables = [];

    sanitizePlaceholderList(placeholders).forEach((placeholder) => {
        const normalized = normalizeVariableKey(placeholder);
        const resolved = getFirstValue(
            getNestedRenderValue(data, placeholder),
            data[placeholder],
            data[normalized],
            data[normalized.toUpperCase()],
            data[normalized.replace(/_/g, ' ')],
            data[normalized.replace(/_/g, ' ').toUpperCase()]
        );

        // Replace dots with underscores so Mongoose can save the Map without crashing
        const safeKey = placeholder.replace(/\./g, '_');
        generatedVariables[safeKey] = resolved;

        if (!resolved && normalized !== 'signature' && normalized !== 'candidate_signature') {
            missingVariables.push(placeholder);
        }
    });

    return { generatedVariables, missingVariables };
}

const formatAddressObject = (address) => {
    if (!address || typeof address !== 'object' || Array.isArray(address)) return '';
    return [
        address.line1,
        address.line2,
        address.city,
        address.state,
        address.pinCode,
        address.country
    ].filter(Boolean).join(', ');
};

const inferCandidateTitle = ({ salutation, gender, maritalStatus, customData = {} }) => {
    const manual = getFirstValue(salutation, customData.candidate_title, customData.candidateTitle, customData.title);
    if (manual) return manual;
    const normalizedGender = String(gender || '').trim().toLowerCase();
    const normalizedMaritalStatus = String(maritalStatus || '').trim().toLowerCase();
    if (normalizedGender === 'male' || normalizedGender === 'm') return 'Mr.';
    if (normalizedGender === 'female' || normalizedGender === 'f') {
        return ['married', 'm'].includes(normalizedMaritalStatus) ? 'Mrs.' : 'Ms.';
    }
    return '';
};

function getConfiguredTemplatePlaceholders(template = {}) {
    const placeholders = sanitizePlaceholderList(
        template.placeholders?.length ? template.placeholders : template.detectedVariables || []
    );
    const customFieldKeys = getExplicitCustomFieldKeys(template);

    if (!customFieldKeys.length) {
        return placeholders;
    }

    const configured = new Set(customFieldKeys);
    return placeholders.filter((placeholder) => configured.has(normalizeVariableKey(placeholder)));
}

function getExplicitCustomFieldKeys(template = {}) {
    const fields = Array.isArray(template.customFields) ? template.customFields : [];
    return fields
        .map((field) => normalizeVariableKey(field?.key || field?.name || field?.label))
        .filter(Boolean);
}

function getCandidateProfileValue(source, keys = []) {
    for (const key of keys) {
        const parts = String(key).split('.');
        let value = source;
        for (const part of parts) {
            value = value?.[part];
            if (value === undefined || value === null) break;
        }
        const resolved = getFirstValue(value);
        if (resolved) return resolved;
    }
    return '';
}

function splitCandidateName(value = '') {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length <= 1) {
        return { first: parts[0] || '', middle: '', last: '' };
    }
    return {
        first: parts[0],
        middle: parts.slice(1, -1).join(' '),
        last: parts[parts.length - 1]
    };
}

function templateUsesSeparateSurname(template = {}) {
    const placeholders = sanitizePlaceholderList(
        template.placeholders?.length ? template.placeholders : template.detectedVariables || []
    );
    return placeholders.some((placeholder) => {
        const key = normalizeVariableKey(placeholder);
        return key.includes('surname') || key.includes('last_name') || key.includes('lastname');
    });
}

function buildFullAddress(profile = {}, fallbackAddress = '') {
    const direct = getFirstValue(fallbackAddress, profile.full_address, profile.fullAddress, profile.address, profile.candidate_address, profile.candidateAddress);
    const city = getCandidateProfileValue(profile, ['city', 'tempAddress.city', 'permAddress.city', 'permanentAddress.city', 'currentAddress.city']);
    const state = getCandidateProfileValue(profile, ['state', 'tempAddress.state', 'permAddress.state', 'permanentAddress.state', 'currentAddress.state']);
    const pincode = getCandidateProfileValue(profile, ['pincode_no', 'pincode', 'pinCode', 'tempAddress.pincode', 'tempAddress.pinCode', 'permAddress.pincode', 'permAddress.pinCode', 'permanentAddress.pincode', 'currentAddress.pincode']);

    if (!direct && !city && !state && !pincode) return '';

    const addressAndCity = [direct, city, state].filter(Boolean).join(', ');
    return pincode ? `${addressAndCity} - ${pincode}`.trim() : addressAndCity;
}

function buildEnterpriseLetterData({
    template = {},
    baseData = {},
    target = {},
    customData = {},
    issueDate,
    dateFormat,
    refNo
}) {
    const profile = target?.toObject ? target.toObject() : (target || {});
    const profileFullName = getFirstValue(
        profile.full_name,
        profile.fullName,
        profile.name
    );
    const customFullName = getFirstValue(
        customData.full_name,
        customData.candidate_full_name,
        customData.candidate_name
    );
    const rawFullName = getFirstValue(profileFullName, customFullName);
    const nameParts = splitCandidateName(rawFullName);
    const firstName = getFirstValue(customData.first_name, profile.first_name, profile.firstName, nameParts.first);
    const middleName = getFirstValue(customData.middle_name, profile.middle_name, profile.middleName, nameParts.middle);
    const lastName = getFirstValue(profile.last_name, profile.lastName, profile.surname, nameParts.last);
    const fullName = getFirstValue(rawFullName, [firstName, middleName, lastName].filter(Boolean).join(' '));
    const candidateNameValue = templateUsesSeparateSurname(template)
        ? (getFirstValue(customData.first_name, [firstName, middleName].filter(Boolean).join(' ')) || fullName)
        : fullName;
    const gender = getFirstValue(profile.gender, customData.gender);
    const maritalStatus = getFirstValue(profile.marital_status, profile.maritalStatus, customData.marital_status);
    const candidateTitle = inferCandidateTitle({
        salutation: profile.salutation || customData.salutation,
        gender,
        maritalStatus,
        customData
    });
    const relationCategory = getFirstValue(
        profile.relation_category,
        profile.relationCategory,
        profile.relationType,
        customData.relation_category,
        customData.relation_type
    );
    const relationType = normalizeRelationType(relationCategory);
    const fatherName = getFirstValue(profile.father_name, profile.fatherName, customData.father_name, baseData.father_name);
    const motherName = getFirstValue(profile.mother_name, profile.motherName, customData.mother_name);
    const spouseName = getFirstValue(profile.spouse_name, profile.spouseName, customData.spouse_name);
    const phone = getFirstValue(
        profile.phone,
        profile.phone_no,
        profile.mobile,
        pickCandidateContact(profile),
        customData.phone,
        customData.phone_no,
        customData.phon_no,
        baseData.phone_no,
        baseData.phon_no,
        baseData.mobile
    );
    const email = getFirstValue(profile.email, customData.email, customData.candidate_email, baseData.email);
    const address = buildFullAddress(profile, getFirstValue(customData.candidate_address, customData.address, baseData.candidate_address, baseData.address));
    const city = getCandidateProfileValue(profile, ['city', 'tempAddress.city', 'permAddress.city', 'permanentAddress.city', 'currentAddress.city']);
    const state = getCandidateProfileValue(profile, ['state', 'tempAddress.state', 'permAddress.state', 'permanentAddress.state', 'currentAddress.state']);
    const pincode = getCandidateProfileValue(profile, ['pincode_no', 'pincode', 'pinCode', 'tempAddress.pincode', 'tempAddress.pinCode', 'permAddress.pincode', 'permAddress.pinCode', 'permanentAddress.pincode', 'currentAddress.pincode']);
    const designation = getFirstValue(profile.designation, profile.currentDesignation, profile.requirementId?.jobTitle, customData.designation, customData.desingnation, baseData.designation, baseData.desingnation);
    const location = getFirstValue(profile.office_location, profile.location, profile.workLocation, customData.candidate_location, customData.location, baseData.location);
    const department = getFirstValue(profile.department, profile.requirementId?.department?.name, profile.requirementId?.department, customData.department, baseData.department);
    const joiningDate = getFirstValue(baseData.joining_date, customData.joining_date, formatCustomDate(profile.joining_date || profile.joiningDate, dateFormat));
    const resolvedIssueDate = getFirstValue(
        customData.issue_date,
        baseData.issue_date,
        issueDate ? new Date(issueDate).toLocaleDateString('en-IN') : formatCustomDate(profile.issue_date || profile.issueDate || new Date(), dateFormat)
    );
    const salary = getFirstValue(profile.salary, profile.ctc, profile.annualCTC, baseData.annual_ctc);
    const probationPeriod = getFirstValue(profile.probation_period, profile.probationPeriod, profile.requirementId?.probationPeriod, customData.probation_period, baseData.probation_period);
    const employeeCode = getFirstValue(profile.employee_code, profile.employeeCode, profile.empCode, profile.employeeId, customData.employee_code);
    const surname = getFirstValue(lastName, customData.candidate_surname, customData.surname);
    const nameWithTitle = `${candidateTitle ? candidateTitle + ' ' : ''}${fullName}`.trim();
    const relationAndFather = fatherName ? `${relationType} ${fatherName}` : '';

    const enterpriseData = {
        first_name: firstName,
        middle_name: middleName,
        last_name: lastName,
        surname,
        candidate_name: candidateNameValue,
        candidate_surname: surname,
        candidate_last_name: surname,
        employee_name: fullName,
        applicant_name: fullName,
        name: fullName,
        full_name: fullName,
        candidate_title: candidateTitle,
        title: candidateTitle,
        name_with_title: nameWithTitle,
        candidate_name_with_title: nameWithTitle,
        relation_type: relationType,
        relationship_type: relationType,
        relationship: relationType,
        father_name: fatherName,
        mother_name: motherName,
        spouse_name: spouseName,
        relation_father_name: relationAndFather,
        father_name_with_relation: relationAndFather,
        candidate_email: email,
        email,
        phone,
        phon_no: phone,
        phone_no: phone,
        mobile: phone,
        mobile_number: phone,
        contact_no: phone,
        candidate_address: address,
        full_address: address,
        address,
        city,
        state,
        pincode,
        pincode_no: pincode,
        joining_date: joiningDate,
        issue_date: resolvedIssueDate,
        issued_date: resolvedIssueDate,
        current_date: resolvedIssueDate,
        today: resolvedIssueDate,
        date: resolvedIssueDate,
        designation,
        desingnation: designation,
        department,
        employee_code: employeeCode,
        location,
        office_location: location,
        candidate_location: location,
        salary,
        probation_period: probationPeriod,
        probation: probationPeriod,
        relation_category: relationCategory,
        gender,
        marital_status: maritalStatus,
        ref_no: refNo || baseData.ref_no || '',
        reference_no: refNo || baseData.reference_no || baseData.ref_no || ''
    };

    const merged = {
        ...baseData,
        ...enterpriseData,
        ...expandCustomData(customData)
    };
    if (baseData.salary && typeof baseData.salary === 'object') {
        merged.salary = baseData.salary;
    }

    const hasSeparateSurname = templateUsesSeparateSurname(template);
    if (hasSeparateSurname && String(merged.candidate_surname || '').trim() === fullName && surname) {
        merged.candidate_surname = surname;
        merged.CANDIDATE_SURNAME = surname;
        merged['candidate surname'] = surname;
        merged['CANDIDATE SURNAME'] = surname;
    }
    if (hasSeparateSurname && String(merged.candidate_name || '').trim() === fullName && candidateNameValue) {
        merged.candidate_name = candidateNameValue;
        merged.CANDIDATE_NAME = candidateNameValue;
        merged['candidate name'] = candidateNameValue;
        merged['CANDIDATE NAME'] = candidateNameValue;
    }
    if (!getFirstValue(merged.candidate_title, merged.CANDIDATE_TITLE, merged.title) && candidateTitle) {
        merged.candidate_title = candidateTitle;
        merged.CANDIDATE_TITLE = candidateTitle;
        merged.title = candidateTitle;
        merged.TITLE = candidateTitle;
    }
    if (!getFirstValue(merged.phon_no, merged.PHON_NO, merged.phone_no, merged.PHONE_NO) && phone) {
        merged.phon_no = phone;
        merged.PHON_NO = phone;
        merged.phone_no = phone;
        merged.PHONE_NO = phone;
    }
    if (!getFirstValue(merged.desingnation, merged.DESINGNATION, merged.designation, merged.DESIGNATION) && designation) {
        merged.desingnation = designation;
        merged.DESINGNATION = designation;
        merged.designation = designation;
        merged.DESIGNATION = designation;
    }

    return materializeTemplateRenderData(template, merged);
}

function materializeTemplateRenderData(template = {}, data = {}) {
    const allPlaceholders = sanitizePlaceholderList(
        template.placeholders?.length ? template.placeholders : template.detectedVariables || []
    );
    const processPlaceholders = new Set(getConfiguredTemplatePlaceholders(template).map((item) => normalizeVariableKey(item)));
    const restrictToCustomSetup = getExplicitCustomFieldKeys(template).length > 0;
    const renderData = { ...data };

    Object.entries(data || {}).forEach(([key, value]) => {
        const normalized = normalizeVariableKey(key);
        if (!normalized) return;
        renderData[normalized] = value ?? '';
        renderData[normalized.toUpperCase()] = value ?? '';
        renderData[normalized.replace(/_/g, ' ')] = value ?? '';
        renderData[normalized.replace(/_/g, ' ').toUpperCase()] = value ?? '';
    });

    allPlaceholders.forEach((placeholder) => {
        const normalized = normalizeVariableKey(placeholder);
        const shouldProcess = !restrictToCustomSetup || processPlaceholders.has(normalized);
        const resolved = shouldProcess
            ? getFirstValue(
                getNestedRenderValue(data, placeholder),
                data[placeholder],
                data[normalized],
                data[normalized.toUpperCase()],
                data[normalized.replace(/_/g, ' ')],
                data[normalized.replace(/_/g, ' ').toUpperCase()]
            )
            : '';

        renderData[placeholder] = resolved;
        renderData[normalized] = resolved;
        renderData[normalized.toUpperCase()] = resolved;
        renderData[normalized.replace(/_/g, ' ')] = resolved;
        renderData[normalized.replace(/_/g, ' ').toUpperCase()] = resolved;
    });

    return renderData;
}

function resolveByAlias(key, values) {
    const normalized = normalizeVariableKey(key);
    if (!normalized) return '';

    if (Object.prototype.hasOwnProperty.call(values.customExact, normalized)) {
        const customValue = values.customExact[normalized];
        if (customValue !== undefined && customValue !== null && String(customValue).trim() !== '') {
            return customValue;
        }
    }

    const aliasGroups = [
        { test: /^(candidate|applicant|employee)?_?name$|^applicant_name$|^employee_name$/, value: values.candidateName },
        { test: /^(candidate|applicant|employee)?_?(surname|last_name)$/, value: values.candidateSurname },
        { test: /^(candidate|applicant|employee)?_?first_name$/, value: values.candidateFirstName },
        { test: /^full_name$|^candidate_full_name$|^name_with_title$|^candidate_name_with_title$/, value: values.fullName },
        { test: /^dear(_name|name)?$|^first_name$/, value: values.dearName },
        { test: /^candidate_title$|^candidate_salutation$|^salutation$|^title$/, value: values.candidateTitle },
        { test: /^father_?name$|^father_names$|^parent_name$/, value: values.fatherName },
        { test: /^relation_?type$|^relationship_type$|^relationship$/, value: values.relationType },
        { test: /^relation(_and)?_father(_name)?$|^father_name_with_relation$|^parent_details$/, value: values.relationAndFather },
        { test: /^candidate_?email$|^applicant_?email$|^email(_address)?$/, value: values.email },
        { test: /^candidate_?(phone|mobile|contact)(_no|_number|_num)?$|^phone(_no|_number)?$|^mobile(_no|_number)?$|^contact(_no|_number)?$/, value: values.phone },
        { test: /^candidate_?address$|^address$|^current_address$|^permanent_address$/, value: values.address },
        { test: /^designation$|^job_title$|^position$|^role$/, value: values.designation },
        { test: /^department$/, value: values.department },
        { test: /^location$|^work_location$|^job_location$/, value: values.location },
        { test: /^joining_?date$|^date_of_joining$|^doj$/, value: values.joiningDate },
        { test: /^issue_?date$|^issued_?date$|^current_date$|^today$|^date$|^date_odt$/, value: values.issueDate },
        { test: /^offer_expiry_date$|^expiry(_date|_at)?$|^valid_till$/, value: values.offerExpiryDate },
        { test: /^probation$|^probation_period$|^probationperiod$/, value: values.probation },
        { test: /^ref_?no$|^offer_ref_no$|^reference(_no|_number)?$|^ref$|^ref_code$/, value: values.refNo },
        { test: /^gender$/, value: values.gender },
        { test: /^date_of_birth$|^dob$|^birth_date$/, value: values.dateOfBirth },
        { test: /^grade$/, value: values.grade },
        { test: /^grade_name$/, value: values.gradeName },
        { test: /^grade_code$/, value: values.gradeCode },
        { test: /^grade_level$/, value: values.gradeLevel },
        { test: /^signature$|^candidate_signature$/, value: '{{SIGNATURE}}' }
    ];

    const match = aliasGroups.find((group) => group.test.test(normalized));
    return match ? match.value : '';
}

function buildOfferVariablePayload({
    placeholders = [],
    applicant,
    candidate,
    employee,
    applicantGrade = {},
    formData = {},
    customData = {},
    dateFormat,
    salarySnapshot,
    salaryTotals
}) {
    const safeString = (val) => (val !== undefined && val !== null ? String(val) : '');
    const rawName = getFirstValue(formData.name, applicant?.name, candidate?.name, [
        employee?.firstName,
        employee?.middleName,
        employee?.lastName
    ].filter(Boolean).join(' '));

    const nameParts = splitCandidateName(rawName);
    const candidateFirstName = nameParts.first;
    const candidateMiddleName = nameParts.middle;
    const candidateSurname = nameParts.last;

    const hasSeparateSurname = placeholders.some(p => {
        const key = normalizeVariableKey(p);
        return key.includes('surname') || key.includes('last_name') || key.includes('lastname');
    });

    const candidateNameValue = hasSeparateSurname 
        ? [candidateFirstName, candidateMiddleName].filter(Boolean).join(' ') || rawName 
        : rawName;
    const gender = getFirstValue(applicant?.gender, candidate?.gender, candidate?.metadata?.gender, employee?.gender);
    const maritalStatus = getFirstValue(applicant?.maritalStatus, applicant?.marital_status, candidate?.maritalStatus, candidate?.metadata?.maritalStatus, employee?.maritalStatus, employee?.marital_status, customData.marital_status);
    const candidateTitle = inferCandidateTitle({ salutation: formData.salutation || applicant?.salutation, gender, maritalStatus, customData });
    const hasTitle = candidateTitle && rawName.toLowerCase().startsWith(candidateTitle.toLowerCase().replace(/\.$/, ''));
    const fullName = hasTitle ? rawName : `${candidateTitle ? candidateTitle + ' ' : ''}${rawName}`.trim();
    const fatherName = getFirstValue(formData.fatherName, applicant?.fatherName, candidate?.fatherName, employee?.fatherName);
    const relationType = normalizeRelationType(formData.relationType || applicant?.relationType || customData.relation_type);
    const issueDate = formatCustomDate(formData.issueDate || new Date(), dateFormat);
    const joiningDate = formatCustomDate(formData.joiningDate || applicant?.joiningDate || employee?.joiningDate, dateFormat);
    const offerExpiryDate = formData.expiryAt ? formatCustomDate(formData.expiryAt, dateFormat) : '';

    const customExact = {};
    Object.entries(customData || {}).forEach(([rawKey, rawValue]) => {
        const key = normalizeVariableKey(rawKey);
        if (key) customExact[key] = rawValue === undefined || rawValue === null ? '' : String(rawValue);
    });

    const values = {
        customExact,
        candidateName: candidateNameValue,
        candidateSurname,
        candidateFirstName,
        fullName,
        dearName: getFirstValue(formData.dearName, rawName.split(' ')[0], rawName),
        candidateTitle,
        fatherName,
        relationType,
        relationAndFather: fatherName ? `${relationType} ${fatherName}` : '',
        email: getFirstValue(applicant?.email, candidate?.email, employee?.email, customData.email, customData.candidate_email),
        phone: getFirstValue(pickCandidateContact(applicant), candidate?.mobile, employee?.contactNo, customData.mobile, customData.phone, customData.contact_no),
        address: getFirstValue(formData.address, applicant?.address, candidate?.address, formatAddressObject(employee?.commAddress), formatAddressObject(employee?.permAddress)),
        designation: getFirstValue(applicant?.requirementId?.jobTitle, applicant?.currentDesignation, employee?.designation, formData.designation, customData.designation),
        department: getFirstValue(formData.department, applicant?.department, applicant?.requirementId?.department?.name, employee?.department),
        location: getFirstValue(formData.location, applicant?.location, applicant?.workLocation, employee?.location, employee?.state),
        joiningDate,
        issueDate,
        offerExpiryDate,
        probation: getFirstValue(formData.probationPeriod, applicant?.probationPeriod, applicant?.requirementId?.probationPeriod, customData.probation, customData.probation_period, '3 months'),
        refNo: getFirstValue(formData.refNo, applicant?.offerRefCode),
        gender,
        maritalStatus,
        dateOfBirth: formatCustomDate(applicant?.dob || candidate?.dob || employee?.dob, dateFormat),
        grade: getFirstValue(applicantGrade.name),
        gradeName: getFirstValue(applicantGrade.name),
        gradeCode: getFirstValue(applicantGrade.code),
        gradeLevel: getFirstValue(applicantGrade.level)
    };

    const baseData = {
        ...expandCustomData(customData),
        employee_name: rawName,
        candidate_name: candidateNameValue,
        candidate_first_name: candidateFirstName,
        candidate_surname: candidateSurname,
        candidate_last_name: candidateSurname,
        applicant_name: rawName,
        name: rawName,
        full_name: fullName,
        candidate_name_with_title: fullName,
        dear_name: values.dearName,
        candidate_title: candidateTitle,
        title: candidateTitle,
        father_name: fatherName,
        father_names: fatherName,
        relation_type: relationType,
        relationship_type: relationType,
        relationship: relationType,
        relation_father_name: values.relationAndFather,
        father_name_with_relation: values.relationAndFather,
        candidate_email: values.email,
        email: values.email,
        candidate_phone_no: values.phone,
        candidate_phone: values.phone,
        phone_no: values.phone,
        phone: values.phone,
        mobile_number: values.phone,
        mobile: values.phone,
        contact_no: values.phone,
        candidate_address: values.address,
        address: values.address,
        designation: values.designation,
        job_title: values.designation,
        position: values.designation,
        department: values.department,
        location: values.location,
        work_location: values.location,
        joining_date: joiningDate,
        issue_date: issueDate,
        issued_date: issueDate,
        current_date: issueDate,
        today: issueDate,
        date: issueDate,
        offer_expiry_date: offerExpiryDate,
        probation: values.probation,
        probation_period: values.probation,
        ref_no: values.refNo,
        offer_ref_no: values.refNo,
        reference_no: values.refNo,
        reference_number: values.refNo,
        ref: values.refNo,
        gender: values.gender,
        marital_status: values.maritalStatus,
        date_of_birth: values.dateOfBirth,
        dob: values.dateOfBirth,
        grade: values.grade,
        grade_name: values.gradeName,
        grade_code: values.gradeCode,
        grade_level: values.gradeLevel,
        signature: '{{SIGNATURE}}',
        candidate_signature: '{{SIGNATURE}}',
        SIGNATURE: '{{SIGNATURE}}'
    };

    const salaryPatched = applyUniversalSalaryPatches(baseData, salarySnapshot, salaryTotals);
    const renderData = { ...salaryPatched };
    const generatedVariables = {};
    const missingVariables = [];

    sanitizePlaceholderList(placeholders).forEach((placeholder) => {
        const normalized = normalizeVariableKey(placeholder);
        const resolved = getFirstValue(
            salaryPatched[placeholder],
            salaryPatched[normalized],
            resolveByAlias(placeholder, values)
        );

        renderData[placeholder] = resolved;
        renderData[normalized] = resolved;
        generatedVariables[placeholder] = resolved;
        if (!resolved && normalized !== 'signature' && normalized !== 'candidate_signature') {
            missingVariables.push(placeholder);
        }
    });

    return { renderData, generatedVariables, missingVariables };
}

function normalizeFilePath(filePath) {
    if (!filePath) return null;

    const normalizedSystemPath = path.normalize(filePath);
    const fileName = path.basename(filePath);

    // 1. Try resolving relative to backend/uploads/templates (Highest priority for Word templates)
    const templatePath = path.resolve(process.cwd(), 'uploads/templates', fileName);
    if (fs.existsSync(templatePath)) return templatePath;

    // 2. Try resolving relative to backend/uploads
    const uploadsPath = path.resolve(process.cwd(), 'uploads', fileName);
    if (fs.existsSync(uploadsPath)) return uploadsPath;

    // 3. Try as absolute if it exists on THIS system
    if (path.isAbsolute(normalizedSystemPath) && fs.existsSync(normalizedSystemPath)) {
        return normalizedSystemPath;
    }

    // 4. Fallback: try to find it in the current workspace structure
    const fallbackPath = path.join(process.cwd(), 'uploads', 'templates', fileName);

    console.warn(`[PATH_RESOLVER] File not found. Tried: ${templatePath}, ${uploadsPath}, ${normalizedSystemPath}. Returning best guess: ${fallbackPath}`);
    return fallbackPath;
}

// Configure multer for Word template upload (supports both offer and joining)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Use consistent templates directory for both offer and joining templates
        const dest = path.join(__dirname, '../uploads/templates');
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
            // // console.log(`✅ [MULTER] Created templates directory: ${dest}`);
        }
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.docx';
        // Get type from body (offer or joining) - default to 'template' if not specified
        const letterType = (req.body && req.body.type) ? req.body.type : 'template';
        const timestamp = Date.now();
        const name = `${letterType}-template-${timestamp}${ext}`;
        // // console.log(`📁 [MULTER] Generated filename: ${name} for type: ${letterType}`);
        cb(null, name);
    }
});

const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        if (ext === '.docx') {
            cb(null, true);
        } else {
            cb(new Error('Only .docx files are allowed'));
        }
    }
});

/** 
 * COMPANY PROFILE 
 */
exports.getCompanyProfile = async (req, res) => {
    try {
        const { CompanyProfile } = getModels(req);
        const profile = await CompanyProfile.findOne({ tenantId: req.user.tenantId });
        res.json(profile || { _isNew: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateCompanyProfile = async (req, res) => {
    try {
        const { CompanyProfile } = getModels(req);
        const { companyName, address, contactEmail, signatory, branding } = req.body;
        let profile = await CompanyProfile.findOne({ tenantId: req.user.tenantId });

        if (!profile) {
            profile = new CompanyProfile({ tenantId: req.user.tenantId });
        }

        if (companyName) profile.companyName = companyName;
        if (address) profile.address = address;
        if (contactEmail) profile.contactEmail = contactEmail;
        if (signatory) profile.signatory = signatory;
        if (branding) profile.branding = branding;

        await profile.save();
        res.json(profile);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/** 
 * TEMPLATES MANAGEMENT
 */

exports.getTemplates = async (req, res) => {
    try {
        const { type } = req.query;
        const query = { isActive: true };
        if (req.user?.tenantId) {
            query.tenantId = req.user.tenantId;
        }

        // Strict Type Filtering
        if (type) {
            query.type = type; // 'offer' or 'joining'
        }

        const { LetterTemplate } = getModels(req);
        const templates = await LetterTemplate.find(query).sort('-createdAt');

        // Transform response based on type
        const responseData = await Promise.all(templates.map(async (template) => {
            const base = {
                _id: template._id,
                name: template.name,
                type: template.type,
                isDefault: template.isDefault,
                createdAt: template.createdAt
            };

            let resolvedPlaceholders = sanitizePlaceholderList(template.placeholders || []);
            if (template.templateType === 'WORD' && resolvedPlaceholders.length === 0 && template.filePath) {
                const normalizedPath = normalizeFilePath(template.filePath);
                if (normalizedPath && fs.existsSync(normalizedPath)) {
                    resolvedPlaceholders = await extractPlaceholders(normalizedPath);
                }
            }

            if (template.templateType === 'WORD') {
                // Word templates (both offer and joining)
                return {
                    ...base,
                    filePath: template.filePath,
                    placeholders: resolvedPlaceholders,
                    detectedVariables: resolvedPlaceholders,
                    customFields: sanitizeCustomFields(template.customFields || [], resolvedPlaceholders),
                    status: template.status,
                    version: template.version,
                    templateType: 'WORD'
                };
            } else if (template.type === 'offer') {
                // HTML-based offer templates
                return {
                    ...base,
                    bodyContent: template.bodyContent,
                    headerContent: template.headerContent,
                    footerContent: template.footerContent,
                    headerHeight: template.headerHeight,
                    footerHeight: template.footerHeight,
                    hasHeader: template.hasHeader,
                    hasFooter: template.hasFooter,
                    placeholders: resolvedPlaceholders,
                    detectedVariables: resolvedPlaceholders,
                    customFields: sanitizeCustomFields(template.customFields || [], resolvedPlaceholders),
                    templateType: template.templateType // 'BLANK' or 'LETTER_PAD'
                };
            } else if (template.type === 'joining') {
                // Legacy joining templates (should be Word, but keeping for compatibility)
                return {
                    ...base,
                    filePath: template.filePath,
                    placeholders: resolvedPlaceholders,
                    detectedVariables: resolvedPlaceholders,
                    customFields: sanitizeCustomFields(template.customFields || [], resolvedPlaceholders),
                    status: template.status,
                    version: template.version,
                    templateType: 'WORD'
                };
            }
            else if (template.templateType === 'BUILDER') {
                return {
                    ...base,
                    builderConfig: template.builderConfig,
                    templateType: 'BUILDER'
                };
            }
            return base;
        }));

        res.json(responseData);
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.status(500).json({ error: 'Failed to fetch templates' });
    }
};

exports.createTemplate = async (req, res) => {
    // Mostly for Offer Letters (HTML based)
    try {
        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        const { name, type, bodyContent, headerContent, footerContent, headerHeight, footerHeight, hasHeader, hasFooter, templateType, isDefault, builderConfig, customFields } = req.body;

        if (isDefault) {
            await LetterTemplate.updateMany(
                { tenantId: req.user.tenantId, type, isDefault: true },
                { isDefault: false }
            );
        }

        const template = new LetterTemplate({
            tenantId: req.user.tenantId,
            name,
            type: type || 'offer',
            bodyContent, headerContent, footerContent,
            headerHeight, footerHeight, hasHeader, hasFooter,
            templateType: templateType || 'BLANK',
            builderConfig,
            customFields: sanitizeCustomFields(customFields || [], []),
            isDefault,
            createdBy: req.user.userId
        });

        await template.save();
        res.status(201).json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        const template = await LetterTemplate.findOne({ _id: req.params.id, tenantId: req.user.tenantId });
        if (!template) return res.status(404).json({ message: 'Template not found' });

        // basic update logic...
        Object.assign(template, req.body);

        if (req.body.isDefault) {
            await LetterTemplate.updateMany(
                { tenantId: req.user.tenantId, type: template.type, isDefault: true, _id: { $ne: template._id } },
                { isDefault: false }
            );
        }

        await template.save();
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};;

exports.getTemplateById = async (req, res) => {
    try {
        const { id } = req.params;

        // Log request for debugging
        // // console.log(`🔍 [GET TEMPLATE BY ID] Request for ID: ${id}`);
        // // console.log(`🔍 [GET TEMPLATE BY ID] User:`, req.user ? { userId: req.user.userId, role: req.user.role, tenantId: req.user.tenantId } : 'null');
        // // console.log(`🔍 [GET TEMPLATE BY ID] TenantDB:`, req.tenantDB ? 'available' : 'not available');

        // Validate ID format
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            console.error(`🔍 [GET TEMPLATE BY ID] Invalid ID format: ${id}`);
            return res.status(400).json({ message: 'Invalid template ID format' });
        }

        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        // Build query - handle missing req.user gracefully
        const query = { _id: id };
        if (req.user?.tenantId) {
            query.tenantId = req.user.tenantId;
            // // console.log(`🔍 [GET TEMPLATE BY ID] Filtering by tenantId: ${req.user.tenantId}`);
        } else {
            console.warn(`🔍 [GET TEMPLATE BY ID] No tenantId in request, searching without tenant filter`);
        }

        // Find template
        const template = await LetterTemplate.findOne(query);

        if (!template) {
            console.error(`🔍 [GET TEMPLATE BY ID] Template not found for ID: ${id}`);
            return res.status(404).json({ message: 'Template not found' });
        }

        // // console.log(`🔍 [GET TEMPLATE BY ID] Template found:`, {
        //     id: template._id,
        //     name: template.name,
        //     type: template.type,
        //     templateType: template.templateType,
        //     hasFilePath: !!template.filePath
        // });

        // Transform response for safety and proper handling
        const responseData = {
            _id: template._id,
            name: template.name,
            type: template.type,
            templateType: template.templateType,
            isDefault: template.isDefault,
            isActive: template.isActive,
            createdAt: template.createdAt,
            updatedAt: template.updatedAt
        };

        // Handle WORD templates - validate filePath exists
        if (template.templateType === 'WORD') {
            responseData.templateType = 'WORD';
            responseData.placeholders = sanitizePlaceholderList(template.placeholders || []);
            responseData.customFields = sanitizeCustomFields(template.customFields || [], responseData.placeholders);
            responseData.version = template.version;
            responseData.status = template.status;

            // Check if filePath exists and file is accessible
            if (template.filePath) {
                try {
                    // Normalize file path before checking
                    const normalizedPath = normalizeFilePath(template.filePath);
                    const fileExists = fs.existsSync(normalizedPath);
                    if (fileExists) {
                        if (responseData.placeholders.length === 0) {
                            responseData.placeholders = await extractPlaceholders(normalizedPath);
                        }
                        responseData.customFields = sanitizeCustomFields(template.customFields || [], responseData.placeholders);
                        // Return normalized filePath for WORD templates (needed for preview)
                        responseData.filePath = normalizedPath;
                        responseData.hasFile = true;
                        // // console.log(`✅ [GET TEMPLATE BY ID] File exists at: ${normalizedPath}`);
                    } else {
                        console.error(`❌ [GET TEMPLATE BY ID] File NOT FOUND at path: ${normalizedPath}`);
                        console.error(`❌ [GET TEMPLATE BY ID] Original path from DB: ${template.filePath}`);
                        responseData.hasFile = false;
                        responseData.filePath = null;
                        responseData.fileError = 'Template file not found on server. Please re-upload the template.';
                        responseData.code = 'FILE_NOT_FOUND';
                    }
                } catch (fsError) {
                    console.error(`❌ [GET TEMPLATE BY ID] Error checking file: ${fsError.message}`);
                    console.error(`❌ [GET TEMPLATE BY ID] Stack:`, fsError.stack);
                    responseData.hasFile = false;
                    responseData.filePath = null;
                    responseData.fileError = 'Error accessing template file: ' + fsError.message;
                    responseData.code = 'FILE_ACCESS_ERROR';
                }
            } else {
                console.warn(`⚠️ [GET TEMPLATE BY ID] WORD template missing filePath in database`);
                responseData.hasFile = false;
                responseData.filePath = null;
                responseData.fileError = 'Template file path not set in database. Please re-upload the template.';
                responseData.code = 'FILE_PATH_MISSING';
            }
        } else if (template.templateType === 'BUILDER') {
            responseData.builderConfig = template.builderConfig;
        } else {
            // HTML-based templates (BLANK, LETTER_PAD)
            responseData.bodyContent = template.bodyContent;
            responseData.headerContent = template.headerContent;
            responseData.footerContent = template.footerContent;
            responseData.headerHeight = template.headerHeight;
            responseData.footerHeight = template.footerHeight;
            responseData.hasHeader = template.hasHeader;
            responseData.hasFooter = template.hasFooter;
            responseData.placeholders = sanitizePlaceholderList(template.placeholders || []);
            responseData.customFields = sanitizeCustomFields(template.customFields || [], responseData.placeholders);
        }

        res.json(responseData);
    } catch (error) {
        console.error(`❌ [GET TEMPLATE BY ID] Error:`, error);
        console.error(`❌ [GET TEMPLATE BY ID] Stack:`, error.stack);

        // Ensure we always return a response
        if (!res.headersSent) {
            res.status(500).json({
                message: 'Failed to fetch template',
                error: error.message
            });
        }
    }
};

/**
 * DELETE TEMPLATE
 * - Remove file from disk
 * - Remove from DB
 */
exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const userTenantId = req.user.tenantId;

        // // console.log(`🔥 [DELETE TEMPLATE] Request for ID: ${id}`);
        // // console.log(`🔥 [DELETE TEMPLATE] User:`, { userId: req.user.userId, role: req.user.role, tenantId: userTenantId });

        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        // 1. Find by ID only first
        const template = await LetterTemplate.findById(id);

        if (!template) {
            // // console.log("🔥 [DELETE TEMPLATE] Template not found by ID.");
            return res.status(404).json({ message: "Template not found (Invalid ID)" });
        }

        // // console.log(`🔥 [DELETE TEMPLATE] Template found:`, { templateId: template._id, templateTenantId: template.tenantId, templateName: template.name });

        // 2. Security Check
        // Allow delete if:
        // - Tenant IDs match
        // - OR Template has NO tenantId (Corrupt record cleanup)
        // - OR User has admin role (can delete any template)

        const isOwner = template.tenantId && template.tenantId.toString() === userTenantId.toString();
        const isCorrupt = !template.tenantId; // If tenantId is missing, allow cleanup
        const isAdmin = req.user.role === 'admin'; // Admin can delete any template

        // // console.log(`🔥 [DELETE TEMPLATE] Ownership check:`, { isOwner, isCorrupt, isAdmin, templateTenant: template.tenantId, userTenant: userTenantId, userRole: req.user.role });

        if (!isOwner && !isCorrupt && !isAdmin) {
            // // console.log(`🔥 [DELETE TEMPLATE] Security Block. Template Tenant: ${template.tenantId}, User Tenant: ${userTenantId}, User Role: ${req.user.role}`);
            return res.status(403).json({
                message: "You do not have permission to delete this template.",
                reason: "Template belongs to a different tenant. Only admins can delete templates from other tenants."
            });
        }

        // 3. Delete File if exists (use normalized path)
        if (template.filePath) {
            try {
                const normalizedPath = normalizeFilePath(template.filePath);
                if (fs.existsSync(normalizedPath)) {
                    fs.unlinkSync(normalizedPath);
                    // // console.log(`✅ [DELETE TEMPLATE] Deleted template file: ${normalizedPath}`);
                } else {
                    console.warn(`⚠️ [DELETE TEMPLATE] File not found at path: ${normalizedPath} (continuing with DB deletion)`);
                }
            } catch (err) {
                console.error("❌ [DELETE TEMPLATE] Error deleting template file:", err);
                // Continue to delete DB record even if file delete fails
            }
        }

        // 4. Delete DB Record
        await LetterTemplate.findByIdAndDelete(id);

        res.status(200).json({ success: true, message: "Template deleted successfully" });
    } catch (error) {
        console.error("Delete template error:", error);
        res.status(500).json({ message: "Failed to delete template", error: error.message });
    }
};

/**
 * UPLOAD WORD TEMPLATE (Offer & Joining Letters)
 * - Uses Multer
 * - Extracts Placeholders
 * - Saves Metadata
 * - NO PDF GENERATION HERE
 */
exports.uploadWordTemplate = [
    upload.single('wordFile'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No Word file uploaded' });
            }

            // Get tenant-specific model
            const { LetterTemplate } = getModels(req);

            // Normalize file path to ensure it's absolute and consistent
            const normalizedPath = normalizeFilePath(req.file.path);
            // // console.log(`📁 [UPLOAD TEMPLATE] Original path: ${req.file.path}`);
            // // console.log(`📁 [UPLOAD TEMPLATE] Normalized path: ${normalizedPath}`);

            // Verify file exists after normalization
            if (!fs.existsSync(normalizedPath)) {
                console.error(`❌ [UPLOAD TEMPLATE] File not found at normalized path: ${normalizedPath}`);
                return res.status(500).json({ success: false, message: 'Uploaded file not found on server' });
            }

            const syntaxCheck = await validateWordTemplateSyntax(normalizedPath);
            if (!syntaxCheck.valid) {
                try {
                    await fsPromises.unlink(normalizedPath);
                } catch (cleanupError) {
                    console.warn(`⚠️ [UPLOAD TEMPLATE] Failed to remove invalid template file: ${cleanupError.message}`);
                }

                return res.status(400).json({
                    success: false,
                    message: syntaxCheck.message,
                    code: 'INVALID_TEMPLATE_SYNTAX',
                    details: syntaxCheck.details
                });
            }

            // Extract placeholders
            const placeholders = await extractPlaceholders(normalizedPath);
            const customFields = sanitizeCustomFields(req.body.customFields || [], placeholders);

            // Validate tenantId is present
            if (!req.user?.tenantId) {
                console.error('❌ [UPLOAD TEMPLATE] Missing tenantId in request');
                return res.status(400).json({
                    success: false,
                    message: 'User authentication or tenant information missing. Please log in again.'
                });
            }

            // Support both offer and joining letter types
            const letterType = req.body.type || 'joining'; // Default to joining for backward compatibility
            const templateName = req.body.name || `${letterType === 'offer' ? 'Offer' : 'Joining'} Template ${Date.now()}`;

            const template = new LetterTemplate({
                tenantId: req.user.tenantId, // Ensure tenantId is set (not optional)
                name: templateName,
                type: letterType, // 'offer' or 'joining'
                templateType: 'WORD',
                filePath: normalizedPath, // Store normalized absolute path
                version: req.body.version || 'v1.0',
                status: req.body.status || 'Active',
                placeholders,
                detectedVariables: placeholders,
                customFields,
                isDefault: req.body.isDefault === 'true' || false,
                isActive: true
            });

            try {
                await template.save();
                // // console.log(`✅ [UPLOAD TEMPLATE] Template saved: ${template._id}, filePath: ${normalizedPath}`);
            } catch (saveError) {
                // Handle duplicate key error from old MongoDB index - AUTO FIX
                if (saveError.code === 11000 && (saveError.message.includes('tenant_1_letterType_1_templateName_1') || saveError.message.includes('tenant') && saveError.message.includes('letterType'))) {
                    console.warn('⚠️ [UPLOAD TEMPLATE] Old MongoDB index detected. Attempting to auto-fix...');

                    try {
                        // Get the collection and drop the old index
                        const collection = req.tenantDB.collection('lettertemplates');
                        const indexes = await collection.indexes();

                        // Find and drop the problematic index
                        for (const idx of indexes) {
                            if (idx.name === 'tenant_1_letterType_1_templateName_1' ||
                                (idx.key && idx.key.tenant && idx.key.letterType && idx.key.templateName)) {
                                // // console.log(`🗑️ [UPLOAD TEMPLATE] Dropping old index: ${idx.name}`);
                                await collection.dropIndex(idx.name);
                                // // console.log(`✅ [UPLOAD TEMPLATE] Old index dropped successfully`);

                                // Retry saving the template
                                await template.save();
                                // // console.log(`✅ [UPLOAD TEMPLATE] Template saved after index fix: ${template._id}`);

                                // Return success response
                                return res.status(200).json({
                                    success: true,
                                    message: `${letterType === 'offer' ? 'Offer' : 'Joining'} letter template uploaded successfully`,
                                    templateId: template._id,
                                    placeholders,
                                    detectedVariables: placeholders,
                                    customFields,
                                    note: 'Old database index was automatically removed'
                                });
                            }
                        }

                        // If index not found but error persists, throw original error
                        throw saveError;
                    } catch (fixError) {
                        // If auto-fix fails, return helpful error
                        return res.status(500).json({
                            success: false,
                            message: 'Database index error. Please contact administrator.',
                            code: 'INDEX_ERROR',
                            error: fixError.message
                        });
                    }
                }
                throw saveError; // Re-throw if not the expected error
            }

            res.status(200).json({
                success: true,
                message: `${letterType === 'offer' ? 'Offer' : 'Joining'} letter template uploaded successfully`,
                templateId: template._id,
                placeholders,
                detectedVariables: placeholders,
                customFields
            });
        } catch (error) {
            console.error('❌ [UPLOAD TEMPLATE] Error:', error);
            console.error('❌ [UPLOAD TEMPLATE] Stack:', error.stack);
            // Cleanup on error
            if (req.file && fs.existsSync(req.file.path)) {
                try {
                    fs.unlinkSync(req.file.path);
                    // // console.log(`🧹[UPLOAD TEMPLATE] Cleaned up file: ${req.file.path} `);
                } catch (e) {
                    console.error('⚠️ [UPLOAD TEMPLATE] Failed to cleanup file:', e.message);
                }
            }
            res.status(500).json({ success: false, message: error.message });
        }
    }
];

/**
 * PREVIEW WORD TEMPLATE AS PDF (Synchronous via LibreOffice)
 */
exports.previewWordTemplatePDF = async (req, res) => {
    try {
        const { templateId } = req.params;

        // // console.log(`🔍[PREVIEW WORD TEMPLATE PDF] Request for templateId: ${templateId} `);

        // Validate ID format
        if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
            console.error(`🔍[PREVIEW WORD TEMPLATE PDF] Invalid templateId format: ${templateId} `);
            return res.status(400).json({ message: "Invalid template ID format" });
        }

        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        // Build query with tenant filtering if available
        const query = { _id: templateId };
        if (req.user?.tenantId) {
            query.tenantId = req.user.tenantId;
        }

        const template = await LetterTemplate.findOne(query);

        if (!template) {
            console.error(`🔍[PREVIEW WORD TEMPLATE PDF] Template not found for ID: ${templateId} `);
            return res.status(404).json({ message: "Template not found" });
        }

        // Validate template type
        if (template.templateType !== 'WORD') {
            console.error(`🔍[PREVIEW WORD TEMPLATE PDF] Template is not a WORD template: ${template.templateType} `);
            return res.status(400).json({ message: "Template is not a WORD template. Preview is only available for WORD templates." });
        }

        // Validate filePath exists
        if (!template.filePath) {
            console.error(`🔍[PREVIEW WORD TEMPLATE PDF] Template filePath is missing`);
            return res.status(400).json({ message: "Template file path not set. Please re-upload the template." });
        }

        // Normalize and validate file path
        const normalizedFilePath = normalizeFilePath(template.filePath);
        // // console.log(`🔍[PREVIEW WORD TEMPLATE PDF] Original path: ${template.filePath} `);
        // // console.log(`🔍[PREVIEW WORD TEMPLATE PDF] Normalized path: ${normalizedFilePath} `);

        // Check if file exists
        if (!fs.existsSync(normalizedFilePath)) {
            console.error(`❌[PREVIEW WORD TEMPLATE PDF] Template file NOT FOUND at path: ${normalizedFilePath} `);
            console.error(`❌[PREVIEW WORD TEMPLATE PDF] Original path from DB: ${template.filePath} `);
            return res.status(404).json({
                message: "Template file not found on server. Please re-upload the template.",
                code: "FILE_NOT_FOUND"
            });
        }

        const templateDir = path.dirname(normalizedFilePath);
        const templateBaseName = path.basename(normalizedFilePath, '.docx');
        let pdfPath = path.join(templateDir, `${templateBaseName}.pdf`);

        // For joining letters, create a preview with sample data
        if (template.type === 'joining') {
            // Create a temporary DOCX with sample data replaced
            const content = await fsPromises.readFile(normalizedFilePath);
            let zip, doc;
            try {
                zip = new PizZip(content);
                doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                    nullGetter: function (tag) { return ''; },
                    delimiters: { start: '{{', end: '}}' }
                });
            } catch (error) {
                console.error('Template load failed:', error);
                return res.status(400).json({ message: "Template load failed", error: error.message });
            }

            // Sample data for preview
            const sampleData = {
                employee_name: 'John Doe',
                father_name: 'Mr. Doe Sr.',
                designation: 'Software Engineer',
                department: 'IT Department',
                joining_date: new Date().toLocaleDateString('en-IN'),
                location: 'Mumbai, India',
                candidate_address: '123 Sample Street, Mumbai - 400001',
                offer_ref_code: 'OFFER/2024/001',
                current_date: new Date().toLocaleDateString('en-IN')
            };

            try {
                doc.render(sampleData);
            } catch (renderError) {
                console.error('Preview render failed:', renderError);
                // Continue with original template if render fails
            }

            // Generate temporary DOCX
            const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
            const tempDocxPath = path.join(templateDir, `${templateBaseName}_preview.docx`);
            await fsPromises.writeFile(tempDocxPath, buf);

            // Update pdfPath to use the preview version
            pdfPath = path.join(templateDir, `${templateBaseName}_preview.pdf`);

            // Convert the preview DOCX to PDF
            try {
                // // console.log('🔄 [PREVIEW] Converting preview template to PDF (Mammoth + Puppeteer)...');
                const libreOfficeService = require('../services/LibreOfficeService');
                const generatedPdfPath = await libreOfficeService.convertToPdf(tempDocxPath, templateDir);
                pdfPath = generatedPdfPath; // Use the actual returned path
                // // console.log(`✅ [PREVIEW] PDF generated at: ${pdfPath}`);
            } catch (err) {
                console.error('⚠️ [PREVIEW] Preview conversion failed:', err.message);
                // Fallback to original PDF if it exists
                pdfPath = path.join(templateDir, `${templateBaseName}.pdf`);
                if (!fs.existsSync(pdfPath)) {
                    return res.status(500).json({ message: "PDF preview generation failed", error: err.message });
                }
            }
        } else {
            // For non-joining templates, use original logic
            // Check/Convert
            try {
                // Check if PDF exists and is newer than DOCX
                let needsConversion = true;
                if (fs.existsSync(pdfPath)) {
                    const docxStats = fs.statSync(normalizedFilePath);
                    const pdfStats = fs.statSync(pdfPath);
                    if (pdfStats.mtime >= docxStats.mtime) {
                        needsConversion = false;
                    }
                }

                if (needsConversion) {
                    // // console.log('🔄 [PREVIEW] Converting template to PDF (Mammoth + Puppeteer)...');
                    const libreOfficeService = require('../services/LibreOfficeService');
                    const generatedPdfPath = await libreOfficeService.convertToPdf(normalizedFilePath, templateDir);
                    pdfPath = generatedPdfPath; // Use the actual returned path
                    // // console.log(`✅ [PREVIEW] PDF generated at: ${pdfPath}`);
                }
            } catch (err) {
                console.error('⚠️ [PREVIEW] Conversion failed:', err.message);
                // If PDF exists (even if old), try to serve it, otherwise error
                if (!fs.existsSync(pdfPath)) {
                    return res.status(500).json({ message: "PDF preview generation failed", error: err.message });
                }
            }
        }

        // Verify PDF exists before serving
        if (!fs.existsSync(pdfPath)) {
            console.error(`🔍[PREVIEW WORD TEMPLATE PDF] Generated PDF not found at: ${pdfPath}`);
            return res.status(500).json({ message: "PDF preview generation failed. The PDF file was not created." });
        }

        // Serve PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename = "${templateBaseName}.pdf"`);
        const pdfStream = fs.createReadStream(pdfPath);

        // Handle stream errors
        pdfStream.on('error', (streamError) => {
            console.error(`❌[PREVIEW WORD TEMPLATE PDF] Stream error: `, streamError);
            if (!res.headersSent) {
                res.status(500).json({ message: "Error reading PDF file", error: streamError.message });
            }
        });

        pdfStream.pipe(res);

    } catch (error) {
        console.error('❌ [PREVIEW WORD TEMPLATE PDF] Error:', error);
        console.error('❌ [PREVIEW WORD TEMPLATE PDF] Stack:', error.stack);
        if (!res.headersSent) {
            res.status(500).json({ message: "Failed to generate PDF preview", error: error.message });
        }
    }
};

/**
 * DOWNLOAD ORIGINAL WORD TEMPLATE FILE (.docx)
 */
exports.downloadWordTemplate = async (req, res) => {
    try {
        const { templateId } = req.params;

        // Validate ID
        if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
            return res.status(400).json({ message: "Invalid template ID format" });
        }

        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        // Build query with tenant filtering if available
        const query = { _id: templateId };
        if (req.user?.tenantId) {
            query.tenantId = req.user.tenantId;
        }

        const template = await LetterTemplate.findOne(query);

        if (!template) {
            console.error(`❌[DOWNLOAD WORD] Template not found: ${templateId}`);
            return res.status(404).json({ message: "Template not found" });
        }

        if (template.templateType !== 'WORD') {
            return res.status(400).json({ message: "This endpoint is only for WORD templates" });
        }

        if (!template.filePath) {
            console.error(`❌[DOWNLOAD WORD] Template filePath missing for template: ${templateId} `);
            return res.status(400).json({ message: "Template file path not set. Please re-upload the template." });
        }

        // Normalize file path
        const normalizedFilePath = normalizeFilePath(template.filePath);

        if (!fs.existsSync(normalizedFilePath)) {
            console.error(`❌[DOWNLOAD WORD] Template file NOT FOUND at: ${normalizedFilePath} `);
            return res.status(404).json({
                message: "Template file not found on server. Please re-upload the template.",
                code: "FILE_NOT_FOUND"
            });
        }

        // Serve the Word file
        const fileName = path.basename(normalizedFilePath);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename = "${template.name || fileName}"`);
        const fileStream = fs.createReadStream(normalizedFilePath);

        fileStream.on('error', (streamError) => {
            console.error(`❌[DOWNLOAD WORD] Stream error: `, streamError);
            if (!res.headersSent) {
                res.status(500).json({ message: "Error reading template file", error: streamError.message });
            }
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error('❌ [DOWNLOAD WORD] Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: error.message });
        }
    }
};

/**
 * DOWNLOAD WORD TEMPLATE AS PDF (Synchronous via LibreOffice)
 */
exports.downloadWordTemplatePDF = async (req, res) => {
    try {
        const { templateId } = req.params;

        // Validate ID
        if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
            return res.status(400).json({ message: "Invalid template ID format" });
        }

        // Get tenant-specific model
        const { LetterTemplate } = getModels(req);

        const template = await LetterTemplate.findById(templateId);

        if (!template) {
            console.error(`❌[DOWNLOAD PDF] Template not found: ${templateId} `);
            return res.status(404).json({ message: "Template not found" });
        }

        if (!template.filePath) {
            console.error(`❌[DOWNLOAD PDF] Template filePath missing for template: ${templateId} `);
            return res.status(400).json({ message: "Template file path not set. Please re-upload the template." });
        }

        // Normalize file path
        const normalizedFilePath = normalizeFilePath(template.filePath);

        if (!fs.existsSync(normalizedFilePath)) {
            console.error(`❌[DOWNLOAD PDF] Template file NOT FOUND at: ${normalizedFilePath} `);
            return res.status(404).json({
                message: "Template file not found on server. Please re-upload the template.",
                code: "FILE_NOT_FOUND"
            });
        }

        const templateDir = path.dirname(normalizedFilePath);
        const templateBaseName = path.basename(normalizedFilePath, '.docx');
        const pdfPath = path.join(templateDir, `${templateBaseName}.pdf`);
        const securePath = path.join(templateDir, `../secure/${templateBaseName}.pdf`);
        // Check/Convert
        try {
            let needsConversion = true;

            if (fs.existsSync(pdfPath)) {
                const docxStats = fs.statSync(normalizedFilePath);
                const pdfStats = fs.statSync(padPath);
                if (pdfStats.mtime >= docxStats.mtime) {
                    needsConversion = false;
                }
            }

            if (needsConversion) {
                // // console.log('🔄 [DOWNLOAD PDF] Converting template to PDF (Mammoth + Puppeteer)...');
                const libreOfficeService = require('../services/LibreOfficeService');
                const generatedPdfPath = await libreOfficeService.convertToPdf(normalizedFilePath, templateDir);
                pdfPath = generatedPdfPath; // Use the actual returned path
                // // console.log(`✅ [DOWNLOAD PDF] PDF generated at: ${pdfPath}`);
            }
        } catch (err) {
            console.error('⚠️ [DOWNLOAD] Conversion failed:', err.message);
            if (!fs.existsSync(pdfPath)) {
                return res.status(500).json({ message: "PDF generation failed", error: err.message });
            }
        }

        // Serve PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename = "${templateBaseName}.pdf"`);
        const pdfStream = fs.createReadStream(pdfPath);
        pdfStream.pipe(res);

    } catch (error) {
        console.error('Download Error:', error);
        if (!res.headersSent) res.status(500).json({ message: error.message });
    }
};

/**
 * GENERATE JOINING LETTER (Word -> PDF)
 * - Load Word Template
 * - Replace placeholders
 * - Convert to PDF
 */
exports.generateJoiningLetter = async (req, res) => {
    try {
        // // console.log('🔥 [JOINING LETTER] Request received:', {
        //     bodyKeys: Object.keys(req.body),
        //     userId: req.user?.id,
        //     tenantId: req.user?.tenantId
        // });

        const { applicantId, employeeId, templateId, refNo, issueDate, signaturePosition, joiningLetterExpiryDate, preview, customData = {}, dateFormat = 'Do MMM. YYYY', approverEmail, approverId } = req.body;
        const normalizedApproverEmail = typeof approverEmail === 'string' ? approverEmail.trim() : '';
        const requiresJoiningApproval = Boolean(approverId);
        const Applicant = getApplicantModel(req);
        const { Employee, LetterTemplate, GeneratedLetter } = getModels(req);

        // // console.log('🔥 [JOINING LETTER] Request received:', { applicantId, employeeId, templateId, refNo, issueDate, signaturePosition });

        // Validate input
        if (!templateId || (!applicantId && !employeeId)) {
            return res.status(400).json({ message: "templateId and (applicantId or employeeId) are required" });
        }

        // Fetch target
        let target;
        let targetType;
        if (employeeId) {
            target = await Employee.findById(employeeId);
            targetType = 'employee';
        } else {
            target = await Applicant.findById(applicantId).populate('requirementId');
            targetType = 'applicant';
        }

        if (targetType === 'applicant' && !applicantId) {
            throw new Error("Missing applicantId in generateJoiningLetter");
        }

        const template = await LetterTemplate.findOne({ _id: templateId, tenantId: req.user.tenantId });

        if (!target || !template) {
            console.error('🔥 [JOINING LETTER] Missing target or template');
            return res.status(404).json({ message: "Employee/Applicant or Template not found" });
        }

        const applicantData = target;
        // // console.log('🔥 [JOINING LETTER] Target Ready:', applicantData?.name || "N/A");

        // Only block if job category explicitly requires salary (e.g. "Full Time (Salary Mandatory)")
        const isSalaryMandatory = String(target.jobCategory || '').toLowerCase().includes('salary mandatory');
        if (isSalaryMandatory && !target.salaryLocked) {
            console.error('🔥 [JOINING LETTER] BLOCKED: Salary not locked for Salary Mandatory candidate', targetType, target._id);
            return res.status(400).json({ 
                success: false, 
                message: "Salary must be finalized and locked before issuing a Joining Letter for this job category.",
                code: 'SALARY_NOT_LOCKED'
            });
        }

        // STRICT REQUIREMENT for applicants: Fail if Offer Letter does not exist
        if (targetType === 'applicant' && !target.offerLetterPath) {
            console.error('🔥 [JOINING LETTER] BLOCKED: Applicant has no Offer Letter generated.');
            return res.status(400).json({ message: "Offer Letter must be generated before Joining Letter." });
        }

        // STRICT WORKFLOW (Hiring): Joining can only be issued after offer is fully signed (no bypass).
        if (targetType === 'applicant') {
            const s = String(target.status || '');
            const isOfferSigned =
                s === 'Fully Signed' ||
                target.isSigned === true ||
                !!target.signedOfferPath ||
                (String(target.offerStatus || '') === 'SIGNED');
            if (!isOfferSigned) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid workflow transition',
                    code: 'INVALID_WORKFLOW_TRANSITION'
                });
            }
        }

        const validJoiningTypes = ['joining', 'appointment', 'Joining', 'Appointment'];
        if (!validJoiningTypes.includes(template.type)) {
            return res.status(400).json({ message: `Invalid template type "${template.type}" for joining letter. Please select a template with type "joining" or "appointment".` });
        }

        // 1. Validate and normalize file path
        if (!template.filePath) {
            console.error('🔥 [JOINING LETTER] Template filePath is missing in database');
            return res.status(400).json({
                message: "Template file path is missing. Please re-upload the template.",
                code: "FILE_PATH_MISSING"
            });
        }

        // Normalize file path (handle both absolute and relative paths)
        const normalizedFilePath = normalizeFilePath(template.filePath);
        // // console.log('🔥 [JOINING LETTER] Original filePath:', template.filePath);
        // // console.log('🔥 [JOINING LETTER] Normalized filePath:', normalizedFilePath);

        if (!fs.existsSync(normalizedFilePath)) {
            console.error('❌ [JOINING LETTER] Template file NOT FOUND at path:', normalizedFilePath);
            console.error('❌ [JOINING LETTER] Original path from DB:', template.filePath);
            return res.status(404).json({
                message: "Template file not found on server. Please re-upload the template.",
                code: "FILE_NOT_FOUND",
                templateId: template._id.toString()
            });
        }

        const syntaxCheck = await validateWordTemplateSyntax(normalizedFilePath);
        if (!syntaxCheck.valid) {
            return res.status(400).json({
                message: syntaxCheck.message,
                code: 'INVALID_TEMPLATE_SYNTAX',
                details: syntaxCheck.details
            });
        }

        // // console.log('✅ [JOINING LETTER] Template file found, reading...');
        const content = await fsPromises.readFile(normalizedFilePath);

        // 2. Initialize Docxtemplater SAFE MODE
        let doc;
        try {
            const zip = new PizZip(content);
            doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: function (tag) { return ''; }, // Return empty string for ANY missing tag
                delimiters: { start: '{{', end: '}}' }
            });
        } catch (error) {
            console.error('🔥 [JOINING LETTER] Docxtemplater Init Failed:', error);
            return res.status(400).json({ message: "Template load failed", error: error.message });
        }


        // 3. Prepare Data - prefer immutable snapshot, fallback to active SalaryAssignment/template.
        let snapshot = await resolveLetterSalarySnapshot(req, { employeeId, applicantId, target, targetType });

        if (!snapshot) {
            console.warn(`[JOINING LETTER] Salary snapshot/assignment not found for ${targetType}: ${employeeId || applicantId}. Proceeding with fallback CTC.`);
            snapshot = { ctc: target?.ctc || 0, earnings: [], employeeDeductions: [], benefits: [] };
        }

        // Helper to format currency
        const cur = (val) => Math.round(val || 0).toLocaleString('en-IN');

        const earnings = (snapshot.earnings || []).map(e => ({
            ...e,
            monthly: e.monthlyAmount || e.monthly || 0,
            yearly: e.yearlyAmount || e.yearly || e.annualAmount || (e.monthlyAmount * 12) || 0
        }));

        const employeeDeductions = (snapshot.employeeDeductions || snapshot.deductions || []).map(d => ({
            ...d,
            monthly: d.monthlyAmount || d.monthly || 0,
            yearly: d.yearlyAmount || d.yearly || d.annualAmount || (d.monthlyAmount * 12) || 0
        }));

        const benefits = (snapshot.benefits || []).map(b => ({
            ...b,
            monthly: b.monthlyAmount || b.monthly || 0,
            yearly: b.yearlyAmount || b.yearly || b.annualAmount || (b.monthlyAmount * 12) || 0
        }));

        // Use pre-calculated totals from snapshot if available for consistency
        const grossAAnnual = snapshot.summary?.grossEarnings || snapshot.breakdown?.totalEarnings || earnings.reduce((sum, e) => sum + e.yearly, 0);
        const totalBenefitsAnnual = snapshot.summary?.totalBenefits || snapshot.breakdown?.totalBenefits || benefits.reduce((sum, b) => sum + b.yearly, 0);
        const totalDeductionsAnnual = snapshot.summary?.totalDeductions || snapshot.breakdown?.totalDeductions || employeeDeductions.reduce((sum, d) => sum + d.yearly, 0);
        const totalCTCAnnual = snapshot.ctc || snapshot.annualCTC || (grossAAnnual + totalBenefitsAnnual);
        const netAnnual = snapshot.summary?.netPay || snapshot.breakdown?.netPay || (grossAAnnual - totalDeductionsAnnual);


        // Categorize Benefits for Gross B (Annual) and Gross C (Retirals)
        const grossBListRaw = benefits.filter(b => /bonus|lta|leave|variable|annual|performance/i.test(b.name || ''));
        const grossCListRaw = benefits.filter(b => !/bonus|lta|leave|variable|annual|performance/i.test(b.name || ''));

        const grossBAnnualTotal = grossBListRaw.reduce((sum, b) => sum + (b.yearly || 0), 0);
        const grossCAnnualTotal = grossCListRaw.reduce((sum, b) => sum + (b.yearly || 0), 0);

        const totals = {
            grossA: {
                monthly: Math.round(grossAAnnual / 12),
                yearly: Math.round(grossAAnnual),
                formattedM: safeCur(grossAAnnual / 12),
                formattedY: safeCur(grossAAnnual)
            },
            grossB: {
                monthly: Math.round(grossBAnnualTotal / 12),
                yearly: Math.round(grossBAnnualTotal),
                formattedM: safeCur(grossBAnnualTotal / 12),
                formattedY: safeCur(grossBAnnualTotal)
            },
            grossC: {
                monthly: Math.round(grossCAnnualTotal / 12),
                yearly: Math.round(grossCAnnualTotal),
                formattedM: safeCur(grossCAnnualTotal / 12),
                formattedY: safeCur(grossCAnnualTotal)
            },
            deductions: {
                monthly: Math.round(totalDeductionsAnnual / 12),
                yearly: Math.round(totalDeductionsAnnual),
                formattedM: safeCur(totalDeductionsAnnual / 12),
                formattedY: safeCur(totalDeductionsAnnual)
            },
            net: {
                monthly: Math.round(netAnnual / 12),
                yearly: Math.round(netAnnual),
                formattedM: safeCur(netAnnual / 12),
                formattedY: safeCur(netAnnual)
            },
            computedCTC: {
                monthly: Math.round(totalCTCAnnual / 12),
                yearly: Math.round(totalCTCAnnual),
                formattedM: safeCur(totalCTCAnnual / 12),
                formattedY: safeCur(totalCTCAnnual)
            }
        };

        const flatData = {};
        earnings.forEach(e => { flatData[e.code] = cur(e.monthly || e.monthlyAmount); flatData[`${e.code} _ANNUAL`] = cur(e.yearly || e.yearlyAmount); });
        employeeDeductions.forEach(d => { flatData[d.code] = cur(d.monthly || d.monthlyAmount); flatData[`${d.code} _ANNUAL`] = cur(d.yearly || d.yearlyAmount); });
        benefits.forEach(b => { flatData[b.code] = cur(b.monthly || b.monthlyAmount); flatData[`${b.code} _ANNUAL`] = cur(b.yearly || b.yearlyAmount); });

        req.calculatedSalaryData = {
            earnings: earnings.map(e => ({ name: e.name, monthly: cur(e.monthly), yearly: cur(e.yearly) })),
            deductions: employeeDeductions.map(d => ({ name: d.name, monthly: cur(d.monthly), yearly: cur(d.yearly) })),
            benefits: benefits.map(b => ({ name: b.name, monthly: cur(b.monthly), yearly: cur(b.yearly) })),
            totals,
            flatData
        };
        req.flatSalaryData = flatData;

        // --- BUILD TABLE ---
        const salaryComponents = [];
        const earningsList = req.calculatedSalaryData.earnings;
        const deductionsList = req.calculatedSalaryData.deductions;
        const benefitsList = req.calculatedSalaryData.benefits;

        // A - Monthly Benefits (Gross A)
        salaryComponents.push({ name: 'A – Monthly Benefits', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        earnings.forEach(e => {
            const m = safeCur(e.monthly);
            const y = safeCur(e.yearly);
            salaryComponents.push({ name: e.name, monthly: m, yearly: y, annual: y, MONTHLY: m, YEARLY: y, ANNUAL: y });
        });
        salaryComponents.push({
            name: 'GROSS A',
            monthly: totals.grossA.formattedM, yearly: totals.grossA.formattedY, annual: totals.grossA.formattedY,
            MONTHLY: totals.grossA.formattedM, YEARLY: totals.grossA.formattedY, ANNUAL: totals.grossA.formattedY
        });

        // Deduction Section
        salaryComponents.push({ name: '', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        employeeDeductions.forEach(d => {
            const m = safeCur(d.monthly);
            const y = safeCur(d.yearly);
            salaryComponents.push({ name: d.name, monthly: m, yearly: y, annual: y, MONTHLY: m, YEARLY: y, ANNUAL: y });
        });
        salaryComponents.push({
            name: 'Total Deductions (B)',
            monthly: totals.deductions.formattedM, yearly: totals.deductions.formattedY, annual: totals.deductions.formattedY,
            MONTHLY: totals.deductions.formattedM, YEARLY: totals.deductions.formattedY, ANNUAL: totals.deductions.formattedY
        });
        salaryComponents.push({
            name: 'Take Home Package',
            monthly: totals.net.formattedM, yearly: totals.net.formattedY, annual: totals.net.formattedY,
            MONTHLY: totals.net.formattedM, YEARLY: totals.net.formattedY, ANNUAL: totals.net.formattedY
        });

        // B - Annual Benefits
        salaryComponents.push({ name: '', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        salaryComponents.push({ name: 'B – Annual Benefits', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        grossBListRaw.forEach(b => {
            const m = safeCur(b.monthly);
            const y = safeCur(b.yearly);
            salaryComponents.push({ name: b.name, monthly: m, yearly: y, annual: y, MONTHLY: m, YEARLY: y, ANNUAL: y });
        });
        salaryComponents.push({
            name: 'GROSS B',
            monthly: totals.grossB.formattedM, yearly: totals.grossB.formattedY, annual: totals.grossB.formattedY,
            MONTHLY: totals.grossB.formattedM, YEARLY: totals.grossB.formattedY, ANNUAL: totals.grossB.formattedY
        });

        // C - Retirals
        salaryComponents.push({ name: '', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        salaryComponents.push({ name: 'C – Retirals Company\'s Benefits', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        grossCListRaw.forEach(b => {
            const m = safeCur(b.monthly);
            const y = safeCur(b.yearly);
            salaryComponents.push({ name: b.name, monthly: m, yearly: y, annual: y, MONTHLY: m, YEARLY: y, ANNUAL: y });
        });
        salaryComponents.push({
            name: 'GROSS C',
            monthly: totals.grossC.formattedM, yearly: totals.grossC.formattedY, annual: totals.grossC.formattedY,
            MONTHLY: totals.grossC.formattedM, YEARLY: totals.grossC.formattedY, ANNUAL: totals.grossC.formattedY
        });

        // Final CTC
        salaryComponents.push({ name: '', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        salaryComponents.push({
            name: 'Computed CTC (A+B+C)',
            monthly: totals.computedCTC.formattedM, yearly: totals.computedCTC.formattedY, annual: totals.computedCTC.formattedY,
            MONTHLY: totals.computedCTC.formattedM, YEARLY: totals.computedCTC.formattedY, ANNUAL: totals.computedCTC.formattedY
        });

        // // console.log("salaryComponents (FINAL STRICT) =>", salaryComponents);

        // --- GENERATE APPOINTMENT REFERENCE NUMBER ---
        let generatedRefNo = null;
        try {
            const companyIdConfig = require('./companyIdConfig.controller');
            const tenantId = req.user?.tenantId || req.tenantId;

            // Fetch Company Profile for company code and branch code
            const { CompanyProfile } = getModels(req);
            const companyProfile = await CompanyProfile.findOne({ tenantId: tenantId });

            const companyCode = companyProfile?.companyCode || 'GTPL';
            const branchCode = companyProfile?.branchCode || 'AHM';

            // Get department code for reference number
            const deptName = targetType === 'employee' ? (target.department || 'GEN') : (target.requirementId?.department?.name || 'GEN');
            const deptCode = deptName.substring(0, 3).toUpperCase();

            // // console.log('🔍 [JOINING LETTER] ID Generation Context:', {
            //     companyCode,
            //     branchCode,
            //     deptCode,
            //     targetType,
            //     department: deptName
            // });

            // Generate APPOINTMENT ID with all replacements
            const appointmentIdResult = await companyIdConfig.generateIdInternal({
                tenantId: tenantId,
                entityType: 'APPOINTMENT',
                increment: true,
                extraReplacements: {
                    '{{COMPANY}}': companyCode,
                    '{{BRANCH}}': branchCode,
                    '{{DEPT}}': deptCode
                }
            });

            generatedRefNo = appointmentIdResult.id;
            // // console.log('✅ [JOINING LETTER] Generated Reference Number:', generatedRefNo);
        } catch (idErr) {
            console.warn("⚠️ [JOINING LETTER] Could not generate reference number:", idErr.message);
            console.error("⚠️ [JOINING LETTER] ID Generation Error Stack:", idErr.stack);
            generatedRefNo = `APPT - ${new Date().getFullYear()} -${String(Math.floor(Math.random() * 10000)).padStart(5, '0')} `;
        }

        // A. Basic Placeholders
        // Normalize target for mapOfferToJoiningData
        const normalizedTarget = {
            ...(target.toObject ? target.toObject() : target),
            name: target.name || (target.firstName ? `${target.firstName} ${target.lastName || ''} `.trim() : ''),
            address: target.address || (target.tempAddress ? `${target.tempAddress.line1}, ${target.tempAddress.city} ` : '')
        };
        const basicData = joiningLetterUtils.mapOfferToJoiningData(normalizedTarget, {}, snapshot);
        const targetGrade = {
            id: target.gradeSnapshot?.id || target.gradeId || target.requirementId?.gradeId || null,
            name: target.gradeSnapshot?.name || target.grade || target.requirementId?.grade || '',
            code: target.gradeSnapshot?.code || '',
            level: target.gradeSnapshot?.level ?? ''
        };

        // Build complete salaryStructure object for template
        const salaryStructure = {
            earnings: req.calculatedSalaryData?.earnings || [],
            deductions: req.calculatedSalaryData?.deductions || [],
            benefits: req.calculatedSalaryData?.benefits || [],
            totals: {
                grossA: req.calculatedSalaryData?.totals?.grossA || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                grossB: req.calculatedSalaryData?.totals?.grossB || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                grossC: req.calculatedSalaryData?.totals?.grossC || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                netSalary: req.calculatedSalaryData?.totals?.netSalary || { monthly: 0, yearly: 0 },
                totalCTC: req.calculatedSalaryData?.totals?.totalCTC || { monthly: 0, yearly: 0 },
                computedCTC: req.calculatedSalaryData?.totals?.computedCTC || { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
                ...(req.calculatedSalaryData?.totals || {})
            }
        };

        // Ensure onboarding credentials exist for letter placeholders (v10.3)
        if (!target.meta?.onboardingTempPassword) {
            const crypto = require('crypto');
            const bcrypt = require('bcryptjs');
            const tempPassword = crypto.randomBytes(6).toString('base64url');
            const hashedPassword = await bcrypt.hash(tempPassword, 10);
            
            if (!target.meta) target.meta = {};
            target.meta.onboardingDraft = true;
            target.meta.onboardingTempPassword = tempPassword;
            target.password = hashedPassword;
            
            if (target.markModified) target.markModified('meta');
            await target.save();
        }

        const salaryTemplatePayload = buildSalaryTemplatePayload(snapshot, totals);
        const initialData = {
            ...expandCustomData(customData),
            ...basicData,
            salary: salaryTemplatePayload.salary,
            ...salaryTemplatePayload.salary_flat,
            salaryComponents: salaryComponents,
            salaryStructure: salaryStructure,
            earnings: salaryStructure.earnings,
            deductions: salaryStructure.deductions,
            benefits: salaryStructure.benefits,
            totals: salaryStructure.totals,
            ...(req.calculatedSalaryData || {}),
            ...(req.flatSalaryData || {}),
            salary_table_text_block: salaryComponents.map(r => `${r.name} \t${r.monthly} \t${r.yearly} `).join('\n'),
            SALARY_TABLE: salaryComponents.map(r => `${r.name} \t${r.monthly} \t${r.yearly} `).join('\n'),

            // Custom Overrides for Ref No and Issue Date (Use generated APPOINTMENT ID)
            ref_no: refNo || generatedRefNo || basicData.ref_no,
            refNo: refNo || generatedRefNo || basicData.ref_no,
            ref_code: refNo || generatedRefNo || basicData.ref_no,
            reference_number: refNo || generatedRefNo || basicData.ref_no,
            appointment_id: generatedRefNo,
            APPOINTMENT_ID: generatedRefNo,
            grade: targetGrade.name,
            grade_name: targetGrade.name,
            grade_code: targetGrade.code,
            grade_level: targetGrade.level,
            GRADE: targetGrade.name,
            issued_date: issueDate ? new Date(issueDate).toLocaleDateString('en-IN') : (basicData.issued_date || new Date().toLocaleDateString('en-IN')),
            issuedDate: issueDate ? new Date(issueDate).toLocaleDateString('en-IN') : (basicData.issued_date || new Date().toLocaleDateString('en-IN')),
            issue_date: issueDate ? new Date(issueDate).toLocaleDateString('en-IN') : (basicData.issue_date || new Date().toLocaleDateString('en-IN')),
            current_date: issueDate ? new Date(issueDate).toLocaleDateString('en-IN') : (basicData.current_date || new Date().toLocaleDateString('en-IN')),
            
            // Login Credentials for Onboarding Portal
            login_email: target.email || '',
            login_password: target.meta?.onboardingTempPassword || ''
        };

        // (Cleanup: removed redundant legacy validation and duplicate finalData declaration)
        // // console.log('✅ [JOINING LETTER] Explicit salary table built. Rows:', salaryComponents.length);

        // ========== UNIVERSAL STABLE PATCH ENGINE (STABLE FOREVER) ==========
        const finalData = buildEnterpriseLetterData({
            template,
            baseData: applyUniversalSalaryPatches(initialData, snapshot, totals),
            target: normalizedTarget,
            customData,
            issueDate,
            dateFormat,
            refNo: refNo || generatedRefNo
        });
        const { generatedVariables, missingVariables } = collectGeneratedVariableReport(template.placeholders || template.detectedVariables || [], finalData);

        // Final structural safety guard (v10.2: Skip arrays to preserve table data)
        Object.keys(finalData).forEach(k => {
            if (finalData[k] === undefined || finalData[k] === null) {
                finalData[k] = "";
            }
            // Ensure no nested objects survive EXCEPT arrays (needed for loops)
            if (typeof finalData[k] === 'object' && finalData[k] !== null && !Array.isArray(finalData[k])) {
                // Keep 'totals' and other important ones? 
                // Actually, if it's meant for simple tags, we stringify it.
                // But let's just avoid wiping arrays for now as that's the main blocker.
            }
        });
        // ========== END SAFE PATCHES ==========

        // ========== END SAFE PATCHES ==========

        const fileName = `Joining_Letter_${employeeId || applicantId || 'id'}_${Date.now()}`;
        const outputDir = path.join(__dirname, '../uploads/offers');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const docxPath = path.join(outputDir, `${fileName}.docx`);

        // 6. Convert to PDF Synchronously (Final issue or Preview)
        let finalRelativePath;
        let finalPdfUrl;
        let htmlContent = '';
        let buf = null;

        const renderCache = buildLetterRenderCache({
            kind: 'joining',
            template,
            target,
            snapshot,
            payload: {
                salaryRenderVersion: 2,
                applicantId,
                employeeId,
                refNo: refNo || generatedRefNo || '',
                issueDate,
                dateFormat,
                signaturePosition,
                customData
            }
        });

        if (fs.existsSync(renderCache.pdfPath) && fs.existsSync(renderCache.docxPath)) {
            await copyIfExists(renderCache.docxPath, docxPath);
            const cachedPdfName = `${fileName}.pdf`;
            const cachedPdfPath = path.join(outputDir, cachedPdfName);
            await copyIfExists(renderCache.pdfPath, cachedPdfPath);
            finalRelativePath = `offers/${cachedPdfName}`;
            finalPdfUrl = `/uploads/${finalRelativePath}`;
        } else {
            // 4. Render
            // // console.log('🔥 [JOINING LETTER] Rendering with data...');
            try {
                doc.render(finalData);
            } catch (renderError) {
                console.error('🔥 [JOINING LETTER] RENDER CRASH:', renderError);
                return res.status(500).json({
                    message: "Joining letter generation failed due to template rendering issues.",
                    error: renderError.message
                });
            }

            // 5. Generate Output (DOCX)
            buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
            await fsPromises.writeFile(docxPath, buf);

            try {
                // [STABILITY] Always use full LibreOffice for Word templates to preserve 100% layout fidelity.
                const libreOfficeService = require('../services/LibreOfficeService');
                const pdfAbsolutePath = await libreOfficeService.convertToPdf(docxPath, outputDir);
                const pdfFileName = path.basename(pdfAbsolutePath);
                await copyIfExists(docxPath, renderCache.docxPath);
                await copyIfExists(pdfAbsolutePath, renderCache.pdfPath);
            finalRelativePath = `offers/${pdfFileName}`;
            finalPdfUrl = `/uploads/${finalRelativePath}`;

            // Optional: Still provide HTML for quick fallback
            if (preview) {
                const result = await mammoth.convertToHtml({ buffer: buf });
                htmlContent = `<div class="word-preview-container" style="padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: white; color: #334155; line-height: 1.6; max-width: 900px; margin: 0 auto; box-shadow: 0 0 20px rgba(0,0,0,0.05);">${result.value}</div>`;
            }
            } catch (pdfError) {
                console.error('⚠️ [JOINING LETTER] PDF Conversion Failed:', pdfError.message);
                // If it's just a preview, we can fallback to mammoth instead of failing hard
                if (preview) {
                    try {
                        const result = await mammoth.convertToHtml({ buffer: buf });
                        htmlContent = `<div class="word-preview-container" style="padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: white; color: #334155; line-height: 1.6; max-width: 900px; margin: 0 auto; box-shadow: 0 0 20px rgba(0,0,0,0.05);">${result.value}</div>`;
                    } catch (fallbackErr) {
                        return res.status(500).json({ message: "Preview Failed", error: fallbackErr.message });
                    }
                } else {
                    return res.status(500).json({
                        message: "PDF Generation Failed.",
                        error: pdfError.message
                    });
                }
            }
        }


        let generated = null;
        if (!preview) {
            // Cloudinary: Upload generated joining letter
            const CloudinaryService = require("../services/CloudinaryService");
            if (CloudinaryService.isConfigured()) {
                try {
                    // Determine absolute path for upload
                    const pdfAbsolutePath = path.isAbsolute(finalRelativePath)
                        ? finalRelativePath
                        : path.join(process.cwd(), 'uploads', finalRelativePath);

                    const cloudRes = await CloudinaryService.uploadFile(
                        pdfAbsolutePath,
                        `hrms/${req.tenantId}/generated_letters/joining`,
                        false
                    );
                    finalPdfUrl = cloudRes.url;
                } catch (err) {
                    console.warn("[generateJoiningLetter] PDF cloud upload failed:", err.message);
                }
            }

            // Resolve the approver user if requiresJoiningApproval
            let approverUser = null;
            if (requiresJoiningApproval && approverId) {
                try {
                    const { User } = getModels(req);
                    approverUser = await User.findOne({
                        _id: approverId,
                        mainCompanyId: req.tenantId || req.user.tenantId
                    });
                } catch (e) {
                    console.error("⚠️ Failed to pre-fetch approverUser:", e);
                }
            }
            let approverEmailToSave = approverUser ? approverUser.email : (normalizedApproverEmail || null);

            generated = new GeneratedLetter({
                tenant: req.user?.tenantId || req.tenantId,
                applicantId: applicantId,
                employeeId: employeeId || null,
                templateId,
                letterType: 'joining',
                pdfPath: finalRelativePath,
                pdfUrl: finalPdfUrl,
                status: requiresJoiningApproval ? 'pending' : 'generated',
                approvalStatus: requiresJoiningApproval ? 'PENDING_APPROVAL' : undefined,
                approverEmail: approverEmailToSave,
                generatedBy: req.user?.id,
                generatedVariables,
                missingVariables,
                signaturePosition: signaturePosition || { alignment: 'right' },
                generationMode: 'static',
                pdfVersion: 1,
                templateSnapshot: {
                    name: template.templateName || template.name,
                    bodyContent: '',
                    headerContent: template.headerContent || '',
                    footerContent: template.footerContent || '',
                    version: Number(template.version?.toString().replace(/[^0-9.]/g, '')) || 1
                },
                snapshotData: {
                    customData,
                    generatedVariables,
                    missingVariables
                },
                // Joining Letter Workflow Fields
                joiningLetterExpiryDate: joiningLetterExpiryDate ? new Date(joiningLetterExpiryDate) : null,
                joiningLetterStatus: requiresJoiningApproval ? 'PENDING_APPROVAL' : 'pending',
                joiningLetterRequestedAgain: false
            });

            await generated.save();

            if (requiresJoiningApproval && approverId) {
                try {
                    const { resolveEmployeeForUser } = require('../services/approverResolver.service');
                    const requesterEmployee = await resolveEmployeeForUser(req, req.tenantDB);
                    const requesterEmployeeId = requesterEmployee?._id || req.user?.employeeId || null;

                    const { startWorkflow } = require('../services/workflowStart.service');
                    const workflowResult = await startWorkflow({
                        tenantDB: req.tenantDB,
                        tenantId: req.tenantId || req.user.tenantId,
                        moduleKey: 'recruitment',
                        entityType: 'GeneratedLetter',
                        entityId: generated._id,
                        requesterEmployeeId,
                        requesterUserId: req.user?.id || req.user?.userId,
                        contextSnapshot: {
                            applicantId: (applicantId || target._id).toString(),
                            tenantId: (req.tenantId || req.user.tenantId).toString(),
                            letterType: 'joining'
                        },
                        req
                    });

                    if (workflowResult.started) {
                        generated.workflowInstanceId = workflowResult.instance._id;
                        generated.workflowStatus = 'PENDING';
                        generated.approvalStatus = 'PENDING_APPROVAL';
                        await generated.save();
                    } else {
                        console.error("⚠️ [generateJoiningLetter] Universal Workflow failed to start:", workflowResult.reason);
                    }
                } catch (approvalErr) {
                    console.error("⚠️ [generateJoiningLetter] Universal Workflow creation failed:", approvalErr);
                }
            }

            // Appointment ID sequence is already incremented at line 1590 during generation.
            // Redundant block removed to prevent double-skipping numbers.

            // Update Applicant/Employee
            if (targetType === 'applicant') {
                // Revision/re-issue bookkeeping for joining letter
                const isJoiningRevise = (
                    target.joiningLetterStatus === 'EXPIRED' ||
                    target.joiningLetterStatus === 'REQUESTED' ||
                    target.joiningLetterStatus === 'REJECTED' ||
                    target.joiningLetterRevisionRequested
                );
                if (isJoiningRevise) {
                    target.joiningLetterVersion = Number(target.joiningLetterVersion || 1) + 1;
                    target.joiningLetterRevisionRequested = false;
                    target.joiningRevisionRequestedAt = null;
                    // keep joiningRevisionRequestedVersion as-is; it is compared against joiningLetterVersion
                }

                target.joiningLetterPath = finalRelativePath;
                if (requiresJoiningApproval) {
                    target.joiningLetterStatus = 'PENDING_APPROVAL';
                    target.status = 'Joining Letter Pending Approval';
                    if (!target.timeline) target.timeline = [];
                    target.timeline.push({
                        status: 'Joining Letter Pending Approval',
                        message: `Joining letter generated and pending approval from ${approverEmailToSave || 'approver'}.`,
                        updatedBy: req.user?.name || "HR",
                        timestamp: new Date()
                    });
                    await target.save();
                } else {
                    target.joiningLetterStatus = 'SENT';
                    if (joiningLetterExpiryDate) {
                        target.joiningLetterExpiryAt = new Date(joiningLetterExpiryDate);
                    }

                    if (!target.timeline) target.timeline = [];
                    target.timeline.push({
                        status: 'Joining Letter Generated',
                        message: 'Joining letter has been generated and is ready for download.',
                        updatedBy: req.user?.name || "HR",
                        timestamp: new Date()
                    });

                    await target.save();

                    // -----------------------------------------------------
                    // NOTIFICATIONS & EMAILS (Added via Request)
                    // -----------------------------------------------------
                    // 1. Update Status to 'Joining Letter Issued'
                    target.status = 'Joining Letter Issued';
                    await target.save();

                    try {
                        // Fetch Company Profile for Email
                        const { CompanyProfile, Notification } = getModels(req);
                        const companyProfile = await CompanyProfile.findOne({ tenantId: req.user.tenantId });
                        const companyName = companyProfile?.companyName || 'Gitakshmi Technologies';

                        // Construct absolute path for attachment
                        const attachmentPath = path.join(__dirname, '../uploads', finalRelativePath);
                        const jobTitle = target.requirementId?.jobTitle || 'Role';

                        // 2. Send Email
                        if (target.email) {
                            const formattedJoiningDate = (target.joiningDate || issueDate) ? new Date(target.joiningDate || issueDate).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

                            await emailService.sendJoiningLetterEmail(
                                target.email,
                                target.name,
                                jobTitle,
                                companyName,
                                formattedJoiningDate,
                                attachmentPath,
                                req.user.tenantId
                            );
                        }

                        // 3. Create Notification for Candidate Portal
                        if (target.candidateId) {
                            await Notification.create({
                                tenant: req.user.tenantId,
                                receiverId: target.candidateId,
                                receiverRole: 'candidate',
                                entityType: 'JoiningLetter',
                                entityId: generated._id,
                                title: 'Joining Letter Issued',
                                message: `Congratulations! Your joining letter for ${jobTitle} has been issued.Please check your email or download it from here.`,
                                isRead: false
                            });
                        }

                    } catch (notifyErr) {
                        console.error("⚠️ [JOINING LETTER] Failed to send notifications:", notifyErr.message);
                    }
                }
            }
        }

        // RETURN PDF URL IMMEDIATELY
        // // console.log('✅ [JOINING LETTER] SUCCESS - Sending response:', {
        //     success: true,
        //     downloadUrl: finalPdfUrl,
        //     letterId: generated._id
        // });

        return res.json({
            success: true,
            isPreview: !!preview,
            fileUrl: finalPdfUrl,
            downloadUrl: finalPdfUrl, // Compatibility with handleJoiningGenerate
            htmlContent: preview ? htmlContent : undefined,
            fileName: fileName,
            letterId: generated?._id,
            generatedVariables,
            missingVariables,
            warnings: missingVariables.length ? missingVariables.map((variable) => `Variable data missing: ${variable}`) : []
        });

    } catch (error) {
        // Test comment
        console.error('🔥 [JOINING LETTER] FATAL ERROR:', error);
        res.status(500).json({
            success: false,
            message: "Generate Failed: " + error.message,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * GENERATE OFFER LETTER (HTML -> PDF)
 * - Uses Puppeteer/Images
 */
exports.generateOfferLetter = async (req, res) => {
    const logFile = path.join(process.cwd(), 'generation_debug.log');
    try {
        // Accept params from the Generate Modal
        const { applicantId, templateId, imageData, refNo, joiningDate, expiryAt, address, department, location, fatherName, relationType, salutation, issueDate, preview, name, dearName, dateFormat, signaturePosition, jobCategory, probationPeriod = '3 months', customData = {}, approverEmail, approverId, approvalMode } = req.body;
        const customRenderData = expandCustomData(customData);
        const normalizedApproverEmail = typeof approverEmail === 'string' ? approverEmail.trim() : '';
        const normalizedApprovalMode = String(approvalMode || '').trim().toUpperCase();
        const requiresOfferApproval = ['REPORTING_CHAIN', 'WORKFLOW', 'DYNAMIC_CHAIN'].includes(normalizedApprovalMode) || Boolean(approverId) || Boolean(req.body.customWorkflow);

        fs.appendFileSync(logFile, `\n[${new Date().toISOString()}] 🚀 GENERATE OFFER | Applicant: ${applicantId} | Preview: ${preview} | RefNo: ${refNo}\n`);

        // 🔎 STEP 1 & 5: ROOT CAUSE & VALIDATION
        if (!applicantId || !templateId) {
            fs.appendFileSync(logFile, `❌ Error: Missing applicantId/templateId\n`);
            return res.status(400).json({ success: false, message: "Missing required data: applicantId or templateId" });
        }

        const Applicant = getApplicantModel(req);

        // Get tenant-specific models
        const { LetterTemplate, GeneratedLetter, CompanyProfile, Candidate, Employee, AuditLog } = getModels(req);

        // Fetch company profile for branding/letterhead logic
        const company = await CompanyProfile.findOne({ tenantId: req.tenantId || req.user.tenantId });

        // Get the template to check its type
        const template = await LetterTemplate.findOne({ _id: templateId, tenantId: req.tenantId || req.user.tenantId });
        if (!template) {
            console.error('❌ [OFFER LETTER] Template not found:', templateId);
            return res.status(404).json({ message: "Template not found" });
        }

        const applicant = await Applicant.findById(applicantId).populate('requirementId');
        if (!applicant) {
            console.error('❌ [OFFER LETTER] Applicant not found:', applicantId);
            return res.status(404).json({ message: "Applicant not found" });
        }

        if (!preview) {
            const ExternalEmployeeRecord = req.tenantDB.models.ExternalEmployeeRecord
                || req.tenantDB.model('ExternalEmployeeRecord', require('../models/ExternalEmployeeRecord'));
            const approvedExternalRecord = await ExternalEmployeeRecord.findOne({
                applicantId: applicant._id,
                tenant: req.tenantId || req.user.tenantId,
                status: 'Approved',
                draftEmployeeId: { $ne: null }
            }).lean();
            const draftEmployeeId = approvedExternalRecord?.draftEmployeeId || applicant.employeeId;
            const draftEmployee = draftEmployeeId
                ? await Employee.findOne({ _id: draftEmployeeId, status: 'Draft' }).lean().catch(() => null)
                : null;
            if (!approvedExternalRecord || !draftEmployee) {
                return res.status(400).json({
                    success: false,
                    message: 'Candidate Profile Not Approved',
                    code: 'CANDIDATE_PROFILE_NOT_APPROVED'
                });
            }
        }
        const candidateDoc = applicant.candidateId ? await Candidate.findById(applicant.candidateId).lean().catch(() => null) : null;
        const employeeDoc = applicant.employeeId ? await Employee.findById(applicant.employeeId).lean().catch(() => null) : null;
        const applicantGrade = {
            id: applicant.gradeSnapshot?.id || applicant.gradeId || applicant.requirementId?.gradeId || null,
            name: applicant.gradeSnapshot?.name || applicant.requirementId?.grade || '',
            code: applicant.gradeSnapshot?.code || '',
            level: applicant.gradeSnapshot?.level ?? ''
        };

        // STRICT WORKFLOW (Hiring): Offer issue rules (no bypass).
        // - First issue allowed from Interview/Selected stages
        // - Re-issue allowed ONLY when offer is expired / candidate requested revision / rejected
        // We keep UI labels unchanged, but enforce business rule on backend.
        if (!preview) {
            const s = String(applicant.status || '');
            const isInterviewStage =
                s === 'Interview' ||
                s === 'Interview Scheduled' ||
                s === 'Interview Rescheduled' ||
                s === 'Interview Completed' ||
                s === 'HR Round' ||
                // Legacy pipeline: "Selected" means interview cleared / ready to issue offer
                s === 'Selected' ||
                s.includes('Interview') ||
                s.includes('Round');

            const isValidReissue =
                ['EXPIRED', 'REQUESTED', 'REJECTED', 'REVISED'].includes(String(applicant.offerStatus || '')) ||
                !!applicant.offerRevisionRequested ||
                ['Offer Expired', 'Offer Rejected'].includes(s);

            if (!isInterviewStage && !isValidReissue) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid workflow transition',
                    code: 'INVALID_WORKFLOW_TRANSITION'
                });
            }
        }

        // // console.log('✅ [OFFER LETTER] Found Applicant:', applicant.name, '| Template:', template.templateName);

        // Ensure only ONE active SENT offer per candidate/application
        if (!preview) {
            const now = new Date();
            const existingExpiry = applicant.offerExpiryAt ? new Date(applicant.offerExpiryAt) : null;
            const hasActiveSent = applicant.offerLetterPath && applicant.offerStatus === 'SENT' && existingExpiry && now <= existingExpiry;
            if (hasActiveSent) {
                return res.status(400).json({
                    message: 'An active offer is already SENT for this candidate. Wait for expiry or acceptance.',
                    code: 'ACTIVE_OFFER_EXISTS'
                });
            }
            if (applicant.offerStatus === 'ACCEPTED') {
                return res.status(400).json({
                    message: 'Offer already accepted. Cannot generate a new offer.',
                    code: 'OFFER_ALREADY_ACCEPTED'
                });
            }
        }

        // --- BGV INTEGRATION ---
        const { BGVCase, EmployeeSalarySnapshot } = getModels(req);
        if (BGVCase) {
            try {
                const tenantId = req.tenantId || req.user.tenantId;
                const bgv = await BGVCase.findOne({ applicationId: applicant._id, tenant: tenantId });
                // // console.log(`🔍[OFFER LETTER] BGV Status: ${bgv ? bgv.overallStatus : 'NOT_FOUND'} `);

                if (bgv) {
                    if (bgv.overallStatus === 'FAILED') {
                        console.warn(`⚠️[OFFER LETTER] BGV FAILED for ${applicant.name}. Proceeding by ignoring BGV status as per user request.`);
                        // Non-blocking as per user request to not make BGV compulsory
                    }

                    if (bgv.overallStatus === 'IN_PROGRESS') {
                        console.warn(`⚠️[OFFER LETTER] BGV is still IN_PROGRESS for ${applicant.name}.Proceeding with caution.`);
                        // Non-blocking: We allow generation but could add a warning to the response if needed.
                        // For now, let's just proceed to solve the user's issue.
                    }
                }
            } catch (bgvErr) {
                console.warn("⚠️ [OFFER LETTER] Failed to check BGV status:", bgvErr.message);
                // Continue despite BGV check failure (non-blocking)
            }
        }
        // -----------------------

        // --- SALARY SNAPSHOT FETCHING ---
        let salarySnapshot = null;
        let salaryTotals = null;
        try {
            const query = { applicant: applicantId };
            salarySnapshot = await EmployeeSalarySnapshot.findOne(query).sort({ createdAt: -1 }).lean();
            if (!salarySnapshot && applicant.currentSalarySnapshotId) {
                salarySnapshot = await EmployeeSalarySnapshot.findById(applicant.currentSalarySnapshotId).lean();
            }

            if (salarySnapshot) {
                const earnings = (salarySnapshot.earnings || []).map(e => ({
                    ...e,
                    monthly: e.monthlyAmount || e.monthly || 0,
                    yearly: e.yearlyAmount || e.yearly || (e.monthlyAmount * 12) || 0
                }));
                const deductions = (salarySnapshot.employeeDeductions || salarySnapshot.deductions || []).map(d => ({
                    ...d,
                    monthly: d.monthlyAmount || d.monthly || 0,
                    yearly: d.yearlyAmount || d.yearly || (d.monthlyAmount * 12) || 0
                }));
                const benefits = (salarySnapshot.benefits || []).map(b => ({
                    ...b,
                    monthly: b.monthlyAmount || b.monthly || 0,
                    yearly: b.yearlyAmount || b.yearly || (b.monthlyAmount * 12) || 0
                }));

                const grossAAnnual = salarySnapshot.summary?.grossEarnings || salarySnapshot.breakdown?.totalEarnings || earnings.reduce((sum, e) => sum + e.yearly, 0);
                const grossBListRaw = benefits.filter(b => /bonus|lta|leave|variable|annual|performance/i.test(b.name || ''));
                const grossCListRaw = benefits.filter(b => !/bonus|lta|leave|variable|annual|performance/i.test(b.name || ''));
                const grossBAnnualTotal = grossBListRaw.reduce((sum, b) => sum + (b.yearly || 0), 0);
                const grossCAnnualTotal = grossCListRaw.reduce((sum, b) => sum + (b.yearly || 0), 0);
                const totalDeductionsAnnual = salarySnapshot.summary?.totalDeductions || salarySnapshot.breakdown?.totalDeductions || deductions.reduce((sum, d) => sum + d.yearly, 0);
                const totalCTCAnnual = salarySnapshot.ctc || salarySnapshot.annualCTC || (grossAAnnual + grossBAnnualTotal + grossCAnnualTotal);
                const netAnnual = salarySnapshot.summary?.netPay || salarySnapshot.breakdown?.netPay || (grossAAnnual - totalDeductionsAnnual);

                salaryTotals = {
                    grossA: { monthly: Math.round(grossAAnnual / 12), yearly: Math.round(grossAAnnual) },
                    grossB: { monthly: Math.round(grossBAnnualTotal / 12), yearly: Math.round(grossBAnnualTotal) },
                    grossC: { monthly: Math.round(grossCAnnualTotal / 12), yearly: Math.round(grossCAnnualTotal) },
                    deductions: { monthly: Math.round(totalDeductionsAnnual / 12), yearly: Math.round(totalDeductionsAnnual) },
                    net: { monthly: Math.round(netAnnual / 12), yearly: Math.round(netAnnual) },
                    computedCTC: { monthly: Math.round(totalCTCAnnual / 12), yearly: Math.round(totalCTCAnnual) }
                };
            }
        } catch (snapErr) {
            console.warn("⚠️ [OFFER LETTER] Failed to fetch salary snapshot:", snapErr.message);
        }
        // -----------------------

        let relativePath;
        let downloadUrl;
        let templateType = template.templateType;
        let pdfFileName; // Store filename for database
        let htmlContent = ''; // Initialize for dynamic snapshotting
        let generatedLetterId = null;
        let queueCloudUpload = null;
        let generatedVariables = {};
        let missingVariables = [];
        let generatedDocxPath = '';
        let generatedHtmlPath = '';

        if (template.templateType === 'WORD') {
            // Handle Word template processing
            // // console.log('🔥 [OFFER LETTER] Processing Word template (Sync using LibreOffice)');

            if (!template.filePath) {
                console.error('❌ [OFFER LETTER] Template filePath is missing in database');
                return res.status(400).json({
                    message: "Template file path is missing. Please re-upload the template.",
                    code: "FILE_PATH_MISSING"
                });
            }

            // Normalize file path
            const normalizedFilePath = normalizeFilePath(template.filePath);
            // // console.log('🔥 [OFFER LETTER] Original filePath:', template.filePath);
            // // console.log('🔥 [OFFER LETTER] Normalized filePath:', normalizedFilePath);

            if (!fs.existsSync(normalizedFilePath)) {
                console.error('❌ [OFFER LETTER] Template file NOT FOUND at path:', normalizedFilePath);
                return res.status(404).json({
                    message: "Word template file not found on server. Please re-upload the template.",
                    code: "FILE_NOT_FOUND"
                });
            }

            // // console.log('✅ [OFFER LETTER] Template file found, reading...');
            const content = await fsPromises.readFile(normalizedFilePath);

            // Initialize Docxtemplater
            const zip = new PizZip(content);
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: function (tag) { return ''; },
                delimiters: { start: '{{', end: '}}' }
            });

            // Prepare data using inputs from Modal + Applicant DB
            const safeString = (val) => (val !== undefined && val !== null ? String(val) : '');

            const baseFatherName = safeString(fatherName || applicant.fatherName).trim();
            const finalRelationType = normalizeRelationType(relationType || applicant.relationType);
            const finalFatherName = baseFatherName;
            const finalRelationAndFather = baseFatherName ? `${finalRelationType} ${baseFatherName}` : '';
            // // console.log('🔥 [OFFER LETTER] Father name source:', {
            //     fromModal: fatherName,
            //     fromDB: applicant.fatherName,
            //     final: finalFatherName
            // });

            // Note: extractPlaceholders() here was a debug-only call (result unused).
            // Removed to avoid extra async file read + ZIP parse on every generation.
            // Placeholder detection is handled below via template.placeholders or extractPlaceholders().

            // Get issued date - From Modal or TODAY's date
            // Format: Do MMM. YYYY (e.g., "16th Jan. 2026")
            // Format: Based on user selection
            const validIssueDate = issueDate ? new Date(issueDate) : new Date();
            const issuedDate = formatCustomDate(validIssueDate, dateFormat);
            // // console.log('📅 [OFFER LETTER] Issued Date set to:', issuedDate, 'Format:', dateFormat);

            const rawName = safeString(name || applicant.name).trim();
            const cleanDearName = safeString(dearName || rawName).trim();
            
            // Avoid doubling salutation if rawName already starts with it
            const salutationPrefix = salutation ? salutation.trim() : '';
            const hasSalutation = salutationPrefix && (
                rawName.toLowerCase().startsWith(salutationPrefix.toLowerCase()) || 
                rawName.toLowerCase().startsWith(salutationPrefix.toLowerCase().replace(/\.$/, ''))
            );
            
            const fullName = hasSalutation ? rawName : `${salutationPrefix ? salutationPrefix + ' ' : ''}${rawName}`.trim();
            const candidateTitle = inferCandidateTitle({
                salutation,
                gender: applicant.gender || candidateDoc?.gender || candidateDoc?.metadata?.gender || employeeDoc?.gender,
                customData
            });
            const finalProbationPeriod = safeString(probationPeriod || customData.probation || customData.probation_period || '3 months');
            
            const finalDearName = cleanDearName;
            const finalCandidateEmail = safeString(applicant.email || customData.email || customData.candidate_email);
            const finalCandidateContact = safeString(pickCandidateContact(applicant) || customData.mobile || customData.phone || customData.contact || customData.contact_no);


            const baseOfferData = {
                ...customRenderData,
                employee_name: fullName,
                candidate_name: fullName,
                'Candidate Name': fullName,
                name: fullName,
                Name: fullName,
                NAME: fullName,
                ApplicantName: fullName,
                CandidateName: fullName,
                candidate_title: candidateTitle,
                candidateTitle,
                title: candidateTitle,
                TITLE: candidateTitle,
                probation: finalProbationPeriod,
                probation_period: finalProbationPeriod,
                probationPeriod: finalProbationPeriod,
                'Probation Period': finalProbationPeriod,
                PROBATION: finalProbationPeriod,

                // Father name - support multiple placeholder variations
                father_name: finalFatherName,
                father_names: finalFatherName,
                fatherName: finalFatherName,
                fatherNames: finalFatherName,
                relation_father_name: finalRelationAndFather,
                father_name_with_relation: finalRelationAndFather,
                FATHER_NAME: finalFatherName,
                FATHER_NAMES: finalFatherName,
                relation_type: finalRelationType,
                relationType: finalRelationType,
                'Relation Type': finalRelationType,
                relationship_type: finalRelationType,
                relationship: finalRelationType,
                RELATION_TYPE: finalRelationType,

                designation: safeString(applicant.requirementId?.jobTitle || applicant.currentDesignation),
                grade: safeString(applicantGrade.name),
                grade_name: safeString(applicantGrade.name),
                grade_code: safeString(applicantGrade.code),
                grade_level: safeString(applicantGrade.level),
                GRADE: safeString(applicantGrade.name),

                // Joining Date
                joining_date: formatCustomDate(joiningDate || applicant.joiningDate, dateFormat),
                joiningDate: formatCustomDate(joiningDate || applicant.joiningDate, dateFormat),
                JOINING_DATE: formatCustomDate(joiningDate || applicant.joiningDate, dateFormat),

                // Location
                location: safeString(location || applicant.location || applicant.workLocation),

                // Address
                address: safeString(address || applicant.address),
                candidate_address: safeString(address || applicant.address),

                // Ref No
                offer_ref_no: safeString(refNo),
                ref_no: safeString(refNo),
                refNo: safeString(refNo),
                ref_code: safeString(refNo),
                reference_number: safeString(refNo),
                reference_no: safeString(refNo),
                REF_NO: safeString(refNo),
                ref: safeString(refNo),
                REF: safeString(refNo),
                Ref: safeString(refNo),
                RefNo: safeString(refNo),
                Reference: safeString(refNo),
                reference: safeString(refNo),

                // Issued Date
                issued_date: issuedDate,
                issuedDate: issuedDate,
                ISSUED_DATE: issuedDate,
                Date: issuedDate,
                DATE: issuedDate,
                today: issuedDate,
                Today: issuedDate,
                current_date: issuedDate,
                issue_date: issuedDate,
                ISSUE_DATE: issuedDate,

                // Dear Name
                dear_name: finalDearName,
                DearName: finalDearName,
                dear_name_only: finalDearName,
                email: finalCandidateEmail,
                Email: finalCandidateEmail,
                candidate_email: finalCandidateEmail,
                'Candidate Email': finalCandidateEmail,
                candidateEmail: finalCandidateEmail,
                EMAIL: finalCandidateEmail,
                mobile: finalCandidateContact,
                phone: finalCandidateContact,
                contact: finalCandidateContact,
                contact_no: finalCandidateContact,
                'Contact No': finalCandidateContact,
                contactNo: finalCandidateContact,
                CONTACT_NO: finalCandidateContact,

                // Signature Placeholders
                SIGNATURE: '{{SIGNATURE}}',
                signature: '{{SIGNATURE}}',
                candidate_signature: '{{SIGNATURE}}'
            };

            // Apply universal salary patches for all possible variations
            let offerData = applyUniversalSalaryPatches(baseOfferData, salarySnapshot, salaryTotals);
            const detectedPlaceholders = sanitizePlaceholderList(
                (template.placeholders && template.placeholders.length ? template.placeholders : await extractPlaceholders(normalizedFilePath))
            );
            const dynamicPayload = buildOfferVariablePayload({
                placeholders: detectedPlaceholders,
                applicant,
                candidate: candidateDoc,
                employee: employeeDoc,
                applicantGrade,
                formData: { refNo, joiningDate, expiryAt, address, department, location, fatherName, relationType, salutation, issueDate, name, dearName, probationPeriod },
                customData,
                dateFormat,
                salarySnapshot,
                salaryTotals
            });
            offerData = { ...offerData, ...dynamicPayload.renderData };
            generatedVariables = dynamicPayload.generatedVariables;
            missingVariables = dynamicPayload.missingVariables;

            const issuedDateStr = issuedDate;

            const finalSalutation = salutation;
            const candidateNameWithSalutation = fullName;

            // // console.log('🔥 [OFFER LETTER] Word template data:', offerData);
            // // console.log('📅 [OFFER LETTER] Issue Date:', issuedDateStr);
            // // console.log('👤 [OFFER LETTER] Salutation:', finalSalutation);
            // // console.log('👤 [OFFER LETTER] Candidate Name (with salutation):', candidateNameWithSalutation);
            // // console.log('📋 [OFFER LETTER] All Date Placeholders:', {
            //     issued_date: issuedDateStr,
            //     Date_odt: issuedDateStr,
            //     Date: issuedDateStr
            // });

            const fileName = `Offer_Letter_${applicantId}_${Date.now()}`;
            const outputDir = path.join(__dirname, '../uploads/offers');
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

            const docxPath = path.join(outputDir, `${fileName}.docx`);
            generatedDocxPath = `offers/${path.basename(docxPath)}`;

            const renderCache = buildLetterRenderCache({
                kind: 'offer',
                template,
                target: applicant,
                snapshot: salarySnapshot,
                payload: {
                    applicantId,
                    refNo,
                    joiningDate,
                    expiryAt,
                    address,
                    department,
                    location,
                    fatherName,
                    relationType,
                    salutation,
                    issueDate,
                    name,
                    dearName,
                    dateFormat,
                    signaturePosition,
                    jobCategory,
                    probationPeriod,
                    customData
                }
            });

            if (fs.existsSync(renderCache.pdfPath) && fs.existsSync(renderCache.docxPath)) {
                await copyIfExists(renderCache.docxPath, docxPath);
                const cachedPdfName = `${fileName}.pdf`;
                const cachedPdfPath = path.join(outputDir, cachedPdfName);
                await copyIfExists(renderCache.pdfPath, cachedPdfPath);
                pdfFileName = cachedPdfName;
                relativePath = `offers/${pdfFileName}`;
                downloadUrl = `/uploads/${relativePath}`;
                if (preview) {
                    const cachedDocxBuffer = await fsPromises.readFile(docxPath);
                    const result = await mammoth.convertToHtml({ buffer: cachedDocxBuffer });
                    htmlContent = `<div class="word-preview-container" style="padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: white; color: #334155; line-height: 1.6; max-width: 900px; margin: 0 auto; box-shadow: 0 0 20px rgba(0,0,0,0.05);">${result.value}</div>`;
                }
            } else {
                // Render the document
                doc.render(offerData);

                // Generate DOCX output
                const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });

                // For WORD offer templates, always use real DOCX -> PDF preview so the
                // preview matches the final generated Labour/Offer letter exactly.
                if (preview) {
                    // // console.log('🔍 [OFFER LETTER] Preview mode using DOCX-to-PDF rendering');
                }

                await fsPromises.writeFile(docxPath, buf);
                await copyIfExists(docxPath, renderCache.docxPath);

                // --- PDF CONVERSION (final issue, or preview) ---
                try {
                    const libreOfficeService = require('../services/LibreOfficeService');
                    // Keep Word template fidelity by default. The fast renderer is only
                    // opt-in because it cannot preserve exact DOCX formatting.
                    const useFastOfferPdf = process.env.OFFER_FAST_PDF === 'true';
                    const pdfAbsolutePath = useFastOfferPdf
                        ? await libreOfficeService.convertDocxToReadablePdf(docxPath, outputDir, {
                            title: `Offer Letter - ${safeString(name || applicant.name)}`
                        })
                        : await libreOfficeService.convertToPdf(docxPath, outputDir);
                    pdfFileName = path.basename(pdfAbsolutePath);
                    await copyIfExists(pdfAbsolutePath, renderCache.pdfPath);

                    relativePath = `offers/${pdfFileName}`;
                    downloadUrl = `/uploads/${relativePath}`;

                    // Optional HTML snapshot for UI fallback
                    if (preview) {
                        const result = await mammoth.convertToHtml({ buffer: buf });
                        htmlContent = `<div class="word-preview-container" style="padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: white; color: #334155; line-height: 1.6; max-width: 900px; margin: 0 auto; box-shadow: 0 0 20px rgba(0,0,0,0.05);">${result.value}</div>`;
                    }

                    // --- DYNAMIC SNAPSHOT UPGRADE ---
                    // Deferred to background: HTML snapshot is non-critical for the HTTP response.
                    // Running it inline was adding latency to every WORD offer letter generation.
                    if (!preview) {
                        setImmediate(async () => {
                            try {
                                const htmlAbsolutePath = await libreOfficeService.convertToHtmlAsync(docxPath, outputDir);
                                const htmlRawContent = await fsPromises.readFile(htmlAbsolutePath, 'utf-8');
                                try { await fsPromises.unlink(htmlAbsolutePath); } catch (e) { }
                            } catch (htmlErr) {
                                console.warn('⚠️ [OFFER LETTER] HTML snapshot (background) failed:', htmlErr.message);
                            }
                        });
                    }
                } catch (pdfError) {
                    console.error('⚠️ [OFFER LETTER] PDF Conversion Failed:', pdfError.message);
                    return res.status(500).json({
                        message: "PDF Generation Failed. Please ensure LibreOffice is installed.",
                        error: pdfError.message
                    });
                }
            }

        } else {
            // Handle HTML template processing (Now using LibreOffice)
            // // console.log('🔥 [OFFER LETTER] Processing HTML template (Sync using LibreOffice)');

            const baseFatherName = safeString(fatherName || applicant.fatherName).trim();
            const finalRelationType = normalizeRelationType(relationType || applicant.relationType);
            const finalFatherName = baseFatherName;
            const finalRelationAndFather = baseFatherName ? `${finalRelationType} ${baseFatherName}` : '';
            const candidateTitle = inferCandidateTitle({
                salutation,
                gender: applicant.gender || candidateDoc?.gender || candidateDoc?.metadata?.gender || employeeDoc?.gender,
                customData
            });
            const finalProbationPeriod = safeString(probationPeriod || customData.probation || customData.probation_period || '3 months');

            // Get issued date - From Modal or TODAY
            const validIssueDate = issueDate ? new Date(issueDate) : new Date();
            const issuedDate = formatCustomDate(validIssueDate, dateFormat);
            const issuedDateStr = issuedDate;

            const rawName = safeString(name || applicant.name).trim();
            const cleanDearName = safeString(dearName || rawName).trim();
            
            const salutationPrefix = salutation ? salutation.trim() : '';
            const hasSalutation = salutationPrefix && (
                rawName.toLowerCase().startsWith(salutationPrefix.toLowerCase()) || 
                rawName.toLowerCase().startsWith(salutationPrefix.toLowerCase().replace(/\.$/, ''))
            );
            
            const fullName = hasSalutation ? rawName : `${salutationPrefix ? salutationPrefix + ' ' : ''}${rawName}`.trim();
            const finalDearName = cleanDearName;
            const finalCandidateEmail = safeString(applicant.email || customData.email || customData.candidate_email);
            const finalCandidateContact = safeString(pickCandidateContact(applicant) || customData.mobile || customData.phone || customData.contact || customData.contact_no);

            const replacements = {
                ...customRenderData,
                employee_name: fullName,
                candidate_name: fullName,
                'Candidate Name': fullName,
                name: fullName,
                father_name: finalFatherName,
                father_names: finalFatherName,
                relation_father_name: finalRelationAndFather,
                father_name_with_relation: finalRelationAndFather,
                candidate_title: candidateTitle,
                candidateTitle,
                title: candidateTitle,
                TITLE: candidateTitle,
                probation: finalProbationPeriod,
                probation_period: finalProbationPeriod,
                probationPeriod: finalProbationPeriod,
                'Probation Period': finalProbationPeriod,
                PROBATION: finalProbationPeriod,
                relation_type: finalRelationType,
                relationType: finalRelationType,
                'Relation Type': finalRelationType,
                relationship_type: finalRelationType,
                relationship: finalRelationType,
                RELATION_TYPE: finalRelationType,
                designation: safeString(applicant.requirementId?.jobTitle || applicant.currentDesignation),
                grade: safeString(applicantGrade.name),
                grade_name: safeString(applicantGrade.name),
                grade_code: safeString(applicantGrade.code),
                grade_level: safeString(applicantGrade.level),
                GRADE: safeString(applicantGrade.name),
                joining_date: safeString(joiningDate ? formatCustomDate(joiningDate, dateFormat) : (applicant.joiningDate ? formatCustomDate(applicant.joiningDate, dateFormat) : '')),
                location: safeString(location || applicant.location || applicant.workLocation),
                address: safeString(address || applicant.address),
                offer_ref_no: safeString(refNo),
                issued_date: issuedDateStr,
                issuedDate: issuedDateStr,
                ISSUED_DATE: issuedDateStr,
                current_date: issuedDateStr,
                Date: issuedDateStr,
                DATE: issuedDateStr,
                Date_odt: issuedDateStr,
                date_odt: issuedDateStr,
                DATE_ODT: issuedDateStr,
                dear_name: finalDearName,
                dearName: finalDearName,
                DearName: finalDearName,
                dear_name_only: finalDearName,
                email: finalCandidateEmail,
                Email: finalCandidateEmail,
                candidate_email: finalCandidateEmail,
                'Candidate Email': finalCandidateEmail,
                candidateEmail: finalCandidateEmail,
                EMAIL: finalCandidateEmail,
                mobile: finalCandidateContact,
                phone: finalCandidateContact,
                contact: finalCandidateContact,
                contact_no: finalCandidateContact,
                'Contact No': finalCandidateContact,
                contactNo: finalCandidateContact,
                CONTACT_NO: finalCandidateContact
            };

            const htmlDetectedPlaceholders = sanitizePlaceholderList(
                (template.placeholders && template.placeholders.length)
                    ? template.placeholders
                    : extractPlaceholdersFromText(template.bodyContent || '')
            );
            const dynamicPayload = buildOfferVariablePayload({
                placeholders: htmlDetectedPlaceholders,
                applicant,
                candidate: candidateDoc,
                employee: employeeDoc,
                applicantGrade,
                formData: { refNo, joiningDate, expiryAt, address, department, location, fatherName, relationType, salutation, issueDate, name, dearName, probationPeriod },
                customData,
                dateFormat,
                salarySnapshot,
                salaryTotals
            });
            Object.assign(replacements, dynamicPayload.renderData);
            generatedVariables = dynamicPayload.generatedVariables;
            missingVariables = dynamicPayload.missingVariables;

            htmlContent = template.bodyContent || '';
            htmlContent = replaceTemplateVariables(htmlContent, replacements);

            // BUILD ROBUST HTML FOR PDF GENERATION
            // This structure mimics the frontend OfferLetterPreview exactly

            // 1. Prepare Background Logic
            let backgroundStyle = '';
            if (template.templateType === 'LETTER_PAD' && company?.branding?.letterheadBg) {
                // Construct absolute URL for background image
                const bgPath = company.branding.letterheadBg;
                const baseUrl = process.env.VITE_API_URL || `${req.protocol}://${req.get('host')}`;
                const bgUrl = bgPath.startsWith('http') ? bgPath : `${baseUrl}${bgPath.startsWith('/') ? '' : '/'}${bgPath}`.replace(/\\/g, '/');

                backgroundStyle = `
                    background-image: url('${bgUrl}');
                    background-size: 210mm 297mm;
                    background-repeat: no-repeat;
                    background-position: center;
                `;
            }

            // 2. Prepare Margins Logic
            const margins = template.pageLayout?.margins || { top: 25, bottom: 25, left: 25, right: 25 };
            const mTop = (template.hasHeader ? (template.headerHeight || 40) : margins.top) + 'mm';
            const mBottom = (template.hasFooter ? (template.footerHeight || 30) : margins.bottom) + 'mm';
            const mLeft = (margins.left || 25) + 'mm';
            const mRight = (margins.right || 25) + 'mm';

            // 3. Construct Full Document
            htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Google Fonts link removed: external fetch blocks Puppeteer PDF generation by 2-8s -->
    <!-- Using system fonts below instead -->
    <style>
        @font-face {
            font-family: 'Inter';
            src: local('Segoe UI'), local('Arial'), local('Helvetica Neue');
        }
        /* CSS Synchronized with document.css */
        @page {
            size: A4;
            margin: 0;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
        }
        body {
            margin: 0;
            padding: 0;
            background-color: #f3f4f6;
            font-family: 'Inter', Arial, sans-serif;
            color: #000;
        }
        .a4-page {
            width: 210mm;
            min-height: 297mm;
            background-color: #ffffff;
            margin: 0 auto;
            position: relative;
            /* Removed overflow:hidden to support multi-page letters */
            ${backgroundStyle}
        }
        .header-spacer { height: ${template.hasHeader ? (template.headerHeight || 40) : 0}mm; }
        .footer-spacer { height: ${template.hasFooter ? (template.footerHeight || 30) : 0}mm; }
        
        .main-content {
            padding-top: ${template.hasHeader ? 0 : '20mm'};
            padding-bottom: ${template.hasFooter ? 0 : '20mm'};
            padding-left: 15mm;
            padding-right: 15mm;
            line-height: 1.5;
            font-size: 11pt;
            color: #111827;
        }
        
        .formatted-content p { margin: 0 0 10pt 0; line-height: 1.5; }
        .formatted-content h1, .formatted-content h2, .formatted-content h3 { margin-top: 15pt; margin-bottom: 10pt; color: #111827; }
        table { border-collapse: collapse; width: 100% !important; border: 1px solid #000; margin-bottom: 15pt; table-layout: fixed; }
        td, th { border: 1px solid #000; padding: 8pt; vertical-align: top; word-break: break-word; }
        img { max-width: 100%; height: auto; display: block; margin: 10pt 0; }
        
        /* List styles synchronized with document.css */
        ul, ol { padding-left: 30pt; margin-bottom: 12pt; }
        li { margin-bottom: 6pt; padding-left: 5pt; }
        
        /* Letter Style Specifics */
        .issue-date {
            position: absolute;
            top: 15mm;
            right: 15mm;
            font-size: 11pt;
            font-weight: 500;
            color: #1f2937;
        }
    </style>
</head>
<body>
    <div class="a4-page">
        <!-- Optional Issue Date Overlay -->
        <div class="issue-date">Date: ${issuedDateStr}</div>

        <!-- Header Padding -->
        <div class="header-spacer"></div>

        <!-- Letter Body -->
        <div class="main-content formatted-content">
            ${htmlContent}
        </div>

        <!-- Footer Padding -->
        <div class="footer-spacer"></div>
    </div>
</body>
</html>`;

            const fileName = `Offer_Letter_${applicantId}_${Date.now()}`;
            const outputDir = path.join(__dirname, '../uploads/offers');
            if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

            const htmlPath = path.join(outputDir, `${fileName}.html`);
            await fsPromises.writeFile(htmlPath, htmlContent);
            generatedHtmlPath = `offers/${path.basename(htmlPath)}`;

            if (preview) {
                // Skip slow PDF conversion for HTML previews
                relativePath = null;
                downloadUrl = null;
            } else {
                try {
                    const libreOfficeService = require('../services/LibreOfficeService');
                    const pdfAbsolutePath = await libreOfficeService.convertToPdf(htmlPath, outputDir);
                    pdfFileName = path.basename(pdfAbsolutePath);
                    relativePath = `offers/${pdfFileName}`;
                    downloadUrl = `/uploads/${relativePath}`;
                } catch (pdfError) {
                    console.error('⚠️ [OFFER LETTER] HTML-to-PDF Conversion Failed:', pdfError.message);
                    return res.status(500).json({ message: "PDF Generation Failed", error: pdfError.message });
                }
            }
        }

        // Validate expiryAt (mandatory for offer send/generation; preview can skip)
        let expiryAtDate = null;
        if (expiryAt) {
            expiryAtDate = new Date(expiryAt);
            if (Number.isNaN(expiryAtDate.getTime())) {
                return res.status(400).json({ message: "Invalid expiryAt datetime" });
            }
        }
        if (!preview) {
            if (!expiryAtDate) {
                return res.status(400).json({ message: "Offer Expiry Date & Time is required", code: "MISSING_EXPIRY" });
            }
            if (expiryAtDate <= new Date(Date.now() - 300000)) {
                return res.status(400).json({ message: "Offer expiry must be a future datetime", code: "EXPIRY_NOT_FUTURE" });
            }
            // Determine Generation Mode
            // WORD templates now use 'dynamic' if HTML snapshot was successful
            // This enables dynamic signature injection for ALL letter types
            const generationMode = htmlContent ? 'dynamic' : (template.templateType === 'WORD' ? 'static' : 'dynamic');

            // Cloudinary: Upload generated offer letter in background.
            // The local PDF is already ready, so do not block HR while network upload finishes.
            const CloudinaryService = require("../services/CloudinaryService");
            if (CloudinaryService.isConfigured()) {
                const tenantForUpload = req.tenantId || req.user?.tenantId;
                const localRelativePath = relativePath;
                queueCloudUpload = async (letterId) => {
                    try {
                        const pdfAbsolutePath = path.isAbsolute(localRelativePath)
                            ? localRelativePath
                            : path.join(process.cwd(), 'uploads', localRelativePath);

                        const cloudRes = await CloudinaryService.uploadFile(
                            pdfAbsolutePath,
                            `hrms/${tenantForUpload}/generated_letters/offer`,
                            false
                        );
                        await GeneratedLetter.findByIdAndUpdate(letterId, { pdfUrl: cloudRes.url });
                    } catch (err) {
                        console.warn("[generateOfferLetter] PDF cloud upload failed:", err.message);
                    }
                };
            }

            // Resolve the approver user if requiresOfferApproval
            let approverUser = null;
            if (requiresOfferApproval && approverId) {
                try {
                    const { User } = getModels(req);
                    approverUser = await User.findOne({
                        _id: approverId,
                        mainCompanyId: req.tenantId || req.user.tenantId
                    });
                } catch (e) {
                    console.error("⚠️ Failed to pre-fetch approverUser:", e);
                }
            }
            let approverEmailToSave = approverUser ? approverUser.email : (normalizedApproverEmail || null);

            // Save generated letter record
            const generated = new GeneratedLetter({
                tenant: req.tenantId || req.user?.tenantId || req.user?.companyId,
                applicantId: applicantId,
                templateId,
                templateType, // 'WORD' or 'BLANK'/'LETTER_PAD'
                letterType: 'offer',
                pdfPath: relativePath,
                docxPath: generatedDocxPath || undefined,
                htmlPath: generatedHtmlPath || undefined,
                generatedHtml: htmlContent || undefined,
                generatedPdf: relativePath,
                generatedDocx: generatedDocxPath || undefined,
                generatedVariables,
                missingVariables,
                pdfUrl: downloadUrl,
                status: requiresOfferApproval ? 'pending' : 'generated',
                approvalStatus: requiresOfferApproval ? 'PENDING_APPROVAL' : undefined,
                approverEmail: approverEmailToSave,
                snapshotData: {
                    gradeId: applicantGrade.id,
                    grade: applicantGrade.name,
                    gradeCode: applicantGrade.code,
                    gradeLevel: applicantGrade.level,
                    customData,
                    generatedVariables,
                    missingVariables
                },
                generatedBy: req.user?.id || req.user?.userId,
                signaturePosition: signaturePosition || { alignment: 'right' },
                generationMode,
                pdfVersion: 1,
                templateSnapshot: {
                    name: template.templateName || template.name,
                    bodyContent: htmlContent || '', // Store final rendered HTML (populated even for WORD now)
                    headerContent: template.headerContent || '',
                    footerContent: template.footerContent || '',
                    version: typeof template.version === 'number' ? template.version : (parseFloat(template.version) || 1)
                }
            });
            fs.appendFileSync(logFile, `💾 Saving GeneratedLetter for tenant: ${generated.tenant}\n`);
            await generated.save();
            generatedLetterId = generated._id;
            let offerWorkflowStarted = false;

            if (requiresOfferApproval) {
                try {
                    const { resolveEmployeeForUser } = require('../services/approverResolver.service');
                    const requesterEmployee = await resolveEmployeeForUser(req, req.tenantDB);
                    const requesterEmployeeId = requesterEmployee?._id || req.user?.employeeId || null;

                    if (req.body.customWorkflow) {
                        offerWorkflowStarted = true;
                        generated.workflowStatus = 'PENDING';
                        generated.approvalStatus = 'PENDING_APPROVAL';
                        await generated.save();
                    } else {
                        const { startWorkflow } = require('../services/workflowStart.service');
                        const workflowResult = await startWorkflow({
                            tenantDB: req.tenantDB,
                            tenantId: req.tenantId || req.user.tenantId,
                            moduleKey: 'recruitment',
                            entityType: 'GeneratedLetter',
                            entityId: generated._id,
                            requesterEmployeeId,
                            requesterUserId: req.user?.id || req.user?.userId,
                            contextSnapshot: {
                                applicantId: applicant._id.toString(),
                                tenantId: (req.tenantId || req.user.tenantId).toString(),
                                letterType: 'offer',
                                candidateName: applicant.name,
                                jobTitle: applicant.requirementId?.jobTitle || 'Role',
                                requestedApprovalChain: ['DEPARTMENT_HEAD', 'CEO']
                            },
                            req
                        });

                        if (workflowResult.started) {
                            offerWorkflowStarted = true;
                            generated.workflowInstanceId = workflowResult.instance._id;
                            generated.workflowStatus = 'PENDING';
                            generated.approvalStatus = 'PENDING_APPROVAL';
                            const firstAssignment = workflowResult.assignments?.[0];
                            if (firstAssignment?.assigneeEmployeeId) {
                                const firstApprover = await Employee.findById(firstAssignment.assigneeEmployeeId).select('email').lean();
                                approverEmailToSave = firstApprover?.email || approverEmailToSave;
                                generated.approverEmail = approverEmailToSave || null;
                            }
                            await generated.save();
                        } else {
                            console.error("⚠️ [generateOfferLetter] Universal Workflow failed to start:", workflowResult.reason);
                            fs.appendFileSync(logFile, `⚠️ Universal Workflow failed to start: ${workflowResult.reason}\n`);
                        }
                    }
                } catch (approvalErr) {
                    console.error("⚠️ [generateOfferLetter] Universal Workflow creation failed:", approvalErr);
                    fs.appendFileSync(logFile, `⚠️ Universal Workflow creation failed: ${approvalErr.message}\n`);
                }
            }

            if (AuditLog) {
                try {
                    await AuditLog.create({
                        tenant: req.tenantId || req.user?.tenantId || req.user?.companyId,
                        entity: 'GeneratedOffer',
                        entityId: generated._id,
                        action: 'OFFER_GENERATED',
                        performedBy: req.user?.id || req.user?.userId,
                        changes: {
                            before: null,
                            after: {
                                applicantId,
                                templateId,
                                pdfPath: relativePath,
                                docxPath: generatedDocxPath,
                                variables: generatedVariables,
                                missingVariables
                            }
                        },
                        meta: {
                            templateName: template.name,
                            detectedVariables: Object.keys(generatedVariables || {})
                        }
                    });
                } catch (auditErr) {
                    console.warn('⚠️ [OFFER LETTER] Audit log failed:', auditErr.message);
                }
            }
            if (queueCloudUpload) {
                setImmediate(() => queueCloudUpload(generatedLetterId));
            }

            // Prepare update data for applicant (Save the inputs)
            // Store just the filename, not the full path to avoid duplicate /offers/ in URL
            const storedFileName = pdfFileName || (relativePath ? path.basename(relativePath) : '');
            const updateData = {
                offerLetterPath: storedFileName,
                offerRefCode: refNo,
                status: requiresOfferApproval ? 'Offer Pending Approval' : 'Offer Issued',
                offerExpiryAt: expiryAtDate,
                offerStatus: requiresOfferApproval ? 'PENDING_APPROVAL' : 'SENT',
                jobCategory: jobCategory || 'Full Time'
            };

            if (joiningDate) updateData.joiningDate = new Date(joiningDate);
            if (address) updateData.address = address;
            if (department) updateData.department = department;
            if (applicantGrade.id) {
                updateData.gradeId = applicantGrade.id;
                updateData.gradeSnapshot = {
                    id: applicantGrade.id,
                    name: applicantGrade.name,
                    code: applicantGrade.code,
                    level: applicantGrade.level || null
                };
            }
            if (location) updateData.location = location;
            if (fatherName) updateData.fatherName = fatherName; // Persist Father Name
            if (relationType) updateData.relationType = normalizeRelationType(relationType); // Persist Relation Type
            if (salutation) updateData.salutation = salutation; // Persist Salutation

            const { Applicant: ApplicantModel } = getModels(req);
            const updatedApplicant = await ApplicantModel.findById(applicantId).populate('requirementId').populate('salarySnapshotId');
            if (!updatedApplicant) throw new Error("Applicant record lost during generation");

            // Controlled revise/versioning: only revise when previously expired
            const now = new Date();
            const isCurrentlyExpired = updatedApplicant?.offerStatus === 'SENT'
                && updatedApplicant?.offerExpiryAt
                && now > new Date(updatedApplicant.offerExpiryAt);
            if (isCurrentlyExpired) {
                updatedApplicant.offerStatus = 'EXPIRED';
                if (!updatedApplicant.timeline) updatedApplicant.timeline = [];
                updatedApplicant.timeline.push({
                    status: 'Offer Expired',
                    message: 'Offer expired automatically (system).',
                    updatedBy: 'System',
                    timestamp: new Date()
                });
            }

            const isRevise = updatedApplicant?.offerStatus === 'EXPIRED' || updatedApplicant?.offerStatus === 'REQUESTED' || updatedApplicant?.offerStatus === 'REJECTED' || updatedApplicant?.offerRevisionRequested;
            if (isRevise) {
                updateData.offerVersion = (Number(updatedApplicant.offerVersion || 1) + 1);
                // Mark previous as revised or handle new issuance
                updatedApplicant.offerStatus = 'REVISED';
                // ALWAYS Clear the candidate's revision request flag when HR generates a new offer
                updateData.offerRevisionRequested = false;
                updateData.revisionRequestedAt = null;
            } else {
                // First time send
                updateData.offerVersion = Number(updatedApplicant.offerVersion || 1) || 1;
            }

            // Apply updates
            Object.keys(updateData).forEach(key => {
                if (updateData[key] !== undefined) {
                    updatedApplicant[key] = updateData[key];
                }
            });

            if (!updatedApplicant.timeline) updatedApplicant.timeline = [];
            updatedApplicant.timeline.push({
                status: requiresOfferApproval ? 'Offer Pending Approval' : 'Offer Issued',
                message: requiresOfferApproval
                    ? `Offer Letter Generated(${refNo}) and sent to ${approverEmailToSave || 'approver'} for approval. Candidate will receive it only after approval.`
                    : `🎉 Offer Letter Generated(${refNo}). Joining date: ${joiningDate ? new Date(joiningDate).toLocaleDateString('en-IN') : 'TBD'}. Valid till: ${expiryAtDate ? expiryAtDate.toLocaleString('en-IN') : 'N/A'}.`,
                updatedBy: req.user?.name || "HR",
                timestamp: new Date()
            });

            await updatedApplicant.save();

            // --- INCREMENT OFFER COUNTER ---
            try {
                const companyIdConfig = require('./companyIdConfig.controller');
                const deptName = updatedApplicant.requirementId?.department?.name || 'GEN';
                const deptCode = deptName.substring(0, 3).toUpperCase();

                await companyIdConfig.generateIdInternal({
                    tenantId: req.user?.tenantId || req.tenantId,
                    entityType: 'OFFER',
                    increment: true,
                    extraReplacements: {
                        '{{DEPT}}': deptCode
                    }
                });
                // // console.log('✅ [OFFER LETTER] Incrementing sequence for OFFER');
            } catch (idErr) {
                console.warn("⚠️ [OFFER LETTER] Could not increment sequence:", idErr.message);
            }

            // -----------------------------------------------------
            // NOTIFICATIONS & EMAILS
            // -----------------------------------------------------
            // SMTP/network work can take many seconds. Queue it after the offer is
            // saved so the Generate button returns as soon as the PDF is ready.
            const notificationPayload = {
                tenantId: req.tenantId || req.user.tenantId,
                userTenantId: req.user.tenantId,
                email: updatedApplicant.email,
                name: updatedApplicant.name,
                candidateId: updatedApplicant.candidateId,
                jobTitle: updatedApplicant.requirementId?.jobTitle || 'Role',
                attachmentPath: path.join(__dirname, '../uploads', relativePath),
                generatedId: generated._id,
                ctcYearly: updatedApplicant.ctcYearly || updatedApplicant.expectedCTC || updatedApplicant.currentCTC,
                department: updatedApplicant.department || updatedApplicant.requirementId?.department,
                joiningDate: updatedApplicant.joiningDate,
                applicant: updatedApplicant
            };

            setImmediate(async () => {
                try {
                    const { CompanyProfile, Notification } = getModels(req);
                    const companyProfile = await CompanyProfile.findOne({ tenantId: notificationPayload.userTenantId });
                    const companyName = companyProfile?.companyName || 'Gitakshmi Technologies';

                    if (requiresOfferApproval) {
                        if (offerWorkflowStarted) return;
                        if (approverEmailToSave) {
                            const approvalUrl = buildOfferApprovalUrl(req, notificationPayload.generatedId, notificationPayload.tenantId);
                            await emailService.sendOfferApprovalRequestEmail(
                                approverEmailToSave,
                                notificationPayload.name,
                                notificationPayload.jobTitle,
                                companyName,
                                notificationPayload.attachmentPath,
                                approvalUrl,
                                null,
                                {
                                    ctcYearly: notificationPayload.ctcYearly,
                                    department: notificationPayload.department,
                                    joiningDate: notificationPayload.joiningDate,
                                    applicant: notificationPayload.applicant
                                },
                                '', // approverRole
                                notificationPayload.tenantId // tenantId
                            );
                        }
                    } else {
                        if (notificationPayload.email) {
                            await emailService.sendOfferLetterEmail(
                                notificationPayload.email,
                                notificationPayload.name,
                                notificationPayload.jobTitle,
                                companyName,
                                notificationPayload.attachmentPath,
                                null, // customHtml
                                notificationPayload.applicant, // applicant
                                notificationPayload.tenantId // tenantId
                            );
                        }

                        if (notificationPayload.candidateId && Notification) {
                            await Notification.create({
                                tenant: notificationPayload.tenantId,
                                receiverId: notificationPayload.candidateId,
                                receiverRole: 'candidate',
                                entityType: 'OfferLetter',
                                entityId: notificationPayload.generatedId,
                                title: 'Offer Letter Issued',
                                message: `Congratulations! Your offer letter for ${notificationPayload.jobTitle} has been issued. Please check your email or download it from here.`,
                                isRead: false
                            });
                        }
                    }
                } catch (notifyErr) {
                    console.error("⚠️ [OFFER LETTER] Failed to send notifications:", notifyErr.message);
                }
            });
        }

        res.json({
            success: true,
            isPreview: !!preview,
            downloadUrl: downloadUrl,
            htmlContent: preview ? htmlContent : undefined,
            previewFilePath: preview && relativePath ? relativePath : undefined,
            viewUrl: generatedLetterId ? `/api/public/letters/${generatedLetterId}/view-pdf` : downloadUrl,
            generatedLetterId,
            letterId: generatedLetterId,
            pdfPath: relativePath,
            templateType: template.templateType,
            generatedVariables,
            missingVariables,
            warnings: missingVariables.length ? missingVariables.map((variable) => `Variable data missing: ${variable}`) : [],
            message: preview ? "Offer Letter Preview Generated Successfully" : "Offer Letter Generated Successfully"
        });

    } catch (error) {
        const logFile = path.join(process.cwd(), 'generation_debug.log');
        console.error("🔥 [OFFER LETTER] FATAL ERROR:", error);
        fs.appendFileSync(logFile, `❌ FATAL ERROR: ${error.message}\nStack: ${error.stack}\n`);

        // 🔎 STEP 1: Structured Error Response with diagnostic info
        const errorDiagnostic = {
            applicantId: req.body.applicantId,
            templateId: req.body.templateId,
            refNo: req.body.refNo,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        };
        console.error("📋 [DIAGNOSTIC DATA]:", JSON.stringify(errorDiagnostic, null, 2));

        res.status(500).json({
            success: false,
            message: "Offer letter generation failed",
            error: error.message
        });
    }
};

exports.previewGeneratedFile = async (req, res) => {
    try {
        const resolved = resolveGeneratedPreviewPath(req.query.path);
        if (!resolved) {
            return res.status(400).json({
                success: false,
                message: 'Invalid preview file path'
            });
        }

        const extension = path.extname(resolved.absolutePath).toLowerCase();
        const contentType = GENERATED_PREVIEW_CONTENT_TYPES[extension];
        if (!contentType) {
            return res.status(400).json({
                success: false,
                message: 'Preview is only available for generated PDF or HTML files'
            });
        }

        if (!fs.existsSync(resolved.absolutePath)) {
            return res.status(404).json({
                success: false,
                message: 'Generated preview file was not found on this server'
            });
        }

        const fileName = path.basename(resolved.absolutePath).replace(/"/g, '');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");

        return res.sendFile(resolved.absolutePath);
    } catch (error) {
        console.error('[OFFER PREVIEW FILE] Failed to serve generated preview:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to load generated preview file',
            error: error.message
        });
    }
};

exports.downloadLetterPDF = async (req, res) => {
    try {
        const { imageData } = req.body;
        const result = await letterPDFGenerator.generatePDF(imageData);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getHistory = async (req, res) => {
    try {
        // Get tenant-specific model
        const { GeneratedLetter } = getModels(req);

        const history = await GeneratedLetter.find({ tenant: req.user.tenantId })
            .sort('-createdAt')
            .populate('applicantId', 'name');
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

/**
 * PREVIEW JOINING LETTER WITH APPLICANT DATA (Word -> PDF)
 * - Load Word Template
 * - Replace placeholders with real applicant data
 * - Convert to PDF (temporary)
 * - Return preview URL
 */
exports.previewJoiningLetter = async (req, res) => {
    try {
        const { applicantId, employeeId, templateId, refNo, issueDate, signaturePosition, customData = {}, dateFormat = 'Do MMM. YYYY' } = req.body;
        const Applicant = getApplicantModel(req);
        const { Employee, LetterTemplate } = getModels(req);

        // Fetch target
        let target;
        let targetType;
        if (employeeId) {
            target = await Employee.findById(employeeId);
            targetType = 'employee';
        } else {
            target = await Applicant.findById(applicantId).populate('requirementId');
            targetType = 'applicant';
        }

        if (!target) {
            return res.status(404).json({ message: "Employee/Applicant not found" });
        }

        // Check if salary is finalized (unless Intern)
        if (!target.salaryLocked && target.jobCategory !== 'Intern') {
            console.error('🔥 [PREVIEW JOINING LETTER] Warning: Salary not locked for', targetType, target._id);
            // We still allow previewing for unlocked salaries to let HR see the template
        }

        // Build query - handle missing req.user gracefully
        const templateQuery = { _id: templateId };
        if (req.user?.tenantId) {
            templateQuery.tenantId = req.user.tenantId;
        }

        const template = await LetterTemplate.findOne(templateQuery);

        if (!template) {
            console.error('🔥 [PREVIEW JOINING LETTER] Template not found:', templateId);
            return res.status(404).json({ message: "Template not found" });
        }

        // Validate template type. Keep preview aligned with final generation,
        // which supports both joining and appointment Word templates.
        const validJoiningTypes = ['joining', 'appointment', 'Joining', 'Appointment'];
        if (!validJoiningTypes.includes(template.type) || template.templateType !== 'WORD') {
            console.error('🔥 [PREVIEW JOINING LETTER] Invalid template type or templateType:', template.type, template.templateType);
            return res.status(400).json({ message: "Invalid template. Only WORD-based Joining/Appointment templates are supported." });
        }

        // 1. Validate and normalize file path
        if (!template.filePath) {
            console.error('🔥 [PREVIEW JOINING LETTER] Template filePath is missing in database');
            return res.status(400).json({
                message: "Template file path is missing. Please re-upload the template.",
                code: "FILE_PATH_MISSING"
            });
        }

        // Normalize file path (handle both absolute and relative paths)
        const normalizedFilePath = normalizeFilePath(template.filePath);
        // // console.log('🔥 [PREVIEW JOINING LETTER] Original filePath:', template.filePath);
        // // console.log('🔥 [PREVIEW JOINING LETTER] Normalized filePath:', normalizedFilePath);

        // Check if file exists
        if (!fs.existsSync(normalizedFilePath)) {
            console.error('❌ [PREVIEW JOINING LETTER] Template file NOT FOUND at path:', normalizedFilePath);
            console.error('❌ [PREVIEW JOINING LETTER] Original path from DB:', template.filePath);
            console.error('❌ [PREVIEW JOINING LETTER] Template ID:', template._id);
            console.error('❌ [PREVIEW JOINING LETTER] Template name:', template.name);

            // Return 404 with clear message and actionable error code
            return res.status(404).json({
                message: `Template file not found on server at path: ${normalizedFilePath}. Please re - upload the template.`,
                code: "FILE_NOT_FOUND",
                templateId: template._id.toString(),
                filePath: normalizedFilePath
            });
        }

        const syntaxCheck = await validateWordTemplateSyntax(normalizedFilePath);
        if (!syntaxCheck.valid) {
            return res.status(400).json({
                message: syntaxCheck.message,
                code: 'INVALID_TEMPLATE_SYNTAX',
                details: syntaxCheck.details
            });
        }

        // // console.log('✅ [PREVIEW JOINING LETTER] Template file found, reading...');
        const content = await fsPromises.readFile(normalizedFilePath);

        // 2. Initialize Docxtemplater SAFE MODE
        let doc;
        try {
            const zip = new PizZip(content);
            doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
                nullGetter: function (tag) { return ''; }, // Return empty string for ANY missing tag
                delimiters: { start: '{{', end: '}}' }
            });
        } catch (error) {
            console.error('🔥 [PREVIEW JOINING LETTER] Docxtemplater Init Failed:', error);
            return res.status(400).json({ message: "Template load failed", error: error.message });
        }

        // 3. Prepare Data - prefer immutable snapshot, fallback to active SalaryAssignment/template.
        let snapshot = await resolveLetterSalarySnapshot(req, { employeeId, applicantId, target, targetType });

        if (!snapshot) {
            console.error(`[PREVIEW JOINING LETTER] Salary snapshot/assignment not found for ${targetType}: ${employeeId || applicantId}.`);
            return res.status(400).json({ message: "Salary assignment not found. Please complete Salary Assignment first." });
        }

        // Helper to format currency
        const cur = (val) => Math.round(val || 0).toLocaleString('en-IN');

        const earnings = (snapshot.earnings || []).map(e => ({
            ...e,
            monthly: e.monthlyAmount || e.monthly || 0,
            yearly: e.yearlyAmount || e.yearly || e.annualAmount || (e.monthlyAmount * 12) || 0
        }));

        const employeeDeductions = (snapshot.employeeDeductions || snapshot.deductions || []).map(d => ({
            ...d,
            monthly: d.monthlyAmount || d.monthly || 0,
            yearly: d.yearlyAmount || d.yearly || d.annualAmount || (d.monthlyAmount * 12) || 0
        }));

        const benefits = (snapshot.benefits || []).map(b => ({
            ...b,
            monthly: b.monthlyAmount || b.monthly || 0,
            yearly: b.yearlyAmount || b.yearly || b.annualAmount || (b.monthlyAmount * 12) || 0
        }));

        // Use pre-calculated totals from snapshot if available for consistency
        const grossAAnnual = snapshot.summary?.grossEarnings || snapshot.breakdown?.totalEarnings || earnings.reduce((sum, e) => sum + e.yearly, 0);
        const totalBenefitsAnnual = snapshot.summary?.totalBenefits || snapshot.breakdown?.totalBenefits || benefits.reduce((sum, b) => sum + b.yearly, 0);
        const totalDeductionsAnnual = snapshot.summary?.totalDeductions || snapshot.breakdown?.totalDeductions || employeeDeductions.reduce((sum, d) => sum + d.yearly, 0);
        const totalCTCAnnual = snapshot.ctc || snapshot.annualCTC || (grossAAnnual + totalBenefitsAnnual);
        const netAnnual = snapshot.summary?.netPay || snapshot.breakdown?.netPay || (grossAAnnual - totalDeductionsAnnual);


        // SMART CATEGORIZATION (v10.0)
        // 1. Compensatory Allowance should be in Gross A (Earnings)
        const compensatoryFromBenefits = benefits.filter(b => /compensatory/i.test(b.name || ''));
        const otherBenefits = benefits.filter(b => !/compensatory/i.test(b.name || ''));

        // Add to earnings for representation
        const enhancedEarnings = [...earnings];
        compensatoryFromBenefits.forEach(b => {
            if (!enhancedEarnings.find(e => e.name === b.name)) {
                enhancedEarnings.push(b);
            }
        });

        // 2. Separate Annual (B), Retirals (C), and Insurance (D)
        const grossBListRaw = otherBenefits.filter(b => /bonus|lta|leave|variable|annual|performance/i.test(b.name || ''));
        const grossCListRaw = otherBenefits.filter(b => /gratuity|pf|provident|retirals/i.test(b.name || '') && !/bonus|lta|leave|variable|annual|performance/i.test(b.name || ''));
        const insuranceListRaw = otherBenefits.filter(b => /insurance|mediclaim/i.test(b.name || ''));

        // Anything else goes to Gross C as fallback if not caught
        const caughtNames = [...grossBListRaw, ...grossCListRaw, ...insuranceListRaw].map(b => b.name);
        const remainingBenefits = otherBenefits.filter(b => !caughtNames.includes(b.name));
        const finalGrossCListRaw = [...grossCListRaw, ...remainingBenefits];

        const grossAAnnualTotal = enhancedEarnings.reduce((sum, e) => sum + (e.yearly || 0), 0);
        const grossBAnnualTotal = grossBListRaw.reduce((sum, b) => sum + (b.yearly || 0), 0);
        const grossCAnnualTotal = finalGrossCListRaw.reduce((sum, b) => sum + (b.yearly || 0), 0);
        const insuranceAnnualTotal = insuranceListRaw.reduce((sum, b) => sum + (b.yearly || 0), 0);

        const totals = {
            grossA: {
                monthly: Math.round(grossAAnnualTotal / 12),
                yearly: Math.round(grossAAnnualTotal),
                formattedM: safeCur(grossAAnnualTotal / 12),
                formattedY: safeCur(grossAAnnualTotal)
            },
            grossB: {
                monthly: Math.round(grossBAnnualTotal / 12),
                yearly: Math.round(grossBAnnualTotal),
                formattedM: safeCur(grossBAnnualTotal / 12),
                formattedY: safeCur(grossBAnnualTotal)
            },
            grossC: {
                monthly: Math.round(grossCAnnualTotal / 12),
                yearly: Math.round(grossCAnnualTotal),
                formattedM: safeCur(grossCAnnualTotal / 12),
                formattedY: safeCur(grossCAnnualTotal)
            },
            grossD: {
                monthly: Math.round(insuranceAnnualTotal / 12),
                yearly: Math.round(insuranceAnnualTotal),
                formattedM: safeCur(insuranceAnnualTotal / 12),
                formattedY: safeCur(insuranceAnnualTotal)
            },
            deductions: {
                monthly: Math.round(totalDeductionsAnnual / 12),
                yearly: Math.round(totalDeductionsAnnual),
                formattedM: safeCur(totalDeductionsAnnual / 12),
                formattedY: safeCur(totalDeductionsAnnual)
            },
            net: {
                monthly: Math.round(netAnnual / 12),
                yearly: Math.round(netAnnual),
                formattedM: safeCur(netAnnual / 12),
                formattedY: safeCur(netAnnual)
            },
            computedCTC: {
                monthly: Math.round(totalCTCAnnual / 12),
                yearly: Math.round(totalCTCAnnual),
                formattedM: safeCur(totalCTCAnnual / 12),
                formattedY: safeCur(totalCTCAnnual)
            }
        };

        const flatData = {};
        earnings.forEach(e => { flatData[e.code] = safeCur(e.monthlyAmount); flatData[`${e.code} _ANNUAL`] = safeCur(e.annualAmount); });
        employeeDeductions.forEach(d => { flatData[d.code] = safeCur(d.monthlyAmount); flatData[`${d.code} _ANNUAL`] = safeCur(d.annualAmount); });
        benefits.forEach(b => { flatData[b.code] = safeCur(b.monthlyAmount); flatData[`${b.code} _ANNUAL`] = safeCur(b.annualAmount); });

        // ... (rest of logic same) ...

        const salaryStructure = {
            earnings: enhancedEarnings.map(e => ({ name: e.name || '', monthly: safeCur(e.monthly), yearly: safeCur(e.yearly) })),
            deductions: employeeDeductions.map(d => ({ name: d.name || '', monthly: safeCur(d.monthly), yearly: safeCur(d.yearly) })),
            benefits: otherBenefits.map(b => ({ name: b.name || '', monthly: safeCur(b.monthly), yearly: safeCur(b.yearly) })),
            totals: totals
        };

        // RECONSTRUCTED: enhancedSalaryComponents for table rendering (v10.1)
        const salaryComponents = [];

        // A - Monthly Benefits (Gross A)
        salaryComponents.push({ name: 'A – Monthly Benefits', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        enhancedEarnings.forEach(e => {
            const m = safeCur(e.monthly);
            const y = safeCur(e.yearly);
            salaryComponents.push({ name: e.name, monthly: m, yearly: y, annual: y, MONTHLY: m, YEARLY: y, ANNUAL: y });
        });
        salaryComponents.push({
            name: 'GROSS A',
            monthly: totals.grossA.formattedM, yearly: totals.grossA.formattedY, annual: totals.grossA.formattedY,
            MONTHLY: totals.grossA.formattedM, YEARLY: totals.grossA.formattedY, ANNUAL: totals.grossA.formattedY
        });

        // Deduction Section
        salaryComponents.push({ name: '', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        employeeDeductions.forEach(d => {
            const m = safeCur(d.monthly);
            const y = safeCur(d.yearly);
            salaryComponents.push({ name: d.name, monthly: m, yearly: y, annual: y, MONTHLY: m, YEARLY: y, ANNUAL: y });
        });
        salaryComponents.push({
            name: 'Total Deductions (B)',
            monthly: totals.deductions.formattedM, yearly: totals.deductions.formattedY, annual: totals.deductions.formattedY,
            MONTHLY: totals.deductions.formattedM, YEARLY: totals.deductions.formattedY, ANNUAL: totals.deductions.formattedY
        });
        salaryComponents.push({
            name: 'Take Home Package',
            monthly: totals.net.formattedM, yearly: totals.net.formattedY, annual: totals.net.formattedY,
            MONTHLY: totals.net.formattedM, YEARLY: totals.net.formattedY, ANNUAL: totals.net.formattedY
        });

        // B - Annual Benefits
        salaryComponents.push({ name: '', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        salaryComponents.push({ name: 'B – Annual Benefits', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        grossBListRaw.forEach(b => {
            const m = safeCur(b.monthly);
            const y = safeCur(b.yearly);
            salaryComponents.push({ name: b.name, monthly: m, yearly: y, annual: y, MONTHLY: m, YEARLY: y, ANNUAL: y });
        });
        salaryComponents.push({
            name: 'GROSS B',
            monthly: totals.grossB.formattedM, yearly: totals.grossB.formattedY, annual: totals.grossB.formattedY,
            MONTHLY: totals.grossB.formattedM, YEARLY: totals.grossB.formattedY, ANNUAL: totals.grossB.formattedY
        });

        // C - Retirals
        salaryComponents.push({ name: '', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        salaryComponents.push({ name: 'C – Retirals Company\'s Benefits', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        finalGrossCListRaw.forEach(b => {
            const m = safeCur(b.monthly);
            const y = safeCur(b.yearly);
            salaryComponents.push({ name: b.name, monthly: m, yearly: y, annual: y, MONTHLY: m, YEARLY: y, ANNUAL: y });
        });
        salaryComponents.push({
            name: 'GROSS C',
            monthly: totals.grossC.formattedM, yearly: totals.grossC.formattedY, annual: totals.grossC.formattedY,
            MONTHLY: totals.grossC.formattedM, YEARLY: totals.grossC.formattedY, ANNUAL: totals.grossC.formattedY
        });

        // D - Other Benefits
        salaryComponents.push({ name: '', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        salaryComponents.push({ name: 'D – Other Benefits', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        insuranceListRaw.forEach(b => {
            const m = safeCur(b.monthly);
            const y = safeCur(b.yearly);
            salaryComponents.push({ name: b.name, monthly: m, yearly: y, annual: y, MONTHLY: m, YEARLY: y, ANNUAL: y });
        });
        salaryComponents.push({
            name: 'GROSS D',
            monthly: totals.grossD.formattedM, yearly: totals.grossD.formattedY, annual: totals.grossD.formattedY,
            MONTHLY: totals.grossD.formattedM, YEARLY: totals.grossD.formattedY, ANNUAL: totals.grossD.formattedY
        });

        // Final CTC
        salaryComponents.push({ name: '', monthly: '', yearly: '', annual: '', MONTHLY: '', YEARLY: '', ANNUAL: '' });
        salaryComponents.push({
            name: 'Computed CTC (A+B+C+D)',
            monthly: totals.computedCTC.formattedM, yearly: totals.computedCTC.formattedY, annual: totals.computedCTC.formattedY,
            MONTHLY: totals.computedCTC.formattedM, YEARLY: totals.computedCTC.formattedY, ANNUAL: totals.computedCTC.formattedY
        });

        const enhancedSalaryComponents = salaryComponents.map(comp => ({
            ...comp,
            monthlyRaw: comp.monthly === '' ? 0 : (typeof comp.monthly === 'string' ? parseFloat(comp.monthly.replace(/,/g, '')) || 0 : comp.monthly),
            yearlyRaw: comp.yearly === '' ? 0 : (typeof comp.yearly === 'string' ? parseFloat(comp.yearly.replace(/,/g, '')) || 0 : comp.yearly)
        }));

        const resolvedCandidateAddress =
            target.address ||
            target.candidate_address ||
            target.candidateAddress ||
            [target.tempAddress?.line1, target.tempAddress?.line2, target.tempAddress?.city, target.tempAddress?.state, target.tempAddress?.pincode]
                .filter(Boolean)
                .join(', ') ||
            [target.permAddress?.line1, target.permAddress?.line2, target.permAddress?.city, target.permAddress?.state, target.permAddress?.pincode]
                .filter(Boolean)
                .join(', ') ||
            [target.permanentAddress?.line1, target.permanentAddress?.line2, target.permanentAddress?.city, target.permanentAddress?.state, target.permanentAddress?.pincode]
                .filter(Boolean)
                .join(', ') ||
            [target.currentAddress?.line1, target.currentAddress?.line2, target.currentAddress?.city, target.currentAddress?.state, target.currentAddress?.pincode]
                .filter(Boolean)
                .join(', ') ||
            '';

        const basicData = {
            candidate_name: target.name || '',
            candidateName: target.name || '',
            employee_name: target.name || '',
            father_name: target.fatherName || '',
            fatherName: target.fatherName || '',
            email: target.email || '',
            mobile: target.mobile || '',
            address: resolvedCandidateAddress,
            candidate_address: resolvedCandidateAddress,
            candidateAddress: resolvedCandidateAddress,
            employee_address: resolvedCandidateAddress,
            designation: target.requirementId?.jobTitle || target.designation || '',
            position: target.requirementId?.jobTitle || target.designation || '',
            department: target.requirementId?.department || target.department || '',
            grade: target.gradeSnapshot?.name || target.grade || target.requirementId?.grade || '',
            grade_name: target.gradeSnapshot?.name || target.grade || target.requirementId?.grade || '',
            grade_code: target.gradeSnapshot?.code || '',
            grade_level: target.gradeSnapshot?.level ?? '',
            GRADE: target.gradeSnapshot?.name || target.grade || target.requirementId?.grade || '',
            joining_date: safeDate(target.joiningDate),
            joiningDate: safeDate(target.joiningDate),
            location: target.location || target.workLocation || '',
            work_location: target.location || target.workLocation || '',
            current_date: issueDate ? new Date(issueDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
            issued_date: issueDate ? new Date(issueDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
            issue_date: issueDate ? new Date(issueDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
            issuedDate: issueDate ? new Date(issueDate).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN'),
            ref_no: refNo || `JL / ${new Date().getFullYear()}/${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`,
            refNo: refNo,
            ref_code: refNo,
            reference_number: refNo
        };

        // DYNAMIC FLATTENING for Static Templates (v10.1)
        const flatComponentMap = {};
        const populateFlatMap = (items) => {
            items.forEach(item => {
                if (item.name) {
                    const keyBase = item.name.toUpperCase().trim().replace(/[^A-Z0-9]+/g, '_');
                    flatComponentMap[`${keyBase}_MONTHLY`] = safeCur(item.monthly);
                    flatComponentMap[`${keyBase}_YEARLY`] = safeCur(item.yearly);
                }
                if (item.code) {
                    flatComponentMap[`${item.code}_MONTHLY`] = safeCur(item.monthly);
                    flatComponentMap[`${item.code}_YEARLY`] = safeCur(item.yearly);
                }
            });
        };

        populateFlatMap(enhancedEarnings);
        populateFlatMap(employeeDeductions);
        populateFlatMap(otherBenefits);

        // Fix BASIC specifically
        const basicComp = enhancedEarnings.find(e => e.name.toUpperCase().trim() === 'BASIC' || e.code === 'BASIC' || e.name.toUpperCase().trim().includes('BASIC SALARY'));
        if (basicComp) {
            flatComponentMap['BASIC_MONTHLY'] = safeCur(basicComp.monthly);
            flatComponentMap['BASIC_YEARLY'] = safeCur(basicComp.yearly);
        }

        const salaryTemplatePayload = buildSalaryTemplatePayload(snapshot, totals);
        const initialData = {
            ...expandCustomData(customData),
            ...basicData,
            ...flatComponentMap, // Inject dynamic keys
            salary: salaryTemplatePayload.salary,
            ...salaryTemplatePayload.salary_flat,
            salaryComponents: enhancedSalaryComponents,
            salaryStructure: salaryStructure,
            earnings: salaryStructure.earnings,
            deductions: salaryStructure.deductions,
            benefits: salaryStructure.benefits,
            totals: salaryStructure.totals,
            ...(req.calculatedSalaryData || {}),
            ...(req.flatSalaryData || {}),

            // Hardcoded totals matching all possible DOCX tags
            GROSS_A_MONTHLY: totals.grossA.formattedM,
            GROSS_A_YEARLY: totals.grossA.formattedY,
            GROSS_B_MONTHLY: totals.grossB.formattedM,
            GROSS_B_YEARLY: totals.grossB.formattedY,
            GROSS_C_MONTHLY: totals.grossC.formattedM,
            GROSS_C_YEARLY: totals.grossC.formattedY,
            GROSS_D_MONTHLY: totals.grossD.formattedM,
            GROSS_D_YEARLY: totals.grossD.formattedY,
            NET_SALARY_MONTHLY: totals.net.formattedM,
            NET_SALARY_YEARLY: totals.net.formattedY,
            CTC_MONTHLY: totals.computedCTC.formattedM,
            CTC_YEARLY: totals.computedCTC.formattedY,
            TAKE_HOME_MONTHLY: totals.net.formattedM,
            TAKE_HOME_YEARLY: totals.net.formattedY,

            salary_table_text_block: enhancedSalaryComponents.map(r => `${r.name}\t${r.monthly}\t${r.yearly}`).join('\n'),
            SALARY_TABLE: enhancedSalaryComponents.map(r => `${r.name}\t${r.monthly}\t${r.yearly}`).join('\n')
        };

        // // console.log('✅ [JOINING LETTER] Final Data Prepared. Sample flat keys:', Object.keys(flatComponentMap).slice(0, 5));

        // // console.log('✅ [JOINING LETTER] Final Data Prepared Successfully');

        // ========== UNIVERSAL STABLE PATCH ENGINE (STABLE FOREVER) ==========
        const finalData = buildEnterpriseLetterData({
            template,
            baseData: applyUniversalSalaryPatches(initialData, snapshot, totals),
            target,
            customData,
            issueDate,
            dateFormat,
            refNo
        });
        const { generatedVariables, missingVariables } = collectGeneratedVariableReport(template.placeholders || template.detectedVariables || [], finalData);

        // Final structural safety guard (v10.2: Skip arrays to preserve table data)
        Object.keys(finalData).forEach(k => {
            if (finalData[k] === undefined || finalData[k] === null) {
                finalData[k] = "";
            }
            if (typeof finalData[k] === 'object' && finalData[k] !== null && !Array.isArray(finalData[k])) {
                // Skip wiping to avoid breaking nested tags
            }
        });
        // ========== END SAFE PATCHES ==========

        // ========== END SAFE PATCHES ==========

        const renderCache = buildLetterRenderCache({
            kind: 'joining',
            template,
            target,
            snapshot,
            payload: {
                salaryRenderVersion: 2,
                applicantId,
                employeeId,
                refNo,
                issueDate,
                dateFormat,
                signaturePosition,
                customData
            }
        });

        if (fs.existsSync(renderCache.pdfPath) && fs.existsSync(renderCache.docxPath)) {
            return res.json({
                success: true,
                htmlContent: undefined,
                previewUrl: renderCache.pdfUrl,
                pdfUrl: renderCache.pdfUrl,
                generatedVariables,
                missingVariables,
                warnings: missingVariables.length ? missingVariables.map((variable) => `Variable data missing: ${variable}`) : [],
                message: 'Preview generated successfully.'
            });
        }

        // 4. Render
        // // console.log('🔥 [PREVIEW JOINING LETTER] Rendering with data...');
        try {
            doc.render(finalData);
        } catch (renderError) {
            // Log the error but return 500 as per requirement
            console.error('🔥 [PREVIEW JOINING LETTER] RENDER CRASH:', renderError);
            return res.status(500).json({ message: "Joining letter preview generation failed", error: renderError.message });
        }

        // 5. Generate DOCX buffer
        const buf = doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });

        // For WORD joining letters, always use actual DOCX -> PDF preview so the
        // preview matches the final generated PDF exactly.
        // // console.log('🔍 [PREVIEW JOINING LETTER] Using DOCX-to-PDF rendering for preview');

        // 6. Fallback: write DOCX + LibreOffice PDF
        const fileName = `Preview_Joining_Letter_${employeeId || applicantId || 'preview'}_${Date.now()}`;
        const outputDir = path.join(__dirname, '../uploads/previews');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const docxPath = path.join(outputDir, `${fileName}.docx`);
        await fsPromises.writeFile(docxPath, buf);
        await copyIfExists(docxPath, renderCache.docxPath);

        // 7. HIGH FIDELITY PREVIEW: Use full LibreOffice for 100% template accuracy
        let finalRelativePath;
        let finalPdfUrl;
        let htmlContent;

        try {
            const libreOfficeService = require('../services/LibreOfficeService');
            const pdfAbsolutePath = await libreOfficeService.convertToPdf(docxPath, outputDir);
            const pdfFileName = path.basename(pdfAbsolutePath);
            finalRelativePath = `previews/${pdfFileName}`;
            finalPdfUrl = `/uploads/${finalRelativePath}`;
            await copyIfExists(pdfAbsolutePath, renderCache.pdfPath);
            
            const result = await mammoth.convertToHtml({ buffer: buf });
            htmlContent = `<div class="word-preview-container" style="padding: 40px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: white; color: #334155; line-height: 1.6; max-width: 900px; margin: 0 auto; box-shadow: 0 0 20px rgba(0,0,0,0.05);">${result.value}</div>`;

        } catch (pdfError) {

            console.error('⚠️ [PREVIEW JOINING LETTER] PDF/Mammoth Conversion Failed:', pdfError.message);
            // Absolute fallback to mammoth if PDF fails
            try {
                const result = await mammoth.convertToHtml({ buffer: buf });
                htmlContent = `<div class="word-preview-container" ...>${result.value}</div>`;
            } catch (fallbackError) {
                return res.status(500).json({
                    message: `Preview Generation Failed: ${fallbackError.message}`,
                    error: fallbackError.message
                });
            }
        }

        // RETURN PREVIEW (PDF takes priority for fidelity)
        res.json({
            success: true,
            htmlContent: htmlContent, 
            previewUrl: finalPdfUrl,
            pdfUrl: finalPdfUrl,
            generatedVariables,
            missingVariables,
            warnings: missingVariables.length ? missingVariables.map((variable) => `Variable data missing: ${variable}`) : [],
            message: 'Preview generated successfully.'
        });

    } catch (error) {
        console.error('🔥 [PREVIEW JOINING LETTER] FATAL 500 ERROR:', error);
        res.status(500).json({
            message: `Preview Failed: ${error.message}`,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

/**
 * VIEW EXISTING JOINING LETTER PDF
 */
exports.viewJoiningLetter = async (req, res) => {
    try {
        const { applicantId } = req.params;
        const Applicant = getApplicantModel(req);

        const applicant = await Applicant.findById(applicantId);
        if (!applicant) {
            return res.status(404).json({ message: "Applicant not found" });
        }

        if (!applicant.joiningLetterPath) {
            return res.status(404).json({ message: "Joining letter not generated yet" });
        }

        const pdfPath = path.join(__dirname, '../uploads', applicant.joiningLetterPath);
        if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({ message: "Joining letter file not found" });
        }

        // Return the download URL
        const downloadUrl = `/uploads/${applicant.joiningLetterPath}`;
        res.json({ downloadUrl });

    } catch (error) {
        console.error('View joining letter error:', error);
        res.status(500).json({ message: "Internal Error", error: error.message });
    }
};

/**
 * DOWNLOAD EXISTING JOINING LETTER PDF
 */
exports.downloadJoiningLetter = async (req, res) => {
    try {
        const { applicantId } = req.params;
        const Applicant = getApplicantModel(req);

        const applicant = await Applicant.findById(applicantId);
        if (!applicant) {
            return res.status(404).json({ message: "Applicant not found" });
        }

        if (!applicant.joiningLetterPath) {
            return res.status(404).json({ message: "Joining letter not generated yet" });
        }

        const pdfPath = path.join(__dirname, '../uploads', applicant.joiningLetterPath);
        if (!fs.existsSync(pdfPath)) {
            return res.status(404).json({ message: "Joining letter file not found" });
        }

        // Set headers for download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Joining_Letter_${applicant.name || applicantId}.pdf"`);

        // Stream the file
        const fileStream = fs.createReadStream(pdfPath);
        fileStream.pipe(res);

    } catch (error) {
        console.error('Download joining letter error:', error);
        res.status(500).json({ message: "Internal Error", error: error.message });
    }
};

// --- HELPER: Centralized Salary Processing Logic ---
/**
 * Process candidate salary structure for joining letter
 * Returns FULL breakup with earnings, deductions, and benefits
 * All components include showInJoiningLetter flag
 * Zero values for auto-calculated components show "As per Rule"
 */
/**
 * Process candidate salary structure for joining letter
 * Read ONLY from selected lists in structure
 */
function processCandidateSalary(structure) {
    const formatCurrency = (val) => {
        if (val === undefined || val === null) return '-';
        const num = Number(val);
        if (isNaN(num)) return '-';
        return Math.round(num).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    };

    const earnings = Array.isArray(structure.earnings) ? structure.earnings : [];
    const deductions = Array.isArray(structure.deductions) ? structure.deductions : [];
    const benefits = Array.isArray(structure.employerBenefits) ? structure.employerBenefits : [];

    const flatData = {};
    const normalizeKey = (val) => (val || '').toLowerCase().replace(/[^a-z0-9]/g, '_');

    const processedEarnings = earnings.map(comp => {
        const k = normalizeKey(comp.label);
        flatData[`${k}_monthly`] = formatCurrency(comp.monthly);
        flatData[`${k}_yearly`] = formatCurrency(comp.yearly);
        return {
            name: comp.label,
            monthly: formatCurrency(comp.monthly),
            yearly: formatCurrency(comp.yearly),
            amount: comp.monthly
        };
    });

    const processedDeductions = deductions.map(comp => {
        const k = normalizeKey(comp.label);
        flatData[`${k}_monthly`] = formatCurrency(comp.monthly);
        flatData[`${k}_yearly`] = formatCurrency(comp.yearly);
        return {
            name: comp.label,
            monthly: formatCurrency(comp.monthly),
            yearly: formatCurrency(comp.yearly),
            amount: comp.monthly
        };
    });

    const processedBenefits = benefits.map(comp => {
        const k = normalizeKey(comp.label);
        flatData[`${k}_monthly`] = formatCurrency(comp.monthly);
        flatData[`${k}_yearly`] = formatCurrency(comp.yearly);
        return {
            name: comp.label,
            monthly: formatCurrency(comp.monthly),
            yearly: formatCurrency(comp.yearly),
            amount: comp.monthly
        };
    });

    const totals = structure.totals || {};

    flatData['gross_a_monthly'] = formatCurrency(totals.grossEarnings);
    flatData['gross_a_yearly'] = formatCurrency(totals.grossEarnings * 12);
    flatData['total_deductions_monthly'] = formatCurrency(totals.totalDeductions);
    flatData['total_deductions_yearly'] = formatCurrency(totals.totalDeductions * 12);
    flatData['net_salary_monthly'] = formatCurrency(totals.netSalary);
    flatData['net_salary_yearly'] = formatCurrency(totals.netSalary * 12);
    flatData['ctc_monthly'] = formatCurrency(totals.monthlyCTC);
    flatData['ctc_yearly'] = formatCurrency(totals.annualCTC);
    flatData['annual_ctc'] = formatCurrency(totals.annualCTC);

    return {
        earnings: processedEarnings,
        deductions: processedDeductions,
        benefits: processedBenefits,
        totals: {
            grossA: {
                monthly: totals.grossEarnings,
                yearly: totals.grossEarnings * 12,
                formattedM: formatCurrency(totals.grossEarnings),
                formattedY: formatCurrency(totals.grossEarnings * 12)
            },
            grossB: { monthly: 0, yearly: 0, formattedM: '0', formattedY: '0' },
            grossC: {
                monthly: totals.employerBenefits,
                yearly: totals.employerBenefits * 12,
                formattedM: formatCurrency(totals.employerBenefits),
                formattedY: formatCurrency(totals.employerBenefits * 12)
            },
            earnings: {
                monthly: totals.grossEarnings,
                yearly: totals.grossEarnings * 12,
                formattedM: formatCurrency(totals.grossEarnings),
                formattedY: formatCurrency(totals.grossEarnings * 12)
            },
            deductions: {
                monthly: totals.totalDeductions,
                yearly: totals.totalDeductions * 12,
                formattedM: formatCurrency(totals.totalDeductions),
                formattedY: formatCurrency(totals.totalDeductions * 12)
            },
            employer: {
                monthly: totals.employerBenefits,
                yearly: totals.employerBenefits * 12,
                formattedM: formatCurrency(totals.employerBenefits),
                formattedY: formatCurrency(totals.employerBenefits * 12)
            },
            computedCTC: {
                monthly: totals.monthlyCTC,
                yearly: totals.annualCTC,
                formattedM: formatCurrency(totals.monthlyCTC),
                formattedY: formatCurrency(totals.annualCTC)
            },
            ctc: {
                monthly: totals.monthlyCTC,
                yearly: totals.annualCTC,
                formattedM: formatCurrency(totals.monthlyCTC),
                formattedY: formatCurrency(totals.annualCTC)
            },
            net: {
                monthly: totals.netSalary,
                yearly: totals.netSalary * 12,
                formattedM: formatCurrency(totals.netSalary),
                formattedY: formatCurrency(totals.netSalary * 12)
            },
            netSalary: {
                monthly: totals.netSalary,
                yearly: totals.netSalary * 12,
                formattedM: formatCurrency(totals.netSalary),
                formattedY: formatCurrency(totals.netSalary * 12)
            },
            totalCTC: {
                monthly: totals.monthlyCTC,
                yearly: totals.annualCTC,
                formattedM: formatCurrency(totals.monthlyCTC),
                formattedY: formatCurrency(totals.annualCTC)
            }
        },
        flatData
    };
}

// =========================================================================
// C) GENERIC LETTER GENERATION & WORKFLOW
// =========================================================================

/**
 * Generate a generic letter based on any template
 * Supports both Word and HTML (Blank/Letter Pad) templates
 */
exports.generateGenericLetter = async (req, res) => {
    try {
        const { templateId, employeeId, applicantId, customData = {} } = req.body;
        const tenantId = req.tenantId;

        // Add validation logging
        // // console.log('🔍 [generateGenericLetter] Received:', { templateId, employeeId, applicantId });

        const { LetterTemplate, GeneratedLetter, Employee, Applicant, EmployeeSalarySnapshot } = getModels(req);

        // 1. Fetch Template
        const template = await LetterTemplate.findOne({ _id: templateId, tenantId });
        if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

        // 2. Fetch Entity Data (Employee or Applicant)
        // NOTE: Employee uses 'tenant' field, not 'tenantId'
        let entity = null;
        let entityType = '';
        if (employeeId) {
            // // console.log('🔍 [generateGenericLetter] Searching for employee:', { employeeId, tenant: tenantId });
            entity = await Employee.findOne({ _id: employeeId, tenant: tenantId });
            if (!entity) {
                console.warn('⚠️ [generateGenericLetter] Employee not found:', { employeeId, tenant: tenantId });
            } else {
                // // console.log('✅ [generateGenericLetter] Employee found:', { id: entity._id, name: entity.firstName });
            }
            entityType = 'employee';
        } else if (applicantId) {
            // // console.log('🔍 [generateGenericLetter] Searching for applicant:', { applicantId, tenantId });
            entity = await Applicant.findOne({ _id: applicantId, tenantId });
            if (!entity) {
                console.warn('⚠️ [generateGenericLetter] Applicant not found:', { applicantId, tenantId });
            }
            entityType = 'applicant';
        }

        if (!entity && !customData.candidateName) {
            console.error('❌ [generateGenericLetter] No entity found and no candidateName provided');
            return res.status(400).json({ success: false, message: 'Employee or Applicant ID is required' });
        }

        // 3. Prepare Placeholder Values
        const placeholderData = {
            ...customData,
            employee_name: entity ? (entity.firstName + ' ' + (entity.lastName || '')) : (customData.candidateName || ''),
            designation: entity?.designation || customData.designation || '',
            department: entity?.department || customData.department || '',
            joining_date: entity?.joiningDate ? safeDate(entity.joiningDate) : (customData.joining_date || ''),
            employee_id: entity?.employeeId || '',
            current_date: formatCustomDate(new Date()),
            company_name: req.user.companyName || 'The Company'
        };

        // If salary is needed, fetch latest snapshot
        if (employeeId) {
            const snapshot = await EmployeeSalarySnapshot.findOne({ employeeId, tenantId }).sort('-createdAt');
            if (snapshot) {
                const totals = snapshot.totals || {};
                const dataWithSalary = applyUniversalSalaryPatches(placeholderData, snapshot, totals);
                Object.assign(placeholderData, dataWithSalary);
            }
        }

        let pdfResult;
        const timestamp = Date.now();
        const fileName = `${template.type}_${entityType}_${timestamp}.pdf`;
        const outputDir = path.join(__dirname, '../uploads/generated_letters', tenantId.toString());

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, fileName);
        const publicUrl = `/uploads/generated_letters/${tenantId}/${fileName}`;

        // 4. Generate Based on Template Type
        if (template.templateType === 'WORD') {
            if (!template.filePath) throw new Error('Template file path missing');

            const normalizedTemplatePath = normalizeFilePath(template.filePath);
            if (!fs.existsSync(normalizedTemplatePath)) {
                return res.status(404).json({
                    success: false,
                    message: 'Template file not found on server. Please re-upload the template.'
                });
            }

            const buffer = fs.readFileSync(normalizedTemplatePath);
            const zip = new PizZip(buffer);
            sanitizeDocxTemplateDelimiters(zip);
            let doc;
            try {
                doc = new Docxtemplater(zip, {
                    paragraphLoop: true,
                    linebreaks: true,
                    delimiters: { start: '{{', end: '}}' }
                });
            } catch (compileErr) {
                console.error('❌ [generateGenericLetter] Template compile error:', compileErr);
                return res.status(400).json(buildTemplateCompileError(compileErr));
            }

            try {
                doc.render(placeholderData);
            } catch (renderErr) {
                console.error('❌ [generateGenericLetter] Template render error:', renderErr);
                return res.status(400).json(buildTemplateCompileError(renderErr));
            }
            const generatedBuffer = doc.getZip().generate({ type: 'nodebuffer' });

            // Save temporary docx file for conversion with proper naming
            // Use a consistent filename that includes template info
            const docxFileName = `${template.type}_${entityType}_${timestamp}.docx`;
            const tempDocxPath = path.join(outputDir, docxFileName);
            fs.writeFileSync(tempDocxPath, generatedBuffer);

            try {
                // Use LibreOfficeService for PDF conversion (reliable, cross-platform)
                // // console.log(`📄 [generateGenericLetter] Converting DOCX to PDF using LibreOffice...`);
                // // console.log(`📄 [generateGenericLetter] DOCX Path: ${tempDocxPath}`);
                // // console.log(`📄 [generateGenericLetter] Output Dir: ${outputDir}`);

                const libreOfficeService = require('../services/LibreOfficeService');
                const actualPdfPath = await libreOfficeService.convertToPdf(tempDocxPath, outputDir);

                // Verify PDF was created with the expected name
                if (!fs.existsSync(actualPdfPath)) {
                    console.error(`❌ [generateGenericLetter] Expected PDF not found at: ${actualPdfPath}`);
                    // // console.log(`📋 [generateGenericLetter] Checking for any PDF files in directory...`);
                    const files = fs.readdirSync(outputDir);
                    // // console.log(`📋 [generateGenericLetter] Files in ${outputDir}:`, files);
                    throw new Error(`PDF file was not created at expected path: ${outputPath}`);
                }

                // // console.log(`✅ [generateGenericLetter] PDF conversion successful: ${outputPath}`);

                // Cleanup temporary docx
                try {
                    fs.unlinkSync(tempDocxPath);
                    // // console.log(`🧹 [generateGenericLetter] Cleaned up temp DOCX: ${tempDocxPath}`);
                } catch (cleanupErr) {
                    console.warn(`⚠️ [generateGenericLetter] Could not cleanup temp file: ${cleanupErr.message}`);
                }
            } catch (err) {
                console.error('❌ [generateGenericLetter] PDF Conversion error:', err.message);
                // Cleanup temporary file on error
                try {
                    if (fs.existsSync(tempDocxPath)) {
                        fs.unlinkSync(tempDocxPath);
                        // // console.log(`🧹 [generateGenericLetter] Cleaned up temp DOCX after error`);
                    }
                } catch (cleanupErr) {
                    console.warn('⚠️ Could not cleanup temp file:', cleanupErr.message);
                }
                throw new Error(`Failed to convert document to PDF: ${err.message}`);
            }
        } else {
            // HTML Template (Blank or Letter Pad)
            const htmlContent = template.bodyContent; // In a real app, use a template engine like Handlebars
            let processedHtml = htmlContent;

            // Simple placeholder replacement
            Object.entries(placeholderData).forEach(([key, val]) => {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
                processedHtml = processedHtml.replace(regex, val);
            });

            // Use existing PDF generator service
            await letterPDFGenerator.generatePDF({
                html: processedHtml,
                outputPath,
                headerHtml: template.hasHeader ? template.headerContent : '',
                footerHtml: template.hasFooter ? template.footerContent : '',
                margins: template.pageLayout?.margins
            });
        }

        // 5. Upload to Cloudinary if configured
        let finalPdfUrl = publicUrl;
        const CloudinaryService = require("../services/CloudinaryService");
        if (CloudinaryService.isConfigured()) {
            try {
                const cloudRes = await CloudinaryService.uploadFile(
                    outputPath,
                    `hrms/${tenantId}/generated_letters/${template.type}`,
                    false // Don't delete local yet, maybe DB save fails
                );
                finalPdfUrl = cloudRes.url;
            } catch (err) {
                console.warn("[generateGenericLetter] PDF cloud upload failed:", err.message);
            }
        }

        // 6. Save generated letter record
        const generatedLetter = new GeneratedLetter({
            tenantId,
            employeeId: employeeId || null,
            applicantId: applicantId || null,
            templateId: template._id,
            letterType: template.type,
            snapshotData: placeholderData,
            templateSnapshot: {
                bodyContent: template.bodyContent,
                contentJson: template.contentJson,
                templateType: template.templateType,
                filePath: template.filePath,
                version: template.version
            },
            pdfPath: outputPath,
            pdfUrl: finalPdfUrl,
            status: template.requiresApproval ? 'pending' : 'generated',
            generatedBy: req.user.id
        });

        await generatedLetter.save();

        // 6. If approval required, create approval record or notify
        if (template.requiresApproval) {
            const { LetterApproval } = getModels(req);
            // Optional: Auto-assign approvers based on template.approvalRoles
            // For now, just mark as pending
        }

        res.status(201).json({
            success: true,
            message: template.requiresApproval ? 'Letter generated and sent for approval' : 'Letter generated successfully',
            data: generatedLetter
        });

    } catch (error) {
        console.error('Generate Generic Letter Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get all generated letters for a tenant
 */
exports.getGeneratedLetters = async (req, res) => {
    try {
        const tenantId = req.tenantId;
        const { GeneratedLetter } = getModels(req);
        const role = String(req.user?.role || '').toLowerCase();
        const privileged = ['admin', 'hr', 'psa', 'company_admin', 'company_super_admin'].includes(role);

        const filter = { tenant: tenantId };
        if (!privileged) filter.employeeId = req.user?.id;
        if (req.query.employeeId) filter.employeeId = req.query.employeeId;
        if (req.query.applicantId) filter.applicantId = req.query.applicantId;
        if (req.query.status) filter.status = req.query.status;

        const letters = await GeneratedLetter.find(filter)
            .populate('employeeId', 'firstName lastName employeeId')
            .populate('applicantId', 'name')
            .populate('templateId', 'name type')
            .sort('-createdAt');

        const logFile = path.join(process.cwd(), 'letter_query_debug.log');
        fs.appendFileSync(logFile, `🔍 [GET_LETTERS] Filter: ${JSON.stringify(filter)} | Found: ${letters.length}\n`);

        const processedLetters = letters.map(l => {
            const letter = l.toObject();
            letter.pdfUrl = `/api/public/letters/${letter._id}/view-pdf?tenantId=${tenantId}`;
            return letter;
        });
        res.json({ success: true, data: processedLetters });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Get specific letter details
 */
exports.getLetterById = async (req, res) => {
    try {
        const { GeneratedLetter, LetterApproval } = getModels(req);
        const role = String(req.user?.role || '').toLowerCase();
        const privileged = ['admin', 'hr', 'psa', 'company_admin', 'company_super_admin'].includes(role);
        const filter = { _id: req.params.id, tenant: req.tenantId };
        if (!privileged) filter.employeeId = req.user?.id;

        const letter = await GeneratedLetter.findOne(filter)
            .populate('employeeId', 'firstName lastName employeeId')
            .populate('templateId', 'name type');

        if (!letter) return res.status(404).json({ success: false, message: 'Letter not found' });

        const approvals = await LetterApproval.find({ letterId: letter._id })
            .populate('approverId', 'firstName lastName')
            .sort('createdAt');

        res.json({ success: true, data: { ...letter.toObject(), approvals } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Update letter status (Sent, Rejected by candidate, etc.)
 */
exports.updateGeneratedLetterStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const { GeneratedLetter } = getModels(req);

        const letter = await GeneratedLetter.findOneAndUpdate(
            { _id: req.params.id, tenant: req.tenantId },
            { $set: { status } },
            { new: true }
        );

        if (!letter) return res.status(404).json({ success: false, message: 'Letter not found' });

        res.json({ success: true, data: letter });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Action a letter approval (Approve/Reject)
 */
exports.actionLetterApproval = async (req, res) => {
    try {
        const { status, comments } = req.body;
        const { GeneratedLetter, LetterApproval } = getModels(req);

        const letter = await GeneratedLetter.findOne({ _id: req.params.id, tenant: req.tenantId });
        if (!letter) return res.status(404).json({ success: false, message: 'Letter not found' });

        const approval = new LetterApproval({
            tenantId: req.tenantId,
            letterId: letter._id,
            approverId: req.user.id,
            status,
            comments,
            actionedAt: new Date()
        });

        await approval.save();

        if (status === 'approved') {
            letter.status = 'approved';
        } else {
            letter.status = 'rejected';
        }
        await letter.save();

        res.json({ success: true, message: `Letter ${status} successfully` });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Helper to round to 2 decimals
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

// =========================================================================
// PRODUCTION-GRADE DOCUMENT MANAGEMENT & REVOCATION SYSTEM
// =========================================================================

/**
 * GET DOCUMENT STATUS
 * Check if a document is currently revoked, viewed, etc.
 * Non-destructive - purely informational
 */
exports.getDocumentStatus = async (req, res) => {
    try {
        const { documentId } = req.params;
        const tenantId = req.user?.tenantId || req.tenantId;

        // Validate ID
        if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({ success: false, message: 'Invalid document ID' });
        }

        // Initialize service
        const DocumentManagementService = require('../services/DocumentManagementService');
        const docService = new DocumentManagementService(req.tenantDB);

        // Get document status
        const status = await docService.getDocumentStatus(documentId, tenantId);

        res.json({ success: true, data: status });
    } catch (error) {
        console.error('❌ [GET STATUS] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * REVOKE LETTER/OFFER
 * Instantly disable access, mark as REVOKED
 * Notification email sent to applicant/employee
 * Non-destructive, fully auditable, reversible by super-admin
 */
exports.revokeLetter = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { reason, reasonDetails } = req.body;
        const tenantId = req.user?.tenantId || req.tenantId;

        // Validate input
        if (!documentId) {
            return res.status(400).json({ success: false, message: 'Document ID required' });
        }
        if (!reason) {
            return res.status(400).json({ success: false, message: 'Revocation reason required' });
        }

        // Check permissions - only HR, Admin, or Super-Admin can revoke
        const allowedRoles = ['hr', 'admin', 'super_admin'];
        if (!allowedRoles.includes(req.user?.role?.toLowerCase())) {
            return res.status(403).json({
                success: false,
                message: 'Only HR and Admin can revoke documents'
            });
        }

        // Initialize services
        const DocumentManagementService = require('../services/DocumentManagementService');
        const EmailNotificationService = require('../services/EmailNotificationService');
        const docService = new DocumentManagementService(req.tenantDB);
        const emailService = new EmailNotificationService(process.env);

        const { GeneratedLetter, Applicant, Employee, LetterRevocation } = getModels(req);

        // Get document
        const letter = await GeneratedLetter.findById(documentId);
        if (!letter) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        // Check if already revoked
        const currentStatus = await docService.getDocumentStatus(documentId, tenantId);
        if (currentStatus.isRevoked) {
            return res.status(400).json({
                success: false,
                message: 'Document is already revoked'
            });
        }

        // Perform revocation
        const revocation = await docService.revokeLetter({
            tenantId,
            generatedLetterId: documentId,
            applicantId: letter.applicantId,
            employeeId: letter.employeeId,
            revokedBy: req.user?.id || req.user?._id,
            revokedByRole: req.user?.role || 'admin',
            reason,
            reasonDetails
        });

        // Log audit trail
        await docService.logAuditAction({
            tenantId,
            documentId,
            applicantId: letter.applicantId,
            employeeId: letter.employeeId,
            action: 'revoked',
            performedBy: req.user?.id || req.user?._id,
            performedByRole: req.user?.role || 'admin',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            reason,
            metadata: { revocationId: revocation._id }
        });

        // Send email notification to applicant/employee
        let recipient = null;
        if (letter.applicantId) {
            recipient = await Applicant.findById(letter.applicantId);
        } else if (letter.employeeId) {
            recipient = await Employee.findById(letter.employeeId);
        }

        if (recipient && recipient.email) {
            try {
                const emailResult = await emailService.sendOfferRevocationEmail({
                    email: recipient.email,
                    name: recipient.name || `${recipient.firstName} ${recipient.lastName}`,
                    positionTitle: letter.letterType === 'offer' ? recipient.designation || 'Position' : 'Position',
                    companyName: process.env.COMPANY_NAME || 'Our Company',
                    revocationReason: reason,
                    revocationDetails: reasonDetails,
                    hrContactName: 'HR Team',
                    hrContactEmail: process.env.HR_EMAIL || 'hr@company.com',
                    tenantId
                });

                // Update revocation record with notification status
                if (emailResult.success) {
                    await LetterRevocation.findByIdAndUpdate(
                        revocation._id,
                        {
                            'notificationSent.email': true,
                            'notificationSent.sentAt': new Date(),
                            'notificationSent.sentTo': [recipient.email]
                        }
                    );
                    // // console.log(`✅ [REVOKE] Notification email sent to ${recipient.email}`);
                }
            } catch (emailErr) {
                console.error(`❌ [REVOKE] Email notification failed:`, emailErr.message);
                // Continue even if email fails
            }
        }

        res.json({
            success: true,
            message: 'Document revoked successfully',
            data: {
                revocationId: revocation._id,
                documentId,
                revokedAt: revocation.revokedAt,
                reason,
                notificationSent: !!(recipient && recipient.email)
            }
        });

    } catch (error) {
        console.error('❌ [REVOKE] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * REINSTATE LETTER/OFFER
 * Only super-admin can reinstate revoked documents
 * Restores access, fully auditable
 */
exports.reinstateLetter = async (req, res) => {
    try {
        const { revocationId } = req.params;
        const { reinstatedReason } = req.body;
        const tenantId = req.user?.tenantId || req.tenantId;

        // Check permissions - only super-admin can reinstate
        if (req.user?.role?.toLowerCase() !== 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Only super-admin can reinstate revoked documents'
            });
        }

        // Initialize service
        const DocumentManagementService = require('../services/DocumentManagementService');
        const docService = new DocumentManagementService(req.tenantDB);

        // Reinstate
        const revocation = await docService.reinstateLetter(revocationId, {
            reinstatedBy: req.user?.id || req.user?._id,
            reinstatedByRole: req.user?.role,
            reinstatedReason
        });

        // Log audit trail
        await docService.logAuditAction({
            tenantId,
            documentId: revocation.generatedLetterId,
            applicantId: revocation.applicantId,
            employeeId: revocation.employeeId,
            action: 'reinstated',
            performedBy: req.user?.id || req.user?._id,
            performedByRole: req.user?.role,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            reason: `Reinstated: ${reinstatedReason || ''}`,
            metadata: { revocationId }
        });

        res.json({
            success: true,
            message: 'Document reinstated successfully',
            data: {
                revocationId: revocation._id,
                documentId: revocation.generatedLetterId,
                reinstatedAt: revocation.reinstatedAt
            }
        });

    } catch (error) {
        console.error('❌ [REINSTATE] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET DOCUMENT AUDIT TRAIL
 * Complete history of all interactions with a document
 * Who created, viewed, downloaded, revoked, etc.
 */
exports.getDocumentAuditTrail = async (req, res) => {
    try {
        const { documentId } = req.params;
        const { limit = 100 } = req.query;
        const tenantId = req.user?.tenantId || req.tenantId;

        // Validate ID
        if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({ success: false, message: 'Invalid document ID' });
        }

        // Initialize service
        const DocumentManagementService = require('../services/DocumentManagementService');
        const docService = new DocumentManagementService(req.tenantDB);

        // Get audit trail
        const trail = await docService.getAuditTrail(documentId, tenantId, parseInt(limit));

        res.json({
            success: true,
            data: {
                documentId,
                auditTrail: trail,
                count: trail.length
            }
        });

    } catch (error) {
        console.error('❌ [AUDIT TRAIL] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * GET REVOCATION HISTORY
 * All revocation and reinstatement events for a document
 */
exports.getRevocationHistory = async (req, res) => {
    try {
        const { documentId } = req.params;
        const tenantId = req.user?.tenantId || req.tenantId;

        // Validate ID
        if (!documentId || !mongoose.Types.ObjectId.isValid(documentId)) {
            return res.status(400).json({ success: false, message: 'Invalid document ID' });
        }

        // Initialize service
        const DocumentManagementService = require('../services/DocumentManagementService');
        const docService = new DocumentManagementService(req.tenantDB);

        // Get revocation history
        const history = await docService.getRevocationHistory(documentId, tenantId);

        res.json({
            success: true,
            data: {
                documentId,
                revocationHistory: history,
                count: history.length
            }
        });

    } catch (error) {
        console.error('❌ [REVOCATION HISTORY] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ENFORCE ACCESS CONTROL
 * Check if user can access document (not revoked, not expired)
 * Called before serving document
 */
exports.enforceDocumentAccess = async (req, res) => {
    try {
        const { documentId } = req.params;
        const tenantId = req.user?.tenantId || req.tenantId;
        const userId = req.user?.id || req.user?._id;

        // Initialize service
        const DocumentManagementService = require('../services/DocumentManagementService');
        const docService = new DocumentManagementService(req.tenantDB);

        // Check access
        const result = await docService.enforceAccessControl(documentId, userId, tenantId);

        if (!result.allowed) {
            return res.status(403).json({ success: false, message: result.reason });
        }

        res.json({ success: true, data: result });

    } catch (error) {
        console.error('❌ [ACCESS CONTROL] Error:', error.message);
        res.status(403).json({ success: false, message: error.message });
    }
};

/**
 * ===================================================================
 * 🧱 DYNAMIC PDF & SIGNATURE WORKFLOW (MERN ARCHITECT)
 * ===================================================================
 */

/**
 * GENERATE DYNAMIC PDF BUFFER
 * Fetches data, populates template, injects signature, and returns PDF buffer.
 */
exports.generateDynamicPDF = async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(process.cwd(), 'debug.log');
    fs.appendFileSync(logFile, `🚀 [DYNAMIC_PDF] Controller Start for ID: ${req.params.id}\n`);
    fs.appendFileSync(logFile, `📋 [DYNAMIC_PDF] TenantID: ${req.tenantId}, Query: ${JSON.stringify(req.query)}\n`);

    try {
        const { id } = req.params;

        // Try to get models
        let models;
        try {
            models = getModels(req);
            fs.appendFileSync(logFile, `✅ [DYNAMIC_PDF] Models retrieved successfully\n`);
        } catch (modelError) {
            fs.appendFileSync(logFile, `❌ [DYNAMIC_PDF] Model retrieval failed: ${modelError.message}\n`);
            return res.status(500).json({ success: false, message: "Database connection error", error: modelError.message });
        }

        const { GeneratedLetter, Candidate, Applicant } = models;

        fs.appendFileSync(logFile, `📄 [DYNAMIC_PDF] Fetching letter with ID: ${id}\n`);
        // 1. Fetch Letter
        const letter = await GeneratedLetter.findById(id).lean();
        if (!letter) {
            fs.appendFileSync(logFile, `❌ [DYNAMIC_PDF] Letter not found: ${id}\n`);
            return res.status(404).send("Document not found in database.");
        }

        fs.appendFileSync(logFile, `📄 [DYNAMIC_PDF] Letter found. Snapshots: ${!!letter.templateSnapshot}, Path: ${letter.pdfPath}\n`);

        // 2. Backward Compatibility & Routing (Phase 4)
        if (letter.generationMode === 'static' || (!letter.templateSnapshot?.bodyContent && letter.pdfPath)) {
            fs.appendFileSync(logFile, `📂 [DYNAMIC_PDF] Mode: STATIC. Serving stored file: ${letter.pdfPath}\n`);

            let cleanPath = letter.pdfPath;
            if (cleanPath.startsWith('/') || cleanPath.startsWith('\\')) {
                cleanPath = cleanPath.substring(1);
            }

            let absolutePath = path.isAbsolute(cleanPath) ? cleanPath : path.join(process.cwd(), 'uploads', cleanPath);

            // Fallback for non-standard paths
            if (!fs.existsSync(absolutePath)) {
                const fallbackPath = path.join(process.cwd(), cleanPath);
                if (fs.existsSync(fallbackPath)) absolutePath = fallbackPath;
            }

            if (fs.existsSync(absolutePath)) {
                res.setHeader("Content-Type", "application/pdf");
                res.setHeader("Content-Disposition", "inline; filename=offer-letter.pdf");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-ID");
                res.setHeader("X-Frame-Options", "ALLOWALL");
                res.setHeader("Content-Security-Policy", "frame-ancestors *;");
                res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
                return res.sendFile(absolutePath);
            } else {
                fs.appendFileSync(logFile, `❌ [DYNAMIC_PDF] Static file MISSING: ${absolutePath}\n`);
                // Fallback to dynamic if content exists despite mode
                if (!letter.templateSnapshot?.bodyContent) {
                    return res.status(404).send("Document not found and cannot be regenerated.");
                }
            }
        }

        // 3. Dynamic Regeneration Engine (Phase 2)
        fs.appendFileSync(logFile, `🔄 [DYNAMIC_PDF] Mode: DYNAMIC. Regenerating from HTML Snapshot...\n`);

        let rawHtml = letter.templateSnapshot?.bodyContent || "";
        const applicant = letter.applicantId ? await Applicant.findById(letter.applicantId).lean() : null;
        const candidate = (applicant && applicant.candidateId) ? await Candidate.findById(applicant.candidateId).lean() : null;
        const data = letter.snapshotData ? (letter.snapshotData instanceof Map ? Object.fromEntries(letter.snapshotData) : letter.snapshotData) : {};

        let finalHtml = rawHtml;

        // Resolve Placeholders from snapshot
        Object.entries(data).forEach(([key, val]) => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            finalHtml = finalHtml.replace(regex, val || "");
        });

        // 4. Signature Safe Injection Layer (Phase 3)
        // DISABLED: HTML Injection removed to favor PDF-lib precise overlay and prevent doubling
        let signatureHtml = "";

        // 4.5 Company Signature Injection (Phase 2 & 3 Integration)
        if (letter.companyApproval && letter.companyApproval.isApproved) {
            const companySig = letter.companyApproval.signatureImage;
            const companyStamp = letter.companyApproval.stampImage;
            const approvedAt = letter.companyApproval.approvedAt;

            const dualSignatureHtml = `
                <div style="display: flex; justify-content: space-between; margin-top: 60px; page-break-inside: avoid; align-items: flex-end;">
                    <!-- Candidate (Left) - Using PDF-lib for signature image -->
                    <div style="flex: 1; text-align: left;">
                        <div style="display: inline-block;">
                            <div style="border-bottom: 1.5px solid #1e293b; width: 220px; margin-bottom: 5px; height: 50px;"></div>
                            <p style="font-size: 10px; color: #475569; font-weight: 700; margin: 5px 0 2px 0; text-transform: uppercase;">Candidate Signature</p>
                            <p style="font-size: 11px; color: #1e293b; font-weight: 600; margin: 0;">${candidate?.name || applicant?.firstName || 'Candidate'}</p>
                        </div>
                    </div>
                    
                    <!-- Company (Right) - Using PDF-lib for signature & stamp -->
                    <div style="flex: 1; text-align: right; position: relative;">
                        <div style="display: inline-block; text-align: left; position: relative; z-index: 2;">
                            <div style="border-bottom: 1.5px solid #1e293b; width: 220px; margin-bottom: 5px; height: 50px;"></div>
                            <p style="font-size: 10px; color: #475569; font-weight: 700; margin: 5px 0 2px 0; text-transform: uppercase;">For Gitakshmi Technologies</p>
                            <p style="font-size: 11px; color: #1e293b; font-weight: 600; margin: 0;">Authorized Signatory</p>
                            <p style="font-size: 9px; color: #94a3b8; margin: 2px 0 0 0;">Date: ${new Date(approvedAt).toLocaleDateString('en-GB')}</p>
                        </div>
                    </div>
                </div>
            `;
            signatureHtml = dualSignatureHtml;
        }

        // Standardized Injection Placeholders
        if (finalHtml.includes('id="candidate-signature-container"')) {
            finalHtml = finalHtml.replace(/id="candidate-signature-container"[^>]*>.*?<\/div>/s, `id="candidate-signature-container">${signatureHtml}</div>`);
        } else if (finalHtml.includes('{{SIGNATURE}}')) {
            finalHtml = finalHtml.replace('{{SIGNATURE}}', signatureHtml);
        } else if (finalHtml.includes('id="candidate-signature-placeholder"')) {
            finalHtml = finalHtml.replace(/id="candidate-signature-placeholder"[^>]*>.*?<\/div>/s, `id="candidate-signature-placeholder">${signatureHtml}</div>`);
        } else {
            finalHtml += signatureHtml;
        }

        // 5. Wrap in Professional A4 Wrapper with Stored CSS (Phase 2)
        const wrappedHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                    body { font-family: 'Inter', sans-serif; line-height: 1.6; color: #1e293b; padding: 0; margin: 0; background: #f1f5f9; -webkit-print-color-adjust: exact; }
                    .document-wrapper { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 25mm; box-sizing: border-box; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.05); }
                    .content-section { font-size: 14px; text-align: justify; word-wrap: break-word; }
                    p { margin-bottom: 12px; }
                    @page { size: A4; margin: 0; }
                    @media print {
                        body { background: none; }
                        .document-wrapper { box-shadow: none; margin: 0; width: 100%; border: none; }
                    }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; }
                    th { background: #f8fafc; font-weight: 700; color: #475569; }
                    .logo-img { max-height: 70px; margin-bottom: 30px; object-fit: contain; }
                </style>
            </head>
            <body>
                <div class="document-wrapper">
                    <div class="content-section">${finalHtml}</div>
                </div>
            </body>
            </html>
        `;

        // 6. Generate via Puppeteer
        const puppeteerService = require('../services/PuppeteerPDFService');
        const pdfBuffer = await puppeteerService.generatePDFBuffer(wrappedHtml);

        if (!pdfBuffer || pdfBuffer.length === 0) {
            fs.appendFileSync(logFile, `❌ [DYNAMIC_PDF] Generated buffer is empty\n`);
            return res.status(500).send("Failed to generate PDF content.");
        }

        // 7. Send Response (🔎 STEP 7: DO NOT BREAK STRUCTURE)
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'inline; filename=offer-letter.pdf',
            'Content-Length': pdfBuffer.length,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
            'X-Frame-Options': 'ALLOWALL',
            'Content-Security-Policy': 'frame-ancestors *;',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        });

        fs.appendFileSync(logFile, `✅ [DYNAMIC_PDF] Sending BINARY PDF Buffer (${pdfBuffer.length} bytes)\n`);

        return res.send(pdfBuffer);

    } catch (error) {
        fs.appendFileSync(logFile, `❌ [DYNAMIC_PDF] Critical Failure: ${error.message}\n`);
        console.error('❌ [DYNAMIC PDF] Critical Failure:', error);

        // 🔎 STEP 6: Fail-safe fallback logic
        res.status(500).json({
            success: false,
            message: "Offer letter generation failed",
            error: error.message
        });
    }
};

/**
 * SIGN LETTER
 */
exports.signLetter = async (req, res) => {
    try {
        const { id } = req.params;
        const { signatureImage } = req.body;
        const { id: candidateId } = req.candidate;
        const { GeneratedLetter, Candidate, Applicant } = getModels(req);

        const letter = await GeneratedLetter.findById(id);
        if (!letter) return res.status(404).json({ success: false, message: "Letter not found" });

        // Security: Ownership Check
        const applicant = await Applicant.findById(letter.applicantId);
        if (!applicant || String(applicant.candidateId) !== String(candidateId)) {
            return res.status(403).json({ success: false, message: "Unauthorized access to this document." });
        }

        if (letter.status === "Accepted") {
            return res.status(400).json({ success: false, message: "Locked: Document already accepted." });
        }

        // Save Signature & Update Status
        await Candidate.findByIdAndUpdate(candidateId, { digitalSignature: signatureImage });
        letter.status = "Signed";

        // FIX: Ensure tenant field is present to satisfy validation
        if (!letter.tenant) {
            letter.tenant = req.tenantId || req.candidate?.tenantId || applicant?.tenantId;
        }

        await letter.save();

        res.json({ success: true, message: "Digital signature applied successfully." });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * ACCEPT LETTER
 */
exports.acceptLetter = async (req, res) => {
    try {
        const { id } = req.params;
        const { id: candidateId } = req.candidate;
        const { GeneratedLetter, Applicant } = getModels(req);

        const letter = await GeneratedLetter.findById(id);
        if (!letter) return res.status(404).json({ success: false, message: "Letter not found" });

        // Security: Ownership Check
        const applicant = await Applicant.findById(letter.applicantId);
        if (!applicant || String(applicant.candidateId) !== String(candidateId)) {
            return res.status(403).json({ success: false, message: "Unauthorized access to this document." });
        }


        letter.status = "Accepted";
        letter.acceptedAt = new Date();

        // FIX: Ensure tenant field is present to satisfy validation
        if (!letter.tenant) {
            letter.tenant = req.tenantId || req.candidate?.tenantId || applicant?.tenantId;
        }

        await letter.save();

        // Update Applicant Status to New Workflow Stage
        applicant.status = 'Offer Accepted – Awaiting Company Approval';
        if (!applicant.timeline) applicant.timeline = [];
        applicant.timeline.push({
            status: 'Offer Accepted – Awaiting Company Approval',
            message: 'Candidate has accepted the offer conditions. Awaiting final company approval and signature.',
            updatedBy: 'Candidate (Letter)',
            timestamp: new Date()
        });
        await applicant.save();

        res.json({ success: true, message: "Offer conditions accepted. Awaiting company final signing." });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * APPROVE COMPANY SIGNATURE (HR ACTION)
 * - HR approves the offer
 * - Adds company signature and stamp
 * - Finalizes the document
 */
exports.approveCompanySignature = async (req, res) => {
    try {
        const { id } = req.params;
        const { signatureImage, stampImage, stampSettings } = req.body;

        const db = req.tenantDB;
        if (!db) return res.status(500).json({ success: false, message: "DB connection missing" });

        // Ensure models are registered correctly
        ['GeneratedLetter', 'Applicant', 'CompanyProfile', 'Notification'].forEach(m => {
            if (!db.models[m]) {
                try { db.model(m, require(`../models/${m}`)); } catch (e) { }
            }
        });

        const GeneratedLetter = db.model("GeneratedLetter");
        const Applicant = db.model("Applicant");
        const CompanyProfile = db.model("CompanyProfile");
        const Notification = db.model("Notification");

        const letter = await GeneratedLetter.findById(id);
        if (!letter) return res.status(404).json({ success: false, message: "Letter not found" });

        const applicant = await Applicant.findById(letter.applicantId);
        if (!applicant) return res.status(404).json({ success: false, message: "Applicant not found" });

        // Fetch company profile for auto-signature fallback if needed
        const profile = await CompanyProfile.findOne({ tenantId: req.user.tenantId });
        const finalCompanySig = signatureImage || profile?.signatory?.signatureImage;

        // --- PDF Overlay Logic ---
        let finalPdfPath = null;
        try {
            const fs = require('fs');
            const path = require('path');
            const { PDFDocument, rgb } = require('pdf-lib');
            const uploadsDir = path.join(__dirname, '..', 'uploads');

            // Find source PDF (Preferably the one signed by candidate)
            let relativeSourcePath = (letter.signedPdfPath || letter.pdfPath || '').replace(/^[\\/]+/, '').replace(/\\/g, '/');
            if (relativeSourcePath.startsWith('uploads/')) {
                relativeSourcePath = relativeSourcePath.replace(/^uploads\//, '');
            }

            let sourcePdfPath = path.join(uploadsDir, relativeSourcePath);

            // Fallback check
            if (!fs.existsSync(sourcePdfPath)) {
                console.warn(`[APPROVE_COMPANY] Source not found at ${sourcePdfPath}. Trying direct path.`);
                const directPath = path.join(process.cwd(), (letter.signedPdfPath || letter.pdfPath || '').replace(/\\/g, '/'));
                if (fs.existsSync(directPath)) sourcePdfPath = directPath;
            }

            if (fs.existsSync(sourcePdfPath)) {
                // // console.log(`[APPROVE_COMPANY] Overlaying company sig on: ${sourcePdfPath}`);
                const existingPdfBytes = fs.readFileSync(sourcePdfPath);
                const pdfDoc = await PDFDocument.load(existingPdfBytes);
                const pages = pdfDoc.getPages();
                const lastPage = pages[pages.length - 1];
                const { width, height } = lastPage.getSize();

                // --- 1. Candidate Signature (Already applied in signLetter, so we SKIP here to prevent doubling) ---
                // We proceed directly to company overlays on top of the already signed (if any) PDF.

                // --- 2. Overlay Company Signature ---
                if (finalCompanySig) {
                    try {
                        const compSigBase64 = finalCompanySig.split(',')[1] || finalCompanySig;
                        const compSigBuffer = Buffer.from(compSigBase64, 'base64');
                        let embeddedCompSig;
                        try { embeddedCompSig = await pdfDoc.embedPng(compSigBuffer); } catch (e) { embeddedCompSig = await pdfDoc.embedJpg(compSigBuffer); }

                        const compSigDims = embeddedCompSig.scale(0.35);
                        // Position on the LEFT side
                        const compX = 70;
                        const compY = 110;

                        lastPage.drawImage(embeddedCompSig, {
                            x: compX,
                            y: compY,
                            width: compSigDims.width,
                            height: compSigDims.height,
                        });
                        // // console.log(`[APPROVE_COMPANY] Applied Company Signature at (${compX}, ${compY})`);
                    } catch (err) {
                        console.warn(`[APPROVE_COMPANY] Failed to apply company signature: ${err.message}`);
                    }
                }

                // --- 3. Overlay Company Stamp ---
                if (stampImage) {
                    try {
                        const stampBase64 = stampImage.split(',')[1] || stampImage;
                        const stampBuffer = Buffer.from(stampBase64, 'base64');
                        let embeddedStamp;
                        try { embeddedStamp = await pdfDoc.embedPng(stampBuffer); } catch (e) { embeddedStamp = await pdfDoc.embedJpg(stampBuffer); }

                        const scaleFactor = stampSettings?.scale || 0.30;
                        const stampDims = embeddedStamp.scale(scaleFactor);

                        let xPos, yPos;
                        if (stampSettings) {
                            // Convert percentage coordinates from frontend to PDF points
                            const xPercent = stampSettings.x; // 0-100
                            const yPercent = stampSettings.y; // 0-100 (percentage from top in frontend usually)

                            xPos = (xPercent / 100) * width - (stampDims.width / 2);
                            // Flip Y coordinate as PDF is 0 at bottom
                            yPos = height - ((yPercent / 100) * height) - (stampDims.height / 2);
                        } else {
                            xPos = 40;
                            yPos = 180;
                        }

                        lastPage.drawImage(embeddedStamp, {
                            x: xPos,
                            y: yPos,
                            width: stampDims.width,
                            height: stampDims.height,
                            opacity: 0.8, // Slight transparency for stamps
                        });
                    } catch (err) {
                        console.warn(`[APPROVE_COMPANY] Failed to apply stamp: ${err.message}`);
                    }
                }

                // --- 4. Overlay Date ---
                try {
                    const dateStr = new Date().toLocaleDateString('en-GB');
                    lastPage.drawText(`Date: ${dateStr}`, {
                        x: 70,
                        y: 85,
                        size: 9,
                        color: rgb(0, 0, 0),
                    });
                } catch (e) { }

                // --- Save Fully Signed PDF ---
                const pdfBytes = await pdfDoc.save();
                const sourceBaseName = path.basename(sourcePdfPath).replace(/^Signed_/, '');
                const originalName = sourceBaseName.replace(/^(FullySigned_\d+_)+/, '');
                const finalName = `FullySigned_${Date.now()}_${originalName}`;
                const absoluteFinalPath = path.join(path.dirname(sourcePdfPath), finalName);

                fs.writeFileSync(absoluteFinalPath, Buffer.from(pdfBytes));

                // Set relative path for DB
                finalPdfPath = `uploads/${path.relative(uploadsDir, absoluteFinalPath).replace(/\\/g, '/')}`;
            } else {
                return res.status(404).json({ success: false, message: "Source PDF files not found. Please try regenerating the letter." });
            }

        } catch (pdfErr) {
            console.error('[APPROVE_COMPANY] PDF operations failed:', pdfErr);
            return res.status(500).json({ success: false, message: "Failed to process PDF: " + pdfErr.message });
        }

        // Update Record
        letter.companyApproval = {
            approvedBy: req.user.id,
            approvedAt: new Date(),
            signatureImage: finalCompanySig,
            stampImage: stampImage,
            isApproved: true
        };
        letter.status = 'approved';
        if (finalPdfPath) letter.signedPdfPath = finalPdfPath;
        await letter.save();

        applicant.status = 'Fully Signed';
        if (finalPdfPath) applicant.signedOfferPath = finalPdfPath;

        if (!applicant.timeline) applicant.timeline = [];
        applicant.timeline.push({
            status: 'Fully Signed',
            message: 'Offer letter has been fully signed and stamped by company. Process complete.',
            updatedBy: req.user.name || 'HR',
            timestamp: new Date()
        });
        await applicant.save();

        // Send Notification Email to Candidate
        try {
            const companyName = req.tenantId || 'Our Company'; // Ideally fetch from company profile
            await emailService.sendOfferFullySignedEmail(
                applicant.email,
                applicant.name,
                applicant.requirementId?.jobTitle || 'the position',
                companyName,
                req.tenantId
            );
        } catch (emailErr) {
            console.error('⚠️ [APPROVE_COMPANY] Email notification failed:', emailErr.message);
        }

        res.json({
            success: true,
            message: "Offer letter approved and fully signed.",
            status: 'Fully Signed'
        });

    } catch (error) {
        console.error('❌ [APPROVE_COMPANY] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.approveCompanyJoiningSignature = async (req, res) => {
    try {
        const { id } = req.params;
        const { signatureImage, stampImage, stampSettings } = req.body;
        const onboardingCtrl = require('./onboarding.controller');

        const db = req.tenantDB;
        if (!db) return res.status(500).json({ success: false, message: "DB connection missing" });

        ['GeneratedLetter', 'Applicant', 'CompanyProfile', 'Notification', 'Requirement'].forEach(m => {
            if (!db.models[m]) {
                try { db.model(m, require(`../models/${m}`)); } catch (e) { }
            }
        });

        const GeneratedLetter = db.model("GeneratedLetter");
        const Applicant = db.model("Applicant");
        const CompanyProfile = db.model("CompanyProfile");
        const Notification = db.model("Notification");
        const Requirement = db.model("Requirement");

        const letter = await GeneratedLetter.findById(id);
        if (!letter) return res.status(404).json({ success: false, message: "Letter not found" });

        const applicant = await Applicant.findById(letter.applicantId);
        if (!applicant) return res.status(404).json({ success: false, message: "Applicant not found" });

        const profile = await CompanyProfile.findOne({ tenantId: req.user.tenantId });
        const finalCompanySig = signatureImage || profile?.signatory?.signatureImage;

        // --- PDF Overlay Logic ---
        let finalPdfPath = null;
        try {
            const fs = require('fs');
            const path = require('path');
            const { PDFDocument, rgb } = require('pdf-lib');
            const uploadsDir = path.join(__dirname, '..', 'uploads');

            let relativeSourcePath = (letter.signedPdfPath || letter.pdfPath || '').replace(/^[\\/]+/, '').replace(/\\/g, '/');
            if (relativeSourcePath.startsWith('uploads/')) {
                relativeSourcePath = relativeSourcePath.replace(/^uploads\//, '');
            }

            let sourcePdfPath = path.join(uploadsDir, relativeSourcePath);
            if (!fs.existsSync(sourcePdfPath)) {
                const directPath = path.join(process.cwd(), (letter.signedPdfPath || letter.pdfPath || '').replace(/\\/g, '/'));
                if (fs.existsSync(directPath)) sourcePdfPath = directPath;
            }

            if (fs.existsSync(sourcePdfPath)) {
                const existingPdfBytes = fs.readFileSync(sourcePdfPath);
                const pdfDoc = await PDFDocument.load(existingPdfBytes);
                const pages = pdfDoc.getPages();
                const lastPage = pages[pages.length - 1];
                const { width, height } = lastPage.getSize();

                if (finalCompanySig) {
                    try {
                        const compSigBase64 = finalCompanySig.split(',')[1] || finalCompanySig;
                        const compSigBuffer = Buffer.from(compSigBase64, 'base64');
                        let embeddedCompSig;
                        try { embeddedCompSig = await pdfDoc.embedPng(compSigBuffer); } catch (e) { embeddedCompSig = await pdfDoc.embedJpg(compSigBuffer); }
                        const compSigDims = embeddedCompSig.scale(0.35);
                        lastPage.drawImage(embeddedCompSig, { x: 70, y: 110, width: compSigDims.width, height: compSigDims.height });
                    } catch (err) { console.warn(`[APPROVE_COMPANY_JOINING] Sig failed: ${err.message}`); }
                }

                if (stampImage) {
                    try {
                        const stampBase64 = stampImage.split(',')[1] || stampImage;
                        const stampBuffer = Buffer.from(stampBase64, 'base64');
                        let embeddedStamp;
                        try { embeddedStamp = await pdfDoc.embedPng(stampBuffer); } catch (e) { embeddedStamp = await pdfDoc.embedJpg(stampBuffer); }
                        const scaleFactor = stampSettings?.scale || 0.30;
                        const stampDims = embeddedStamp.scale(scaleFactor);
                        let xPos, yPos;
                        if (stampSettings) {
                            xPos = (stampSettings.x / 100) * width - (stampDims.width / 2);
                            yPos = height - ((stampSettings.y / 100) * height) - (stampDims.height / 2);
                        } else {
                            xPos = 40; yPos = 180;
                        }
                        lastPage.drawImage(embeddedStamp, { x: xPos, y: yPos, width: stampDims.width, height: stampDims.height, opacity: 0.8 });
                    } catch (err) { console.warn(`[APPROVE_COMPANY_JOINING] Stamp failed: ${err.message}`); }
                }

                try {
                    const dateStr = new Date().toLocaleDateString('en-GB');
                    lastPage.drawText(`Date: ${dateStr}`, { x: 70, y: 85, size: 9, color: rgb(0, 0, 0) });
                } catch (e) { }

                const pdfBytes = await pdfDoc.save();
                const sourceBaseName = path.basename(sourcePdfPath).replace(/^Signed_/, '');
                const finalName = `FullySigned_Joining_${Date.now()}_${sourceBaseName.replace(/^(FullySigned_Joining_\d+_)+/, '')}`;
                const absoluteFinalPath = path.join(path.dirname(sourcePdfPath), finalName);
                fs.writeFileSync(absoluteFinalPath, Buffer.from(pdfBytes));
                finalPdfPath = `uploads/${path.relative(uploadsDir, absoluteFinalPath).replace(/\\/g, '/')}`;
            } else {
                return res.status(404).json({ success: false, message: "Source PDF not found" });
            }
        } catch (pdfErr) {
            return res.status(500).json({ success: false, message: "PDF Error: " + pdfErr.message });
        }

        letter.companyApproval = { approvedBy: req.user.id, approvedAt: new Date(), signatureImage: finalCompanySig, stampImage: stampImage, isApproved: true };
        letter.status = 'approved';
        if (finalPdfPath) letter.signedPdfPath = finalPdfPath;
        await letter.save();

        applicant.status = 'Joining Letter Signed & Stamped';
        applicant.joiningLetterStatus = 'SIGNED_AND_STAMPED';
        if (finalPdfPath) applicant.joiningLetterPath = finalPdfPath;

        if (!applicant.timeline) applicant.timeline = [];
        applicant.timeline.push({
            status: 'Joining Finalized',
            message: 'Joining letter sealed by HR. Employee credentials and onboarding sent to candidate.',
            updatedBy: req.user.name || 'HR',
            timestamp: new Date()
        });
        await applicant.save();

        // --- Trigger Onboarding (Send Credentials) ---
        let onboardingResult = null;
        try {
            const job = applicant.requirementId ? await Requirement.findById(applicant.requirementId).lean() : null;
            onboardingResult = await onboardingCtrl.autoStartOnboardingForApplicant({
                req: { ...req, tenantId: req.user.tenantId, tenantDB: db },
                applicant: applicant,
                actor: { id: req.user.id, name: req.user.name, role: 'hr' },
                source: 'joining_letter_finalized'
            });
        } catch (autoStartErr) {
            console.error('[APPROVE_JOINING][AUTO_ONBOARDING] Failed:', autoStartErr);
        }

        res.json({
            success: true,
            message: "Joining letter approved. Onboarding invite sent to candidate.",
            status: 'Fully Signed',
            onboarding: onboardingResult
        });

    } catch (error) {
        console.error('❌ [APPROVE_JOINING] Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * Secure Candidate PDF Viewer
 * Simplified PDF serving for candidate portal that doesn't require complex tenant resolution
 * Works with iframes and object tags
 */
exports.viewCandidatePDF = async (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const logFile = path.join(process.cwd(), 'candidate_pdf_debug.log');

    try {
        const { id } = req.params;
        const { tenantId, token } = req.query;

        fs.appendFileSync(logFile, `\n[${new Date().toISOString()}] 📄 Candidate PDF Request | ID: ${id} | TenantID: ${tenantId}\n`);

        if (!tenantId) {
            fs.appendFileSync(logFile, `❌ Missing tenantId in query\n`);
            return res.status(400).json({ success: false, message: "Tenant ID required" });
        }

        // --- SECURITY: ACCESS CONTROL ENFORCEMENT ---
        // 1) Try existing middleware-authenticated user (e.g. from /api/ HRM session)
        const normalizedTenantId = String(tenantId || '').trim();
        const userTenantId = String(req.user?.tenantId || req.user?.tenant || req.user?.companyId || '').trim();
        
        let isSessionAuthorized = Boolean(
            req.user &&
            (userTenantId === normalizedTenantId || String(req.user?.role || '').toLowerCase() === 'psa')
        );

        // 2) Public route fallback: read auth token from cookies/header and verify inline
        // This is critical for iframes which might not send Authorization headers but DO send cookies.
        if (!isSessionAuthorized) {
            try {
                const authHeader = req.headers.authorization || req.headers.Authorization;
                let tokenFromRequest = null;
                
                if (authHeader) {
                    const parts = String(authHeader).split(' ');
                    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) tokenFromRequest = parts[1];
                }
                
                if (!tokenFromRequest && req.cookies) {
                    // Check all possible auth cookies including Job Portal specific one
                    tokenFromRequest =
                        req.cookies.candidateAccessToken || // Job Portal cookie
                        req.cookies.sso_token ||
                        req.cookies.accessToken ||
                        req.cookies.token ||
                        req.cookies.jwt ||
                        null;
                }

                if (tokenFromRequest) {
                    const payload = verifyJwtWithCandidates(tokenFromRequest);
                    const payloadRole = String(payload?.role || '').toLowerCase();
                    const payloadTenantId = String(payload?.tenantId || payload?.tenant || payload?.companyId || '').trim();
                    
                    // Allow Admins/HR for their tenant, or the candidate themselves for their tenant
                    const isAdminLike = ['psa', 'super_admin', 'company_admin', 'company_super_admin', 'admin', 'hr', 'hr_admin', 'hr_manager'].includes(payloadRole);
                    const isCandidate = payloadRole === 'candidate';
                    
                    if ((isAdminLike || isCandidate) && payloadTenantId === normalizedTenantId) {
                        isSessionAuthorized = true;
                        fs.appendFileSync(logFile, `✅ Session Auth Success | Role: ${payloadRole}\n`);
                    }
                }
            } catch (authErr) {
                fs.appendFileSync(logFile, `⚠️ Session Auth Inline Verification Failed: ${authErr.message}\n`);
                // ignore and continue to token-based gate below
            }
        }

        // 3. If NO session auth, we MUST HAVE a valid onboarding token in the query
        const hasValidQueryToken = !!token && token.length > 20;

        if (!isSessionAuthorized && !hasValidQueryToken) {
            fs.appendFileSync(logFile, `❌ UNAUTHORIZED: No session and no token provided | Cookies: ${Object.keys(req.cookies || {}).join(',')}\n`);
            return res.status(403).json({ success: false, error: 'forbidden', message: "Authorization required to view this document." });
        }

        // Renaming back to hasAdminAuth for consistency with the rest of the function if needed, 
        // but it's cleaner to use isSessionAuthorized now.
        const hasAdminAuth = isSessionAuthorized; 

        // Get tenant-specific database connection
        const getTenantDB = require('../utils/tenantDB');
        const tenantDB = await getTenantDB(tenantId);

        if (!tenantDB) {
            fs.appendFileSync(logFile, `❌ Failed to get tenant DB for: ${tenantId}\n`);
            return res.status(500).json({ success: false, message: "Database connection failed" });
        }

        // Fetch models
        const GeneratedLetter = tenantDB.model('GeneratedLetter');
        const OnboardingInstance = tenantDB.model('OnboardingInstance');

        // Fetch the letter
        const letter = await GeneratedLetter.findById(id).lean();

        const isDownload = req.query.download === 'true';
        const disposition = isDownload ? 'attachment' : 'inline';

        if (!letter) {
            fs.appendFileSync(logFile, `❌ Letter not found: ${id}\n`);
            return res.status(404).send("Document not found");
        }

        // --- TOKEN VALIDATION ---
        if (!hasAdminAuth) {
            // If the letter is part of onboarding, verify the token
            if (letter.applicantId || letter.employeeId) {
                const targetId = letter.applicantId || letter.employeeId;
                const onboarding = await OnboardingInstance.findOne({
                    $or: [{ applicantId: targetId }, { employeeId: targetId }]
                }).select('onboardingTokenHash onboardingTokenExpiresAt').lean();

                if (onboarding) {
                    const { hashToken } = require('../utils/token.utils');
                    const calculatedHash = hashToken(token);

                    if (onboarding.onboardingTokenHash !== calculatedHash) {
                        fs.appendFileSync(logFile, `❌ TOKEN MISMATCH for letter ${id}\n`);
                        return res.status(403).json({ success: false, message: "Invalid access token" });
                    }

                    if (onboarding.onboardingTokenExpiresAt && new Date(onboarding.onboardingTokenExpiresAt) < new Date()) {
                        fs.appendFileSync(logFile, `❌ TOKEN EXPIRED for letter ${id}\n`);
                        return res.status(403).json({ success: false, message: "Access token has expired" });
                    }
                } else {
                    // No onboarding instance? If it's a private letter, reject.
                    fs.appendFileSync(logFile, `❌ NO ONBOARDING INSTANCE for private letter ${id}\n`);
                    return res.status(403).json({ success: false, message: "Secure access required" });
                }
            }
        }

        fs.appendFileSync(logFile, `✅ [V7-FINAL-FIDELITY] Letter found | Status: ${letter.status} | Mode: ${letter.generationMode} | Path: ${letter.pdfPath}\n`);

        // PRIORITY 1: USE THE ACTUAL STATIC PDF FILE (This is the ONLY way to keep exact HR format)
        if (letter.pdfPath) {
            let cleanPath = letter.pdfPath;
            if (cleanPath.startsWith('/') || cleanPath.startsWith('\\')) {
                cleanPath = cleanPath.substring(1);
            }

            let absolutePath = path.isAbsolute(cleanPath)
                ? cleanPath
                : path.join(process.cwd(), 'uploads', cleanPath);

            // Fallback path resolution
            if (!fs.existsSync(absolutePath)) {
                const fallbackPath = path.join(process.cwd(), cleanPath);
                if (fs.existsSync(fallbackPath)) {
                    absolutePath = fallbackPath;
                }
            }

            if (fs.existsSync(absolutePath)) {
                fs.appendFileSync(logFile, `✅ Found base PDF: ${absolutePath}\n`);

                const Letter = tenantDB.model('GeneratedLetter');
                const Applicant = tenantDB.model('Applicant');
                const Candidate = tenantDB.model('Candidate');
                const SignedLetterModel = tenantDB.model('SignedLetter');

                // 1. Determine the REAL base filename (remove any "Signed_" recursion)
                let baseName = path.basename(absolutePath);
                while (baseName.startsWith('Signed_')) {
                    baseName = baseName.replace('Signed_', '');
                }
                const baseDir = path.dirname(absolutePath);
                const originalAbsolutePath = path.join(baseDir, baseName);
                const signedAbsolutePath = path.join(baseDir, `Signed_${baseName}`);

                // Case A: Serve signed version if it exists on disk OR in DB
                // Aggressively check both DB path and calculated path
                let finalSignedPath = null;

                if (letter.signedPdfPath) {
                    const dbPath = path.join(process.cwd(), 'uploads', letter.signedPdfPath.replace(/^\/+/, ''));
                    // Handle potential double uploads/ prefix
                    const correctedDbPath = dbPath.replace(/uploads[\\/]uploads/, 'uploads');

                    if (fs.existsSync(dbPath)) finalSignedPath = dbPath;
                    else if (fs.existsSync(correctedDbPath)) finalSignedPath = correctedDbPath;
                }

                if (!finalSignedPath && fs.existsSync(signedAbsolutePath)) {
                    finalSignedPath = signedAbsolutePath;
                }

                if (finalSignedPath && fs.existsSync(finalSignedPath)) {
                    fs.appendFileSync(logFile, `✅ Serving signed file: ${finalSignedPath}\n`);
                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `${disposition}; filename="Offer_Letter_Signed.pdf"`);
                    res.setHeader('X-Frame-Options', 'ALLOW-FROM *');
                    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");
                    return res.sendFile(finalSignedPath);
                }

                // Case B: Not signed or missing signed file -> Check if we SHOULD sign it
                const signedLetter = await SignedLetterModel.findOne({ letterId: id }).lean();
                const normalizedStatus = String(letter.status || '').toLowerCase();
                const isSignedStatus = ["signed", "accepted", "approved", "fully signed"].includes(normalizedStatus) || normalizedStatus.includes("accepted") || normalizedStatus.includes("signed");

                if (!signedLetter && !isSignedStatus) {
                    fs.appendFileSync(logFile, `📄 Serving original. Status: ${letter.status}\n`);
                    res.setHeader('Content-Type', 'application/pdf');
                    return res.sendFile(originalAbsolutePath);
                }

                // Case C: SIGNED but need overlay
                try {
                    const applicant = letter.applicantId ? await Applicant.findById(letter.applicantId).lean() : null;
                    const candidate = (applicant && applicant.candidateId) ? await Candidate.findById(applicant.candidateId).lean() : null;
                    const signatureImage = signedLetter?.signatureImage || candidate?.digitalSignature;

                    if (!signatureImage) {
                        fs.appendFileSync(logFile, `⚠️ Signed but no signature found. Serving original.\n`);
                        return res.sendFile(originalAbsolutePath);
                    }

                    fs.appendFileSync(logFile, `✍️ Overlaying signature on: ${baseName}\n`);

                    // Process PDF with pdf-lib
                    const { PDFDocument, rgb } = require('pdf-lib');
                    const existingPdfBytes = fs.readFileSync(absolutePath); // Use absolutePath (original) as base
                    const pdfDoc = await PDFDocument.load(existingPdfBytes);
                    const pages = pdfDoc.getPages();
                    const lastPage = pages[pages.length - 1];
                    const { width, height } = lastPage.getSize();

                    // Process signature image
                    const base64Data = signatureImage.split(',')[1] || signatureImage;
                    const signatureBuffer = Buffer.from(base64Data, 'base64');

                    let embeddedImage;
                    try {
                        embeddedImage = await pdfDoc.embedPng(signatureBuffer);
                    } catch (e) {
                        embeddedImage = await pdfDoc.embedJpg(signatureBuffer);
                    }

                    // Dynamic Positioning from DB
                    const { x: xPct = 74, y: yPct = 80, scale: userScale = 0.4, widthPct } = signedLetter?.signaturePosition || {};

                    // Chrome PDF Viewer padding compensation
                    const adjustedYPct = yPct + 3.5;

                    let imgDims;
                    if (widthPct) {
                        const targetWidth = (widthPct / 100) * width;
                        const proportionalHeight = embeddedImage.height * (targetWidth / embeddedImage.width);
                        imgDims = { width: targetWidth, height: proportionalHeight };
                    } else {
                        imgDims = embeddedImage.scale(userScale);
                    }

                    const xPos = (xPct / 100) * width;
                    const yPos = (1 - (adjustedYPct / 100)) * height - imgDims.height;

                    lastPage.drawImage(embeddedImage, {
                        x: xPos,
                        y: yPos,
                        width: imgDims.width,
                        height: imgDims.height,
                    });

                    const signedDate = signedLetter?.signedAt || letter.updatedAt || new Date();
                    const dateStr = `Digitally Signed by ${candidate?.name || 'Candidate'} on ${new Date(signedDate).toLocaleDateString('en-GB')}`;

                    lastPage.drawText(dateStr, {
                        x: xPos,
                        y: yPos - 12,
                        size: 7,
                        color: rgb(0.4, 0.4, 0.4)
                    });

                    const pdfBytes = await pdfDoc.save();

                    // Define output paths for saving
                    // signedAbsolutePath was defined earlier (line ~4264), use it
                    const signedFilePath = signedAbsolutePath;

                    // Determine relative path for DB
                    let relativeSignedPath = letter.pdfPath || '';
                    if (relativeSignedPath) {
                        const dirName = path.dirname(relativeSignedPath);
                        // We used `Signed_${baseName}` pattern
                        relativeSignedPath = path.join(dirName, `Signed_${baseName}`).replace(/\\/g, '/');
                    }

                    // SAVE THE FILE TO DISK
                    fs.writeFileSync(signedFilePath, Buffer.from(pdfBytes));
                    fs.appendFileSync(logFile, `💾 Saved signed PDF to: ${signedFilePath}\n`);

                    // UPDATE DATABASE so direct downloads work
                    const urlPath = `/uploads/${relativeSignedPath}`;
                    await Letter.findByIdAndUpdate(id, {
                        signedPdfPath: relativeSignedPath,
                        offerLetterUrl: urlPath // Keep this for UI components that rely on it
                    });

                    if (applicant) {
                        await Applicant.findByIdAndUpdate(applicant._id, {
                            signedOfferPath: relativeSignedPath,
                            offerStatus: 'SIGNED',
                            isSigned: true,
                            // We keep offerLetterPath pointing to original
                        });
                    }
                    fs.appendFileSync(logFile, `🗄️ Database updated with signed fields. Status: SIGNED\n`);

                    res.setHeader('Content-Type', 'application/pdf');
                    res.setHeader('Content-Disposition', `${disposition}; filename="Offer_Letter_Signed.pdf"`);
                    res.setHeader('X-Frame-Options', 'ALLOW-FROM *');
                    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' *");
                    return res.status(200).end(Buffer.from(pdfBytes));

                } catch (err) {
                    fs.appendFileSync(logFile, `❌ Persistent Overlay failed: ${err.message}. Serving original as fallback.\n`);
                    return res.sendFile(absolutePath);
                }
            }
        }

        // PRIORITY 2: DYNAMIC FALLBACK (ONLY if static file is missing)
        if (letter.templateSnapshot?.bodyContent) {
            fs.appendFileSync(logFile, `🔄 Using dynamic generation as fallback ONLY\n`);

            const PuppeteerPDFService = require('../services/PuppeteerPDFService');
            let rawHtml = letter.templateSnapshot.bodyContent || "";
            const data = letter.snapshotData ? (letter.snapshotData instanceof Map ? Object.fromEntries(letter.snapshotData) : letter.snapshotData) : {};

            let outputHtml = rawHtml;
            Object.entries(data).forEach(([key, val]) => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                outputHtml = outputHtml.replace(regex, val || "");
            });

            if (!outputHtml.includes('<html')) {
                outputHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body { font-family: 'Inter', sans-serif; margin: 0; padding: 20mm; } @page { size: A4; margin: 0; }</style></head><body>${outputHtml}</body></html>`;
            }

            const pdfBuffer = await PuppeteerPDFService.generatePDFBuffer(outputHtml);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('X-Frame-Options', 'ALLOW-FROM *');
            return res.status(200).end(pdfBuffer);
        }

        fs.appendFileSync(logFile, `❌ No PDF source found\n`);
        return res.status(404).send("PDF not available");

    } catch (error) {
        fs.appendFileSync(logFile, `❌ FATAL: ${error.message}\n`);
        return res.status(500).json({ success: false, message: "Failed to load PDF", error: error.message });
    }
};

// =========================================================================
// JOINING LETTER WORKFLOW — CANDIDATE & HR ACTIONS
// =========================================================================

/**
 * GET /letters/joining/:id/status
 * Returns the current status of a joining letter + expiry info
 * Called by Candidate Portal to render correct UI state
 */
exports.getJoiningLetterStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { GeneratedLetter } = getModels(req);

        const letter = await GeneratedLetter.findById(id).select(
            'joiningLetterStatus joiningLetterExpiryDate joiningLetterRequestedAgain letterType applicantId rejectedAt revisionRequestedAt revisionNote status'
        );
        if (!letter) return res.status(404).json({ message: 'Letter not found' });
        if (letter.letterType !== 'joining') return res.status(400).json({ message: 'Not a joining letter' });

        const now = new Date();
        // Auto-compute if expired (for real-time check without cron)
        let computedStatus = letter.joiningLetterStatus;
        if (
            computedStatus === 'pending' &&
            letter.joiningLetterExpiryDate &&
            now > new Date(letter.joiningLetterExpiryDate)
        ) {
            computedStatus = 'expired';
            // Persist the expire status
            await GeneratedLetter.findByIdAndUpdate(id, { joiningLetterStatus: 'expired' });
        }

        return res.json({
            success: true,
            joiningLetterStatus: computedStatus,
            status: letter.status, // Include generic status (e.g. 'Signed')
            joiningLetterExpiryDate: letter.joiningLetterExpiryDate,
            joiningLetterRequestedAgain: letter.joiningLetterRequestedAgain,
            rejectedAt: letter.rejectedAt,
            revisionRequestedAt: letter.revisionRequestedAt,
            revisionNote: letter.revisionNote
        });
    } catch (err) {
        console.error('[getJoiningLetterStatus]', err.message);
        res.status(500).json({ message: err.message });
    }
};

/**
 * POST /letters/joining/:id/accept
 * Candidate accepts the joining letter
 */
exports.acceptJoiningLetter = async (req, res) => {
    try {
        const { id } = req.params;
        const { GeneratedLetter } = getModels(req);

        const letter = await GeneratedLetter.findById(id);
        if (!letter) return res.status(404).json({ message: 'Letter not found' });
        if (letter.letterType !== 'joining') return res.status(400).json({ message: 'Not a joining letter' });

        // Gate: already accepted/rejected
        if (letter.joiningLetterStatus === 'accepted') {
            return res.status(400).json({ message: 'Letter already accepted' });
        }
        if (letter.joiningLetterStatus === 'rejected') {
            return res.status(400).json({ message: 'Letter was rejected. Cannot accept now.' });
        }

        // Gate: expired
        const now = new Date();
        if (
            letter.joiningLetterStatus === 'expired' ||
            (letter.joiningLetterExpiryDate && now > new Date(letter.joiningLetterExpiryDate))
        ) {
            await GeneratedLetter.findByIdAndUpdate(id, { joiningLetterStatus: 'expired' });
            return res.status(400).json({ message: 'Joining letter has expired. Please request a new one.' });
        }

        letter.joiningLetterStatus = 'accepted';
        letter.acceptedAt = now;
        letter.status = 'accepted';
        await letter.save();

        // // console.log(`✅ [JOINING LETTER] Accepted by candidate — Letter ID: ${id}`);
        return res.json({ success: true, message: 'Joining letter accepted successfully.' });
    } catch (err) {
        console.error('[acceptJoiningLetter]', err.message);
        res.status(500).json({ message: err.message });
    }
};

/**
 * POST /letters/joining/:id/reject
 * Candidate rejects the joining letter
 */
exports.rejectJoiningLetter = async (req, res) => {
    try {
        const { id } = req.params;
        const { GeneratedLetter } = getModels(req);

        const letter = await GeneratedLetter.findById(id);
        if (!letter) return res.status(404).json({ message: 'Letter not found' });
        if (letter.letterType !== 'joining') return res.status(400).json({ message: 'Not a joining letter' });

        if (['accepted', 'rejected'].includes(letter.joiningLetterStatus)) {
            return res.status(400).json({ message: `Letter is already ${letter.joiningLetterStatus}` });
        }

        const now = new Date();
        if (
            letter.joiningLetterStatus === 'expired' ||
            (letter.joiningLetterExpiryDate && now > new Date(letter.joiningLetterExpiryDate))
        ) {
            await GeneratedLetter.findByIdAndUpdate(id, { joiningLetterStatus: 'expired' });
            return res.status(400).json({ message: 'Joining letter has expired.' });
        }

        letter.joiningLetterStatus = 'rejected';
        letter.rejectedAt = now;
        letter.status = 'rejected_by_candidate';
        await letter.save();

        // // console.log(`❌ [JOINING LETTER] Rejected by candidate — Letter ID: ${id}`);
        return res.json({ success: true, message: 'Joining letter rejected.' });
    } catch (err) {
        console.error('[rejectJoiningLetter]', err.message);
        res.status(500).json({ message: err.message });
    }
};

/**
 * POST /letters/joining/:id/request-revision
 * Candidate requests joining letter again after expiry
 */
exports.requestJoiningLetterRevision = async (req, res) => {
    try {
        const { id } = req.params;
        const { note } = req.body;
        const { GeneratedLetter } = getModels(req);

        const letter = await GeneratedLetter.findById(id);
        if (!letter) return res.status(404).json({ message: 'Letter not found' });
        if (letter.letterType !== 'joining') return res.status(400).json({ message: 'Not a joining letter' });

        // Only allow revision request if expired
        if (!['expired', 'rejected'].includes(letter.joiningLetterStatus)) {
            return res.status(400).json({ message: `Cannot request revision when status is '${letter.joiningLetterStatus}'` });
        }

        // Prevent duplicate pending requests
        if (letter.joiningLetterRequestedAgain && letter.joiningLetterStatus === 'revision_requested') {
            return res.status(400).json({ message: 'Revision request already pending. Please wait for HR to respond.' });
        }

        letter.joiningLetterStatus = 'revision_requested';
        letter.joiningLetterRequestedAgain = true;
        letter.revisionRequestedAt = new Date();
        letter.revisionNote = note || '';
        await letter.save();

        // // console.log(`🔁 [JOINING LETTER] Revision requested by candidate — Letter ID: ${id}`);
        return res.json({ success: true, message: 'Revision request sent to HR successfully.' });
    } catch (err) {
        console.error('[requestJoiningLetterRevision]', err.message);
        res.status(500).json({ message: err.message });
    }
};

/**
 * GET /letters/joining/revision-requests
 * HR: Get all joining letters with revision_requested status
 */
exports.getJoiningLetterRevisionRequests = async (req, res) => {
    try {
        const { GeneratedLetter } = getModels(req);
        const tenantId = req.user?.tenantId || req.tenantId;

        const revisionRequests = await GeneratedLetter.find({
            tenant: tenantId,
            letterType: 'joining',
            joiningLetterStatus: 'revision_requested',
            joiningLetterRequestedAgain: true
        })
            .populate('applicantId', 'name email mobile requirementId')
            .sort({ revisionRequestedAt: -1 })
            .lean();

        return res.json({ success: true, total: revisionRequests.length, letters: revisionRequests });
    } catch (err) {
        console.error('[getJoiningLetterRevisionRequests]', err.message);
        res.status(500).json({ message: err.message });
    }
};

/**
 * POST /letters/joining/:id/revise
 * HR revises a joining letter — sets new expiry date and resets status to pending
 * EDIT LOCK: Only allowed when joiningLetterStatus === 'revision_requested'
 */
exports.reviseJoiningLetter = async (req, res) => {
    try {
        const { id } = req.params;
        const { newExpiryDate, hrRevisionNote } = req.body;
        const { GeneratedLetter } = getModels(req);

        if (!newExpiryDate) {
            return res.status(400).json({ message: 'New expiry date is required to revise a joining letter.' });
        }

        const letter = await GeneratedLetter.findById(id);
        if (!letter) return res.status(404).json({ message: 'Letter not found' });
        if (letter.letterType !== 'joining') return res.status(400).json({ message: 'Not a joining letter' });

        // EDIT LOCK: HR can only revise when candidate requested it
        if (letter.joiningLetterStatus !== 'revision_requested') {
            return res.status(403).json({
                message: `Cannot edit joining letter. Current status is '${letter.joiningLetterStatus}'. Edit is only allowed when candidate has requested revision.`
            });
        }

        const parsedNewExpiry = new Date(newExpiryDate);
        if (isNaN(parsedNewExpiry.getTime()) || parsedNewExpiry <= new Date()) {
            return res.status(400).json({ message: 'New expiry date must be a valid future date.' });
        }

        letter.joiningLetterExpiryDate = parsedNewExpiry;
        letter.joiningLetterStatus = 'pending';
        letter.joiningLetterRequestedAgain = false;
        letter.hrRevisionNote = hrRevisionNote || '';
        await letter.save();

        // // console.log(`✅ [JOINING LETTER] Revised by HR — Letter ID: ${id}, New Expiry: ${parsedNewExpiry}`);
        return res.json({ success: true, message: 'Joining letter revised. Candidate can now accept or reject it.' });
    } catch (err) {
        console.error('[reviseJoiningLetter]', err.message);
        res.status(500).json({ message: err.message });
    }
};

exports.getLetterDetailsPublic = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenantId } = req.query;

        if (!tenantId) {
            return res.status(400).json({ success: false, message: "Tenant ID required" });
        }

        const getTenantDB = require('../utils/tenantDB');
        const tenantDB = await getTenantDB(tenantId);
        if (!tenantDB) {
            return res.status(500).json({ success: false, message: "Database connection failed" });
        }

        const GeneratedLetter = tenantDB.model('GeneratedLetter');
        const Applicant = tenantDB.model('Applicant');
        const CompanyProfile = tenantDB.model('CompanyProfile');

        const letter = await GeneratedLetter.findById(id);
        if (!letter) {
            return res.status(404).json({ success: false, message: "Offer letter not found" });
        }

        const applicant = await Applicant.findById(letter.applicantId).populate('requirementId');
        if (!applicant) {
            return res.status(404).json({ success: false, message: "Applicant not found" });
        }

        const company = await CompanyProfile.findOne({ tenantId });

        res.json({
            success: true,
            candidateName: applicant.name,
            jobTitle: applicant.requirementId?.jobTitle || 'Role',
            companyName: company?.companyName || 'Gitakshmi Technologies',
            letter
        });
    } catch (err) {
        console.error('[getLetterDetailsPublic] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.approveOfferPublic = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenantId } = req.body;

        const actualTenantId = tenantId || req.query.tenantId;
        if (!actualTenantId) {
            return res.status(400).json({ success: false, message: "Tenant ID required" });
        }

        const getTenantDB = require('../utils/tenantDB');
        const tenantDB = await getTenantDB(actualTenantId);
        if (!tenantDB) {
            return res.status(500).json({ success: false, message: "Database connection failed" });
        }

        const GeneratedLetter = tenantDB.model('GeneratedLetter');
        const Applicant = tenantDB.model('Applicant');
        const CompanyProfile = tenantDB.model('CompanyProfile');
        const Notification = tenantDB.model('Notification');

        const letter = await GeneratedLetter.findById(id);
        if (!letter) {
            return res.status(404).json({ success: false, message: "Offer letter not found" });
        }

        if (letter.status !== 'pending' && letter.status !== 'Pending') {
            return res.status(400).json({ success: false, message: `Offer letter is already ${letter.status}` });
        }

        const workflowAction = await actionPendingOfferWorkflow({
            tenantDB,
            tenantId: actualTenantId,
            letter,
            action: 'APPROVED',
            comment: req.body.comments || req.body.comment || 'Approved from offer approval email link.',
            req,
        });
        if (workflowAction.handled) {
            return res.json({
                success: true,
                message: workflowAction.completed
                    ? 'Offer letter approved successfully. Candidate has been notified.'
                    : `Approved successfully. Offer moved to ${workflowAction.nextStepName || 'the next approver'}.`,
                data: workflowAction,
            });
        }

        // 1. Update letter status
        letter.status = 'approved';
        letter.approvalStatus = 'APPROVED';
        await letter.save();

        // 2. Update applicant status and timeline
        const applicant = await Applicant.findById(letter.applicantId).populate('requirementId');
        if (!applicant) {
            return res.status(404).json({ success: false, message: "Applicant not found" });
        }

        applicant.status = 'Offer Issued';
        applicant.offerStatus = 'SENT';
        if (!applicant.timeline) applicant.timeline = [];
        applicant.timeline.push({
            status: 'Offer Issued',
            message: `Offer Letter approved by ${letter.approverEmail || 'approver'} and issued to candidate.`,
            updatedBy: 'Approver',
            timestamp: new Date()
        });
        await applicant.save();

        // 3. Send email to candidate and create notification
        const company = await CompanyProfile.findOne({ tenantId: actualTenantId });
        const companyName = company?.companyName || 'Gitakshmi Technologies';
        const jobTitle = applicant.requirementId?.jobTitle || 'Role';

        const attachmentPath = resolveUploadedLetterPath(letter);

        // Queue email dispatch in background
        setImmediate(async () => {
            try {
                if (applicant.email) {
                    await emailService.sendOfferLetterEmail(
                        applicant.email,
                        applicant.name,
                        jobTitle,
                        companyName,
                        attachmentPath,
                        null, // customHtml
                        applicant, // applicant
                        actualTenantId // tenantId
                    );
                }

                if (applicant.candidateId && Notification) {
                    await Notification.create({
                        tenant: actualTenantId,
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
                console.error("⚠️ [APPROVE OFFER PUBLIC] Failed to send candidate notification:", notifyErr.message);
            }
        });

        return res.json({ success: true, message: "Offer letter approved successfully. Candidate has been notified." });
    } catch (err) {
        console.error('[approveOfferPublic] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.rejectOfferPublic = async (req, res) => {
    try {
        const { id } = req.params;
        const { tenantId, rejectionReason } = req.body;

        const actualTenantId = tenantId || req.query.tenantId;
        if (!actualTenantId) {
            return res.status(400).json({ success: false, message: "Tenant ID required" });
        }

        const getTenantDB = require('../utils/tenantDB');
        const tenantDB = await getTenantDB(actualTenantId);
        if (!tenantDB) {
            return res.status(500).json({ success: false, message: "Database connection failed" });
        }

        const GeneratedLetter = tenantDB.model('GeneratedLetter');
        const Applicant = tenantDB.model('Applicant');

        const letter = await GeneratedLetter.findById(id);
        if (!letter) {
            return res.status(404).json({ success: false, message: "Offer letter not found" });
        }

        if (letter.status !== 'pending' && letter.status !== 'Pending') {
            return res.status(400).json({ success: false, message: `Offer letter is already ${letter.status}` });
        }

        const workflowAction = await actionPendingOfferWorkflow({
            tenantDB,
            tenantId: actualTenantId,
            letter,
            action: 'REJECTED',
            comment: rejectionReason || 'Rejected from offer approval email link.',
            req,
        });
        if (workflowAction.handled) {
            return res.json({
                success: true,
                message: 'Offer letter rejected successfully.',
                data: workflowAction,
            });
        }

        // 1. Update letter status
        letter.status = 'rejected';
        letter.approvalStatus = 'REJECTED';
        if (rejectionReason) {
            letter.rejectionReason = rejectionReason;
        }
        await letter.save();

        // 2. Update applicant status and timeline
        const applicant = await Applicant.findById(letter.applicantId);
        if (!applicant) {
            return res.status(404).json({ success: false, message: "Applicant not found" });
        }

        applicant.status = 'Offer Rejected';
        applicant.offerStatus = 'REJECTED';
        if (!applicant.timeline) applicant.timeline = [];
        applicant.timeline.push({
            status: 'Offer Rejected',
            message: `❌ Offer Letter Rejected by Approver. Reason: ${rejectionReason || 'No reason provided'}.`,
            updatedBy: 'Approver',
            timestamp: new Date()
        });
        await applicant.save();

        return res.json({ success: true, message: "Offer letter rejected successfully." });
    } catch (err) {
        console.error('[rejectOfferPublic] Error:', err.message);
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getOfferApprovalChain = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId || req.tenantId;
        const applicantId = req.query.applicantId || req.query.applicationId;
        if (!applicantId || !mongoose.Types.ObjectId.isValid(String(applicantId))) {
            return res.status(400).json({ success: false, message: 'Valid applicantId is required' });
        }

        const { resolveEmployeeForUser } = require('../services/approverResolver.service');
        const requesterEmployee = await resolveEmployeeForUser(req, req.tenantDB);
        const requesterEmployeeId = requesterEmployee?._id || req.user?.employeeId || null;

        const data = await resolveOfferApprovalChainForApplicant({
            tenantDB: req.tenantDB,
            tenantId,
            applicantId,
            requesterEmployeeId,
        });
        return res.json({ success: true, data });
    } catch (error) {
        console.error('Error resolving offer approval chain:', error);
        return res.status(error.statusCode || 500).json({ success: false, message: error.message });
    }
};

exports.getEligibleApprovers = async (req, res) => {
    try {
        const tenantId = req.user?.tenantId || req.tenantId;
        const getTenantDB = require('../utils/tenantDB');
        const tenantDB = await getTenantDB(tenantId);
        if (!tenantDB) {
            return res.status(500).json({ success: false, message: "Database connection failed" });
        }

        const { User } = getModels(req);

        // Find all active users of this tenant
        const users = await User.find({
            mainCompanyId: tenantId,
            isActive: true
        }).select('_id name email role permissions');

        // Filter users who have approval access
        const eligibleUsers = users.filter(user => {
            const roleLower = String(user.role || '').toLowerCase();
            // Non-employees typically have access by default
            if (roleLower !== 'employee') {
                return true;
            }

            // Check permissions explicitly
            if (user.permissions && Array.isArray(user.permissions)) {
                return user.permissions.some(p =>
                    (p.module === 'approval' || p.module?.startsWith('approval.')) &&
                    (p.actions?.view || p.actions?.create || p.actions?.edit || p.actions?.delete)
                );
            }

            return false;
        });

        // Map to a clean object list
        const result = eligibleUsers.map(u => ({
            id: u._id,
            name: u.name,
            email: u.email,
            role: u.role
        }));

        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error fetching eligible approvers:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = exports;
