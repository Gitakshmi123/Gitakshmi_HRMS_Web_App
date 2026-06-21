const ApplicantSchema = require('../models/Applicant');
const multer = require('multer');
const path = require('path');
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const CompanySettings = require('../models/CompanySettings');
const getTenantDB = require('../utils/tenantDB');
const EmailService = require('../services/email.service');
const ResumeParserService = require('../services/ResumeParser.service');
const { stringifyId } = require('../utils/idUtils');

/* ----------------------------------------------------
   MULTER CONFIG (RESUME UPLOAD)
---------------------------------------------------- */
function sanitizeUploadKey(value = '') {
  return String(value || 'field')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'field';
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require('fs');
    const dir = file.fieldname === 'resume'
      ? path.join(__dirname, '../uploads/resumes/')
      : file.fieldname === 'document'
        ? path.join(__dirname, '../uploads/document-ocr/')
        : path.join(__dirname, '../uploads/application-images/');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const prefix = file.fieldname === 'resume'
      ? 'resume'
      : file.fieldname === 'document'
        ? 'document'
        : `image-${sanitizeUploadKey(file.fieldname)}`;
    cb(null, prefix + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const isResumeFile =
      file.fieldname === 'resume' &&
      (
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

    const isParseDocumentFile =
      file.fieldname === 'document' &&
      (
        file.mimetype === 'application/pdf' ||
        file.mimetype === 'application/msword' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype)
      );

    const isCustomImage =
      file.fieldname !== 'resume' &&
      file.fieldname !== 'document' &&
      ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.mimetype);

    if (isResumeFile || isParseDocumentFile || isCustomImage) return cb(null, true);

    if (file.fieldname === 'resume') return cb(new Error('Only PDF and Word resume files allowed'));
    if (file.fieldname === 'document') return cb(new Error('Only PDF, Word, PNG, JPG, JPEG and WEBP files allowed for document scan'));
    return cb(new Error('Only image files allowed for image upload fields'));
  }
});

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePublicIdentifier(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** True only for real 24-hex Mongo ObjectIds (avoids bson isValid() false positives). */
function isHexObjectIdString(value) {
  return /^[0-9a-fA-F]{24}$/.test(String(value || '').trim());
}

/**
 * Some public links mistakenly use a Requirement (job) _id in /jobs/:id instead of tenant id/code.
 * Scan tenant DBs (bounded) to find which tenant owns that job posting.
 */
async function resolveTenantFromJobPostingId(jobId, select) {
  if (!isHexObjectIdString(String(jobId))) return null;

  const RequirementSchema = require('../models/Requirement');
  const scanLimit = Math.max(
    1,
    Math.min(500, Number(process.env.PUBLIC_JOB_RESOLVE_TENANT_SCAN || 300))
  );

  const tenants = await Tenant.find({})
    .select('_id')
    .sort({ updatedAt: -1 })
    .limit(scanLimit)
    .lean();

  for (const t of tenants) {
    try {
      const tenantDB = await getTenantDB(String(t._id));
      if (!tenantDB.models.Requirement) {
        tenantDB.model('Requirement', RequirementSchema);
      }
      const Requirement = tenantDB.model('Requirement');
      const job = await Requirement.findById(jobId).select('tenant').lean();
      if (job?.tenant) {
        const finder = Tenant.findById(String(job.tenant));
        return select ? await finder.select(select) : await finder;
      }
    } catch (_err) {
      /* ignore per-tenant scan errors */
    }
  }
  return null;
}

async function findTenantByIdentifier(identifier, select = null) {
  const cleanIdentifier = String(identifier || '').trim();
  if (!cleanIdentifier) return null;

  const execTenantQuery = (query) => {
    const finder = Tenant.findOne(query);
    return select ? finder.select(select) : finder;
  };

  if (isHexObjectIdString(cleanIdentifier)) {
    const finder = select
      ? Tenant.findById(cleanIdentifier).select(select)
      : Tenant.findById(cleanIdentifier);
    // IMPORTANT: must await — returning a Query breaks callers (they get a non-document).
    const tenantById = await finder;
    if (tenantById) return tenantById;
  }

  const codeMatcher = new RegExp(`^${escapeRegex(cleanIdentifier)}$`, 'i');
  // tenantId is often the public company key (e.g. NITESH1064) — must match case-insensitively like code.
  const tenantIdMatcher = new RegExp(`^${escapeRegex(cleanIdentifier)}$`, 'i');
  let tenant =
    (await execTenantQuery({ code: codeMatcher })) ||
    (await execTenantQuery({ companyCode: codeMatcher })) ||
    (await execTenantQuery({ tenantId: tenantIdMatcher })) ||
    (await execTenantQuery({ name: codeMatcher })) ||
    (await execTenantQuery({ companyName: codeMatcher }));

  // Legacy data shape support: some deployments store public identifiers inside meta.* (Mixed)
  // Examples seen: meta.code, meta.companyCode, meta.tenantId
  if (!tenant) {
    tenant =
      (await execTenantQuery({ 'meta.code': codeMatcher })) ||
      (await execTenantQuery({ 'meta.companyCode': codeMatcher })) ||
      (await execTenantQuery({ 'meta.tenantId': tenantIdMatcher }));
  }

  // Support short public links like /jobs/001 for generated company codes like abc001.
  if (!tenant && /^\d{1,6}$/.test(cleanIdentifier)) {
    const numericSuffixMatcher = new RegExp(`${escapeRegex(cleanIdentifier)}$`, 'i');
    tenant = await execTenantQuery({ code: numericSuffixMatcher });
  }

  // Last resort: treat identifier as a job posting id and resolve its owning tenant.
  if (!tenant && isHexObjectIdString(cleanIdentifier)) {
    tenant = await resolveTenantFromJobPostingId(cleanIdentifier, select);
  }

  // Some tenants store the public careers key only in meta (Mixed) — support common keys.
  if (!tenant) {
    const rx = new RegExp(`^${escapeRegex(cleanIdentifier)}$`, 'i');
    tenant = await execTenantQuery({
      $or: [
        { 'meta.careerPortalCode': rx },
        { 'meta.companyCode': rx },
        { 'meta.careerSlug': rx },
        { 'meta.portalSlug': rx },
        { 'meta.publicCompanyCode': rx }
      ]
    });
  }

  // Company code often lives in CompanySettings.companyCode while Tenant.code is empty.
  if (!tenant) {
    try {
      const codeRx = new RegExp(`^${escapeRegex(cleanIdentifier)}$`, 'i');
      const cs = await CompanySettings.findOne({ companyCode: codeRx }).select('companyId').lean();
      if (cs?.companyId) {
        const finder = Tenant.findById(cs.companyId);
        tenant = select ? await finder.select(select) : await finder;
      }
    } catch (_e) {
      /* ignore */
    }
  }

  // Fallback: company id-config rows duplicate companyCode in some setups.
  if (!tenant) {
    try {
      const CompanyIdConfig = require('../models/CompanyIdConfig');
      const codeRx = new RegExp(`^${escapeRegex(cleanIdentifier)}$`, 'i');
      const cfg = await CompanyIdConfig.findOne({ companyCode: codeRx }).select('companyId').lean();
      if (cfg?.companyId) {
        const finder = Tenant.findById(cfg.companyId);
        tenant = select ? await finder.select(select) : await finder;
      }
    } catch (_e) {
      /* ignore */
    }
  }

  // Loose match on CompanySettings (e.g. company code stored with prefix/suffix in UI).
  if (!tenant && cleanIdentifier.length >= 3) {
    try {
      const contains = new RegExp(escapeRegex(cleanIdentifier), 'i');
      const cs = await CompanySettings.findOne({ companyCode: contains }).select('companyId').lean();
      if (cs?.companyId) {
        const finder = Tenant.findById(cs.companyId);
        tenant = select ? await finder.select(select) : await finder;
      }
    } catch (_e) {
      /* ignore */
    }
  }

  // Last resort: substring match on Tenant fields (handles "GT-NITESH1064", extra spaces, display names).
  if (!tenant && cleanIdentifier.length >= 3) {
    const contains = new RegExp(escapeRegex(cleanIdentifier), 'i');
    tenant = await execTenantQuery({
      $or: [
        { code: contains },
        { companyCode: contains },
        { tenantId: contains },
        { companyName: contains },
        { name: contains }
      ]
    });
  }

  // Final fallback: normalized compare (ignores case, spaces, dashes, underscores).
  // Example: URL `/jobs/dha001` should still match `DHA-001` or `DHA 001`.
  if (!tenant) {
    const target = normalizePublicIdentifier(cleanIdentifier);
    if (target) {
      try {
        const companyRows = await CompanySettings.find({})
          .select('companyCode companyId')
          .sort({ updatedAt: -1 })
          .limit(1000)
          .lean();
        const matchedCompany = companyRows.find((row) => {
          return normalizePublicIdentifier(row?.companyCode) === target;
        });
        if (matchedCompany?.companyId) {
          const finder = Tenant.findById(String(matchedCompany.companyId));
          tenant = select ? await finder.select(select) : await finder;
        }
      } catch (_e) {
        /* ignore */
      }

      if (!tenant) {
        try {
          const CompanyIdConfig = require('../models/CompanyIdConfig');
          const codeRows = await CompanyIdConfig.find({})
            .select('companyCode companyId')
            .sort({ updatedAt: -1 })
            .limit(1000)
            .lean();
          const matchedCode = codeRows.find((row) => {
            return normalizePublicIdentifier(row?.companyCode) === target;
          });
          if (matchedCode?.companyId) {
            const finder = Tenant.findById(String(matchedCode.companyId));
            tenant = select ? await finder.select(select) : await finder;
          }
        } catch (_e) {
          /* ignore */
        }
      }

      if (tenant) return tenant;

      const candidates = await Tenant.find({})
        .select('_id code companyCode tenantId name companyName meta')
        .sort({ updatedAt: -1 })
        .limit(1000)
        .lean();

      const matched = candidates.find((row) => {
        const tokens = [
          row?.code,
          row?.companyCode,
          row?.tenantId,
          row?.name,
          row?.companyName,
          row?.meta?.code,
          row?.meta?.companyCode,
          row?.meta?.tenantId,
          row?.meta?.careerPortalCode,
          row?.meta?.careerSlug,
          row?.meta?.portalSlug,
          row?.meta?.publicCompanyCode,
        ]
          .map((value) => normalizePublicIdentifier(value))
          .filter(Boolean);

        return tokens.includes(target);
      });

      if (matched?._id) {
        const finder = Tenant.findById(String(matched._id));
        tenant = select ? await finder.select(select) : await finder;
      }
    }
  }

  // Local/dev fallback: if identifier cannot be resolved, use latest active tenant.
  // This keeps public portal usable in local setups with stale hardcoded links.
  if (!tenant) {
    const allowFallback = String(process.env.ALLOW_PUBLIC_CODE_FALLBACK || 'true').toLowerCase() !== 'false';
    if (allowFallback) {
      try {
        const activeFinder = Tenant.findOne({ status: 'active' }).sort({ updatedAt: -1 });
        tenant = select ? await activeFinder.select(select) : await activeFinder;
      } catch (_e) {
        /* ignore */
      }

      if (!tenant) {
        try {
          const anyFinder = Tenant.findOne({}).sort({ updatedAt: -1 });
          tenant = select ? await anyFinder.select(select) : await anyFinder;
        } catch (_e) {
          /* ignore */
        }
      }
    }
  }

  return tenant;
}

function getTenantDisplayName(tenant) {
  if (!tenant) return '';
  return tenant.companyName || tenant.name || tenant.code || 'Careers';
}

async function fetchPublicJobsForTenantIdentifier(identifier) {
  const tenantDB = await getTenantDB(identifier);
  if (!tenantDB) return [];

  const RequirementSchema = require('../models/Requirement');
  if (!tenantDB.models.Requirement) {
    tenantDB.model('Requirement', RequirementSchema);
  }
  const Requirement = tenantDB.model('Requirement');

  const jobs = await Requirement.find({
    status: { $regex: /^open$/i },
    $or: [
      { visibility: { $in: ['External', 'Both'] } },
      { visibility: { $exists: false } },
      { visibility: null }
    ]
  })
    .select('jobTitle department vacancy createdAt publishedAt tenant visibility employmentType location minExperienceMonths maxExperienceMonths description')
    .sort({ publishedAt: -1, createdAt: -1 })
    .lean();

  return jobs.map(serializeRequirement);
}

function serializeRequirement(requirement) {
  if (!requirement) return requirement;

  return {
    ...requirement,
    _id: stringifyId(requirement._id),
    id: stringifyId(requirement._id),
    tenant: stringifyId(requirement.tenant),
  };
}

function buildPublicJobsFilter() {
  // Be tolerant to legacy/manual inserts where casing differs or status is stored in `hiringStatus`.
  const openRx = /^open$/i;
  const visibilityRx = /^(external|both)$/i;

  const visibilityOk = {
    $or: [
      { visibility: { $regex: visibilityRx } },
      { 'jobDetails.visibility': { $regex: visibilityRx } },
      { visibility: { $exists: false } },
      { 'jobDetails.visibility': { $exists: false } },
      { visibility: null },
      { 'jobDetails.visibility': null },
    ],
  };

  const statusOk = {
    $or: [
      { status: { $regex: openRx } },
      { hiringStatus: { $regex: openRx } },
      // Some older shapes may keep status inside jobDetails
      { 'jobDetails.status': { $regex: openRx } },
    ],
  };

  return { $and: [statusOk, visibilityOk] };
}

/* ----------------------------------------------------
   GET PUBLIC JOBS (BY TENANT ID)
---------------------------------------------------- */
exports.getPublicJobs = async (req, res) => {
  try {
    const { tenantId: identifier } = req.query;
    // console.log(`🔍 [GET_PUBLIC_JOBS] Received request for identifier: ${identifier}`);

    if (!identifier) {
      console.warn('⚠️ [GET_PUBLIC_JOBS] No identifier provided');
      return res.status(400).json({ error: "Tenant ID required" });
    }

    // 1. Resolve via master tenant registry (preferred)
    const tenant = await findTenantByIdentifier(identifier);

    // 2. Fallback path: when master Tenant docs are missing locally, treat identifier as tenant DB id/code.
    const lookupIdentifier = tenant?._id || identifier;
    const jobs = await fetchPublicJobsForTenantIdentifier(lookupIdentifier);

    if (!tenant && jobs.length === 0) {
      console.warn(`❌ [GET_PUBLIC_JOBS] Company not found for identifier: ${identifier}`);
      return res.status(404).json({ error: "Company not found" });
    }

    // console.log(`✅ [GET_PUBLIC_JOBS] Found ${jobs.length} jobs for ${tenant ? getTenantDisplayName(tenant) : String(identifier)}.`);
    res.json(jobs);
  } catch (err) {
    console.error("❌ [GET_PUBLIC_JOBS] Error:", err.message);
    res.status(500).json({ error: "Failed to fetch jobs: " + err.message });
  }
};

/* ----------------------------------------------------
   GET PUBLIC JOBS (BY COMPANY CODE)
---------------------------------------------------- */
exports.getPublicJobsByCompanyCode = async (req, res) => {
  try {
    const { companyCode } = req.params;
    // console.log(`🔍 [GET_JOBS_BY_CODE] Code: ${companyCode}`);

    if (!companyCode)
      return res.status(400).json({ error: "Company code required" });

    const tenant = await findTenantByIdentifier(companyCode);

    if (!tenant) {
      console.warn(`❌ [GET_JOBS_BY_CODE] Tenant not found for identifier: ${companyCode}`);
      return res.status(404).json({ error: "Company not found" });
    }

    const tenantDB = await getTenantDB(tenant._id);
    const Requirement = tenantDB.model("Requirement");

    let jobs = await Requirement.find(buildPublicJobsFilter())
      .select('jobTitle department vacancy createdAt publishedAt tenant visibility employmentType location minExperienceMonths maxExperienceMonths description')
      .sort({ createdAt: -1 })
      .lean();

    if (!jobs?.length) {
      try {
        const PositionSchema = require('../models/Position');
        let Position;
        try {
          Position = tenantDB.model('Position');
        } catch {
          Position = tenantDB.model('Position', PositionSchema);
        }
        const openRx = /^open$/i;
        const pos = await Position.find({
          hiringStatus: { $regex: openRx },
          status: { $ne: 'Cancelled' },
        })
          .select('jobTitle department budgetedCount currentCount createdAt tenant hiringStatus')
          .sort({ createdAt: -1 })
          .lean();

        jobs = (pos || []).map((p) => ({
          ...p,
          vacancy: Math.max(0, Number(p?.budgetedCount || 0) - Number(p?.currentCount || 0)) || 1,
          status: 'Open',
          visibility: 'External',
        }));
      } catch (_e) {
        // ignore
      }
    }

    // console.log(`✅ [GET_JOBS_BY_CODE] Found ${jobs.length} jobs for ${getTenantDisplayName(tenant)}. IDs: ${jobs.map(j => j._id).join(', ')}`);
    res.json(jobs.map(serializeRequirement));
  } catch (err) {
    console.error("❌ [GET_JOBS_BY_CODE] Error:", err.message);
    res.status(500).json({ error: "Failed to fetch jobs: " + err.message });
  }
};

/* ----------------------------------------------------
   RESOLVE COMPANY CODE TO TENANT ID
---------------------------------------------------- */
exports.resolveCompanyCode = async (req, res) => {
  try {
    const { code } = req.params;
    // console.log(`🔍 [RESOLVE_CODE] Code: ${code}`);

    if (!code) return res.status(400).json({ error: "Code required" });

    let tenant = await findTenantByIdentifier(code);

    if (!tenant) {
      // Dev convenience: if only one tenant exists, treat it as the default portal.
      // This prevents job portal from hard-failing in local environments where the URL code
      // doesn't match seeded tenant codes.
      const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
      if (!isProd) {
        try {
          const count = await Tenant.countDocuments();
          if (count === 1) {
            tenant = await Tenant.findOne({});
            console.warn(`⚠️ [RESOLVE_CODE] Tenant not found for ${code}. Falling back to the only tenant in DB for local dev: ${getTenantDisplayName(tenant)}`);
          }
        } catch (_e) {
          // ignore fallback errors
        }
      }
    }

    if (!tenant) {
      console.warn(`❌ [RESOLVE_CODE] Tenant not found for ${code}`);
      return res.status(404).json({ error: "Company not found" });
    }

    const resolvedTenantId = stringifyId(tenant._id);
    const companyName = getTenantDisplayName(tenant);

    // console.log(`✅ [RESOLVE_CODE] Found: ${companyName} -> ${resolvedTenantId}`);
    res.json({ tenantId: resolvedTenantId, companyName });
  } catch (err) {
    console.error("❌ [RESOLVE_CODE] Error:", err.message);
    res.status(500).json({ error: "Failed to resolve company" });
  }
};

/* ----------------------------------------------------
   GET TENANT BASIC DETAILS (BY ID)
---------------------------------------------------- */
exports.getTenantBasicDetails = async (req, res) => {
  try {
    const { tenantId: identifier } = req.params;
    if (!identifier) return res.status(400).json({ error: "Tenant ID required" });

    const tenant = await findTenantByIdentifier(identifier, 'name code logo companyName companyCode');

    if (!tenant) {
      // Local/dev compatibility: master tenant row may be missing, but tenant DB can still exist.
      return res.json({
        _id: String(identifier),
        tenantId: String(identifier),
        name: 'Careers',
        companyName: 'Careers',
        code: null,
        logo: null
      });
    }

    res.json({
      _id: stringifyId(tenant._id),
      tenantId: stringifyId(tenant._id),
      name: getTenantDisplayName(tenant),
      companyName: getTenantDisplayName(tenant),
      code: tenant.code || tenant.companyCode || null,
      logo: tenant.logo
    });
  } catch (err) {
    console.error("Get tenant details error:", err);
    res.status(500).json({ error: "Failed to fetch company details" });
  }
};

/* ----------------------------------------------------
   GET SINGLE PUBLIC JOB (BY ID)
---------------------------------------------------- */
exports.getPublicJobById = async (req, res) => {
  try {
    const { id } = req.params;
    const { tenantId: tenantIdentifier } = req.query;

    if (!id || id === 'undefined' || !tenantIdentifier || tenantIdentifier === 'null' || tenantIdentifier === 'undefined') {
      return res.status(400).json({ error: "Valid Job ID and Tenant ID are required" });
    }

    const tenant = await findTenantByIdentifier(tenantIdentifier);
    if (!tenant) {
      return res.status(404).json({ error: "Company not found" });
    }

    const getTenantDB = require('../utils/tenantDB');
    const tenantDB = await getTenantDB(tenant._id);
    const RequirementSchema = require('../models/Requirement');
    let Requirement;
    try {
      Requirement = tenantDB.model("Requirement");
    } catch {
      Requirement = tenantDB.model("Requirement", RequirementSchema);
    }

    // 1) Primary: Requirement by id
    let job = await Requirement.findOne({ _id: id })
      .select('jobTitle department vacancy status description jobVisibility minExperienceMonths maxExperienceMonths salaryMin salaryMax jobType workMode publicFields customFields createdAt publishedAt tenant location priority noticePeriod probationPeriod experienceMin experienceMax responsibilities requiredSkills optionalSkills keywords education pipelineStages visibility hiringStatus jobDetails jobDescription')
      .lean();

    // 2) Secondary: Requirement by positionId (when portal uses Position._id)
    let resolvedRequirementId = null;
    if (!job && mongoose.Types.ObjectId.isValid(String(id))) {
      job = await Requirement.findOne({ positionId: id })
        .select('jobTitle department vacancy status description jobVisibility minExperienceMonths maxExperienceMonths salaryMin salaryMax jobType workMode publicFields customFields createdAt publishedAt tenant positionId location priority noticePeriod probationPeriod experienceMin experienceMax responsibilities requiredSkills optionalSkills keywords education pipelineStages visibility hiringStatus jobDetails jobDescription')
        .lean();
      if (job?._id) {
        resolvedRequirementId = stringifyId(job._id);
      }
    }

    // 3) Fallback: Position by id -> create a lightweight Requirement so apply flow works
    if (!job && mongoose.Types.ObjectId.isValid(String(id))) {
      try {
        const PositionSchema = require('../models/Position');
        let Position;
        try {
          Position = tenantDB.model('Position');
        } catch {
          Position = tenantDB.model('Position', PositionSchema);
        }

        const pos = await Position.findById(id).lean();
        if (pos) {
          const vacancy = Math.max(1, Number(pos?.budgetedCount || 1) - Number(pos?.currentCount || 0));
          const created = await Requirement.create({
            tenant: tenant._id,
            positionId: pos._id,
            department: pos.department || 'General',
            jobTitle: pos.jobTitle || 'Open Position',
            vacancy,
            status: 'Open',
            visibility: 'External',
            jobDescription: { roleOverview: pos.jobTitle || 'Open Position' },
            hiringStatus: 'Open',
          });

          const createdLean = created.toObject ? created.toObject() : created;
          const payload = serializeRequirement(createdLean);
          payload.resolvedRequirementId = stringifyId(created._id);
          payload.resolvedFromPositionId = stringifyId(pos._id);
          return res.json(payload);
        }
      } catch (_e) {
        // ignore; handled below
      }
    }

    if (!job) return res.status(404).json({ error: "Job not found" });
    const payload = serializeRequirement(job);
    // If the caller used a Position id, tell the frontend the real Requirement id to submit with.
    if (resolvedRequirementId && String(resolvedRequirementId) !== String(id)) {
      payload.resolvedRequirementId = resolvedRequirementId;
      payload.resolvedFromPositionId = String(id);
    }
    return res.json(payload);
  } catch (err) {
    console.error("Get single job error:", err);
    res.status(500).json({ error: "Failed to fetch job details" });
  }
};
/* ----------------------------------------------------
   APPLY FOR JOB (PUBLIC)
---------------------------------------------------- */
exports.applyJob = [
  upload.any(),
  async (req, res) => {
    try {
      const uploadedFiles = Array.isArray(req.files) ? req.files : [];
      const resumeFile = uploadedFiles.find(file => file.fieldname === 'resume') || null;
      const customImageFiles = uploadedFiles.filter(file => file.fieldname !== 'resume');
      req.file = resumeFile;

      // console.log(`📝 [APPLY_JOB] Request body:`, req.body);
      // console.log(`📝 [APPLY_JOB] Headers:`, req.headers);
      // console.log(`📝 [APPLY_JOB] File:`, req.file);

      // 1. Resolve Parameters
      let {
        tenantId, requirementId, name, fatherName, email, mobile, experience,
        address, location, currentCompany, currentDesignation, expectedCTC, linkedin, dob,
        references, isFresher, noReferenceReason, customData,
        candidateId, referral
      } = req.body;

      // Automatically collect custom/dynamic fields not defined in standard schema parameters
      const standardKeys = [
        'tenantId', 'requirementId', 'name', 'fatherName', 'email', 'mobile', 'experience',
        'address', 'location', 'currentCompany', 'currentDesignation', 'expectedCTC', 'linkedin', 'dob',
        'references', 'isFresher', 'noReferenceReason', 'candidateId', 'referral', 'resume', 'customData'
      ];
      const customFields = {};
      if (req.body) {
        Object.keys(req.body).forEach(key => {
          if (!standardKeys.includes(key)) {
            customFields[key] = req.body[key];
          }
        });
      }
      
      // Parse customData if passed as JSON string, and merge with collected custom fields
      let mergedCustomData = {};
      try {
        if (customData) {
          mergedCustomData = typeof customData === 'string' ? JSON.parse(customData) : customData;
        }
      } catch (e) {
        console.warn("⚠️ Failed to parse customData string:", e.message);
      }
      mergedCustomData = { ...customFields, ...mergedCustomData };
      customImageFiles.forEach(file => {
        mergedCustomData[file.fieldname] = {
          fileName: file.filename,
          originalName: file.originalname,
          filePath: `/uploads/application-images/${file.filename}`,
          fileSize: file.size,
          fileType: file.mimetype
        };
      });
      customData = mergedCustomData;

      const parsedDob = dob ? new Date(dob) : null;
      const isFresherBool = isFresher === true || isFresher === 'true';

      if (!candidateId || candidateId === 'null' || candidateId === 'undefined' || candidateId.trim() === '') {
        candidateId = undefined;
      } else if (!mongoose.Types.ObjectId.isValid(candidateId)) {
        candidateId = undefined;
      }

      let validatedReferences = [];
      if (references) {
        try {
          const parsedRefs = typeof references === 'string' ? JSON.parse(references) : references;
          validatedReferences = Array.isArray(parsedRefs) ? parsedRefs : [];
        } catch (e) { validatedReferences = []; }
      }

      const resumeFilename = req.file?.filename || null;

      if (!tenantId || tenantId === 'null' || tenantId === 'undefined') {
        tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
      }

      if (!tenantId || !requirementId) {
        return res.status(400).json({ error: "Missing Tenant ID or Requirement ID" });
      }

      // 1.5 Auto-resolve candidateId if missing (Link by email)
      if (!candidateId && email) {
        try {
          const tenantDB = await getTenantDB(tenantId);
          const Candidate = tenantDB.model("Candidate");
          const existingCandidate = await Candidate.findOne({ email: email.toLowerCase().trim() });
          if (existingCandidate) {
            candidateId = existingCandidate._id;
            // console.log(`🔗 [APPLY_JOB] Auto-linked application to candidate: ${candidateId} (${email})`);
          }
        } catch (e) {
          console.warn(`⚠️ [APPLY_JOB] Auto-link failed:`, e.message);
        }
      }

      // 2. Fetch Job Context (Tenant DB)
      const tenantDB = await getTenantDB(tenantId);
      const RequirementSchema = require('../models/Requirement');
      let Requirement;
      try {
        Requirement = tenantDB.model("Requirement");
      } catch {
        Requirement = tenantDB.model("Requirement", RequirementSchema);
      }

      let requirement = null;
      if (mongoose.Types.ObjectId.isValid(String(requirementId))) {
        requirement = await Requirement.findById(requirementId);
      }

      // If frontend accidentally sent Position._id, resolve via positionId or auto-create.
      if (!requirement && mongoose.Types.ObjectId.isValid(String(requirementId))) {
        requirement = await Requirement.findOne({ positionId: requirementId });
        if (!requirement) {
          try {
            const PositionSchema = require('../models/Position');
            let Position;
            try {
              Position = tenantDB.model('Position');
            } catch {
              Position = tenantDB.model('Position', PositionSchema);
            }
            const pos = await Position.findById(requirementId);
            if (pos) {
              const vacancy = Math.max(1, Number(pos?.budgetedCount || 1) - Number(pos?.currentCount || 0));
              requirement = await Requirement.create({
                tenant: mongoose.Types.ObjectId.isValid(String(tenantId)) ? tenantId : undefined,
                positionId: pos._id,
                department: pos.department || 'General',
                jobTitle: pos.jobTitle || 'Open Position',
                vacancy,
                status: 'Open',
                visibility: 'External',
                jobDescription: { roleOverview: pos.jobTitle || 'Open Position' },
                hiringStatus: 'Open',
              });
            }
          } catch (_e) {
            // ignore
          }
        }
      }

      if (!requirement) return res.status(404).json({ error: "Job Requirement not found" });

      // 3. Parse Resume & AI Extraction
      const ResumeParserService = require('../services/ResumeParser.service');
      const AIExtractionService = require('../services/AIExtraction.service');
      const MatchingEngine = require('../services/MatchingEngine.service');

      let rawText = "";
      let structuredData = {};
      let matchResult = { totalScore: 0, breakdown: { skills: 0, experience: 0, education: 0, similarity: 0, preferred: 0 }, matchedSkills: [], missingSkills: [] };

      // Correct job description field from Requirement model
      const jobDescriptionText = requirement.jobDescription?.roleOverview
        || requirement.description
        || requirement.jobTitle
        || '';

      if (req.file) {
        try {
          // console.log(`🤖 [APPLY_JOB] Parsing Resume for Job: ${requirement.jobTitle}...`);

          // A. Text Extraction
          rawText = await ResumeParserService.parseResume(req.file.path, req.file.mimetype);
          // console.log(`✅ [APPLY_JOB] Resume Text Extracted (${rawText.length} chars)`);

          // B. AI Extraction — pass correct job description
          structuredData = await AIExtractionService.extractData(rawText, requirement.jobTitle, jobDescriptionText);
          // console.log(`✅ [APPLY_JOB] AI Extraction Complete:`, structuredData ? "Success" : "Failed");

          // C. Matching
          try {
            matchResult = await MatchingEngine.calculateMatchScore(requirement, structuredData);
            // console.log(`✅ [APPLY_JOB] Match Score (with resume): ${matchResult.totalScore}%`);
          } catch (matchErr) {
            console.error("⚠️ [APPLY_JOB] Matching Engine Error:", matchErr);
            matchResult = { totalScore: 0, breakdown: { skills: 0, experience: 0, education: 0, similarity: 0, preferred: 0 }, matchedSkills: [], missingSkills: [] };
          }

        } catch (parseErr) {
          console.error("⚠️ [APPLY_JOB] Parsing/AI Error (non-blocking):", parseErr.message);
          // Even if resume parse fails, try matching with form data below
        }
      }

      // If no resume OR AI extraction returned empty skills, try matching with form-entered data
      if (!structuredData?.skills?.length && (experience || name)) {
        try {
          // Build candidate data from manually entered form fields
          const formCandidateData = {
            fullName: name,
            skills: [], // No skills from form — honest
            totalExperience: experience || "0",
            education: [],
            summary: `Candidate applied manually. Experience: ${experience || 'Not specified'}.`
          };

          // Only run matching if we have some data to work with
          if (Object.keys(formCandidateData).length > 0) {
            const formMatchResult = await MatchingEngine.calculateMatchScore(requirement, formCandidateData);
            // console.log(`✅ [APPLY_JOB] Match Score (form data): ${formMatchResult.totalScore}%`);

            // Use form match only if better than current (or current is 0)
            if (formMatchResult.totalScore > matchResult.totalScore) {
              matchResult = formMatchResult;
              if (!structuredData || Object.keys(structuredData).length === 0) {
                structuredData = formCandidateData;
              }
            }
          }
        } catch (formMatchErr) {
          console.warn("⚠️ [APPLY_JOB] Form-based matching failed:", formMatchErr.message);
        }
      }


      // 3.5 Check for duplicate application
      const Applicant = tenantDB.models.Applicant || tenantDB.model("Applicant", ApplicantSchema);

      if (email) {
        const exists = await Applicant.findOne({
          requirementId,
          email: email.toLowerCase()
        });
        if (exists) return res.status(409).json({ error: "You have already applied for this job" });
      }

      // Create new applicant
      // Default to 'Applied' if no pipeline is defined, else use first stage from requirement
      const defaultStatus = (requirement.pipelineStages && requirement.pipelineStages.length > 0)
        ? requirement.pipelineStages[0].stageName
        : 'Applied';

      const { generateApplicationId } = require('../utils/idGenerator');
      const applicationId = await generateApplicationId(tenantDB);

      const firstStageInterviewer = (requirement.pipelineStages?.[0]?.assignedInterviewers?.[0])
        || requirement.pipelineStages?.[0]?.assignedInterviewer
        || null;

      let isOverBudget = false;
      if (expectedCTC && requirement.salaryMax) {
        try {
          const numExpectedCTC = parseFloat(String(expectedCTC).replace(/[^0-9.]/g, ''));
          if (!isNaN(numExpectedCTC) && numExpectedCTC > requirement.salaryMax) {
            isOverBudget = true;
          }
        } catch (e) {}
      }

      const applicant = new Applicant({
        applicationId: applicationId,
        tenant: tenantDB.tenantId,
        candidateId: candidateId,
        requirementId,
        gradeId: requirement.gradeId || null,
        gradeSnapshot: requirement.gradeId ? {
          id: requirement.gradeId,
          name: requirement.grade || '',
          code: '',
          level: null
        } : undefined,
        source: 'External',
        name: name?.trim() || structuredData.fullName || "Unknown",
        fatherName: fatherName?.trim(),
        email: email?.toLowerCase().trim() || structuredData.email || "unknown@email.com",
        mobile: mobile?.trim() || structuredData.phone || "N/A",
        experience: experience?.trim() || structuredData.totalExperience || "",
        address: address?.trim(),
        location: location?.trim(),
        currentCompany: currentCompany?.trim(),
        currentDesignation: currentDesignation?.trim(),
        expectedCTC: expectedCTC?.trim(),
        isOverBudget: isOverBudget,
        linkedin: linkedin?.trim(),
        dob: parsedDob || null,
        resume: req.file?.filename,
        customData: customData,
        status: defaultStatus,
        timeline: [{
          status: defaultStatus,
          message: `Application received for "${requirement.jobTitle}". Initial stage: ${defaultStatus}`,
          updatedBy: 'Candidate (Portal)',
          timestamp: new Date()
        }],

        // PIPELINE STAGE INITIALIZATION
        currentStage: (requirement.pipelineStages && requirement.pipelineStages.length > 0) ? {
          stageId: '0',
          stageName: requirement.pipelineStages[0].stageName,
          stageType: requirement.pipelineStages[0].stageType,
          enteredAt: new Date(),
          assignedInterviewer: firstStageInterviewer
        } : {
          stageId: '0',
          stageName: 'Applied',
          stageType: 'Screening',
          enteredAt: new Date()
        },

        pipelineProgress: (requirement.pipelineStages && requirement.pipelineStages.length > 0)
          ? requirement.pipelineStages.map((stage, index) => ({
            stageId: String(index),
            stageName: stage.stageName,
            stageType: stage.stageType,
            status: index === 0 ? 'In Progress' : 'Pending',
            assignedInterviewer: (stage.assignedInterviewers?.[0]) || stage.assignedInterviewer || null,
            enteredAt: index === 0 ? new Date() : null
          }))
          : [{
            stageId: '0',
            stageName: 'Applied',
            stageType: 'Screening',
            status: 'In Progress',
            enteredAt: new Date()
          }],

        // AI & MATCHING FIELDS
        rawOCRText: rawText,
        aiParsedData: structuredData ? {
          ...structuredData,
          summary: structuredData.summary || structuredData.experienceSummary || null
        } : null,
        parsedSkills: Array.isArray(structuredData?.skills) ? structuredData.skills : [],
        matchScore: matchResult.totalScore,
        matchBreakdown: matchResult.breakdown,
        matchedSkills: matchResult.matchedSkills,
        missingSkills: matchResult.missingSkills,
        parsingStatus: rawText ? 'Completed' : 'Pending',

        references: validatedReferences,
        isFresher: isFresherBool,
        noReferenceReason: noReferenceReason || (isFresherBool ? 'Fresher - No Work Experience' : null),
        referral: (function () {
          if (!referral) return null;
          try {
            const parsed = typeof referral === 'string' ? JSON.parse(referral) : referral;
            return {
              usedCode: parsed.usedCode ? String(parsed.usedCode).trim() : null,
              source: parsed.source || 'referral_link',
              capturedAt: parsed.capturedAt || new Date()
            };
          } catch (e) { return null; }
        })()
      });

      // 4. Resolve referral code -> referrer info before saving
      if (applicant.referral?.usedCode) {
        try {
          const used = String(applicant.referral.usedCode).trim().toUpperCase();
          if (!tenantDB.models.ReferralCode) {
            tenantDB.model('ReferralCode', require('../models/ReferralCode'));
          }
          const ReferralCode = tenantDB.model('ReferralCode');
          const refDoc = await ReferralCode.findOne({ code: used }).lean();
          if (refDoc?.referrerEmployeeId) {
            applicant.referral.referrerEmployeeId = refDoc.referrerEmployeeId;
            applicant.referral.referrerName = refDoc.referrerName || '';
            console.log(`✅ [APPLY_JOB] Resolved referral: ${refDoc.referrerName} (${used})`);
          }
        } catch (e) {
          console.warn('⚠️ [APPLY_JOB] Referral resolution failed:', e.message);
        }
      }

      await applicant.save();

      // --- SYNC TO CANDIDATE PROFILE ---
      if (candidateId) {
        try {
          const Candidate = tenantDB.model("Candidate");
          await Candidate.findByIdAndUpdate(candidateId, {
            mobile: mobile?.trim(),
            fatherName: fatherName?.trim(),
            address: address?.trim(),
            dob: dob || null,
            resume: resumeFilename || undefined, // Only update if new file uploaded
            updatedAt: new Date()
          });
          // console.log(`✅ [APPLY_JOB] Candidate profile synced for ${candidateId}`);
        } catch (syncErr) {
          console.error("⚠️ [APPLY_JOB] Failed to sync profile:", syncErr.message);
        }
      }

      // --- SEND EMAIL NOTIFICATION (DYNAMIC) ---
      // --- SEND EMAIL NOTIFICATIONS ---
      try {
        // console.log(`📧 [APPLY_JOB] Initiating emails...`);

        // 1. Fetch Company Profile for Name & Email
        try {
          const CompanyProfileSchema = require('../models/CompanyProfile');
          const CompanyProfile = tenantDB.models.CompanyProfile || tenantDB.model("CompanyProfile", CompanyProfileSchema);
          const companyProfile = await CompanyProfile.findOne({ tenantId });

          const companyName = companyProfile?.companyName || "Our Company";
          const companyEmail = companyProfile?.contactEmail; // If null, we might skip company email or use a fallback

          // 2. Email to Candidate
          if (EmailService && EmailService.sendCandidateAppliedEmail) {
            try {
              await EmailService.sendCandidateAppliedEmail(
                applicant.email,
                applicant.name,
                requirement.jobTitle,
                companyName,
                tenantId
              );
              // console.log(`✅ [APPLY_JOB] Notification sent to candidate: ${applicant.email}`);
            } catch (candidateEmailErr) {
              console.warn(`⚠️ [APPLY_JOB] Failed to send candidate email:`, candidateEmailErr.message);
            }
          }

          // 3. Email to Company (if email exists)
          if (companyEmail && EmailService && EmailService.sendCompanyNewApplicationEmail) {
            try {
              await EmailService.sendCompanyNewApplicationEmail(
                companyEmail,
                applicant.name,
                requirement.jobTitle,
                applicant._id,
                tenantId
              );
              // console.log(`✅ [APPLY_JOB] Notification sent to company: ${companyEmail}`);
            } catch (companyEmailErr) {
              console.warn(`⚠️ [APPLY_JOB] Failed to send company email:`, companyEmailErr.message);
            }
          } else {
            console.warn(`⚠️ [APPLY_JOB] No company contact email found for tenant ${tenantId}. Skipping company notification.`);
          }
        } catch (companyProfileErr) {
          console.warn(`⚠️ [APPLY_JOB] Failed to get company profile:`, companyProfileErr.message);
        }
      } catch (emailError) {
        console.error("⚠️ [APPLY_JOB] Email service error:", emailError.message);
      }

      res.status(201).json({
        message: "Application submitted successfully",
        applicantId: applicant._id
      });
    } catch (err) {
      console.error("❌ [APPLY_JOB] Apply job error:", err);
      console.error("Stack trace:", err.stack);
      res.status(500).json({ error: "Failed to submit application", details: err.message });
    }
  }
];

exports.getCareerCustomization = async (req, res) => {
  try {
    const { tenantId: identifier } = req.params;
    if (!identifier) return res.status(400).json({ error: "Tenant ID required" });

    // Prevent Caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    let tenant;
    if (mongoose.Types.ObjectId.isValid(identifier)) {
      tenant = await Tenant.findById(identifier);
    } else {
      tenant = await Tenant.findOne({ code: identifier });
    }

    if (!tenant) return res.status(404).json({ error: "Company not found" });

    // 1. Attempt Check Optimized Published Page (New System - Central DB)
    const PublishedCareerPage = require('../models/PublishedCareerPage');
    const publishedPage = await PublishedCareerPage.findOne({ tenantId: tenant._id.toString() }).sort({ publishedAt: -1 }).lean();

    // 2. Look into Tenant DB for legacy customization (Apply Page Builder data)
    const tenantDB = await getTenantDB(tenant._id);
    const CompanyProfileSchema = require('../models/CompanyProfile');
    const CompanyProfile = tenantDB.models.CompanyProfile || tenantDB.model("CompanyProfile", CompanyProfileSchema);
    const profile = await CompanyProfile.findOne({}).lean();

    const legacyCustomization = profile?.meta?.careerCustomization || tenant.meta?.careerCustomization || null;

    // Merge Logic: Prioritize the latest 'applyPage' and 'theme' from Published Page
    let finalCustomization = { ...legacyCustomization };

    if (publishedPage) {
      // 1. Theme Sync
      if (publishedPage.theme) {
        finalCustomization.theme = publishedPage.theme;
      }
      // 2. Apply Page Sync (The crucial part!)
      if (publishedPage.applyPage && Object.keys(publishedPage.applyPage).length > 0) {
        finalCustomization.applyPage = publishedPage.applyPage;
      }
      // 3. SEO Settings Sync
      if (publishedPage.seo) {
        finalCustomization.seoSettings = {
          seo_title: publishedPage.seo.title,
          seo_description: publishedPage.seo.description,
          seo_keywords: publishedPage.seo.keywords,
          seoSlug: publishedPage.seo.slug
        };
      }
    }

    // Return null ONLY if both sources are completely empty
    if (!legacyCustomization && (!publishedPage || !publishedPage.applyPage)) {
      // Check if we still have at least a theme to return
      if (finalCustomization.theme) return res.json(finalCustomization);
      return res.json(null);
    }

    res.json(finalCustomization);
  } catch (err) {
    console.error("Get career customization error:", err);
    res.status(500).json({ error: "Failed to fetch career customization" });
  }
};

function compactText(value = '') {
  return String(value || '').replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function normalizeOcrDocumentType(type = '', label = '', text = '') {
  const haystack = `${type} ${label} ${text.slice(0, 2000)}`.toLowerCase();
  if (/(aadhaar|aadhar|uidai|unique identification|vid\s*:)/i.test(haystack)) return 'aadhaar';
  if (/(pan|income tax|permanent account number)/i.test(haystack)) return 'pan';
  if (/(passbook|bank|ifsc|account\s*(number|no|holder)|branch)/i.test(haystack)) return 'passbook';
  if (/(resume|curriculum vitae|work experience|professional summary|skills|linkedin)/i.test(haystack)) return 'resume';
  return 'id_proof';
}

function normalizeDateString(value = '') {
  const match = String(value || '').match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!match) return '';
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  const year = match[3].length === 2 ? `19${match[3]}` : match[3];
  return `${day}/${month}/${year}`;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return String(match[1] || match[0] || '').trim();
  }
  return '';
}

function cleanPersonName(value = '') {
  return String(value || '')
    .replace(/^(name|full name|applicant name|candidate name|father'?s name|s\/o|d\/o|w\/o)\s*[:\-]*/i, '')
    .replace(/[^a-zA-Z .'-]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function cleanLineValue(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[|•]+/g, ' ')
    .trim()
    .slice(0, 140);
}

function cleanAddressValue(value = '') {
  const noise = /(unique identification|government of india|uidai|aadhaar|aadhar|vid\s*:|help@uidai|www\.uidai|date of birth|dob|male|female|year of birth|enrolment|download date|issue date)/i;
  return String(value || '')
    .split(/\n|,/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(line => line && !noise.test(line))
    .join(', ')
    .replace(/\b(\d{6})(?:\D.*)?$/g, '$1')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,{2,}/g, ',')
    .trim()
    .slice(0, 280);
}

function normalizeOcrText(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function guessNameFromLines(text = '') {
  const ignored = /(government|india|uidai|aadhaar|aadhar|male|female|dob|birth|address|income tax|department|permanent account|bank|branch|ifsc|account|resume|curriculum|vitae)/i;
  return compactText(text)
    .split('\n')
    .map(line => cleanPersonName(line))
    .find(line => line.length >= 4 && line.length <= 70 && /^[a-zA-Z .'-]+$/.test(line) && !ignored.test(line)) || '';
}

function extractAddressFromText(text = '') {
  const normalized = compactText(text);
  const inline = normalizeOcrText(text);
  const inlineAddress = firstMatch(inline, [
    /((?:S\/O|D\/O|W\/O|C\/O)\s*:\s*[A-Za-z .'-]{3,90},\s*(?:main\s+bajar|main\s+bazaar|bajar|bazaar)[\s\S]{8,180}?\b\d{6})\b/i,
    /([A-Za-z .'-]{3,90},\s*(?:main\s+bajar|main\s+bazaar|bajar|bazaar)[\s\S]{8,180}?\b\d{6})\b/i,
    /Address\s*:\s*([\s\S]{12,260}?\b\d{6})\b/i,
    /(?:S\/O|D\/O|W\/O|C\/O)\s*:\s*([\s\S]{12,240}?\b\d{6})\b/i
  ]);
  if (inlineAddress) return cleanAddressValue(inlineAddress);

  const labelledAddress = firstMatch(normalized, [
    /(?:address|addr)\s*[:\-]?\s*([\s\S]{12,320}?)(?=\n\s*(?:\d{4}\s?\d{4}\s?\d{4}|vid\s*:|dob|date of birth|male|female|to\s*$|$))/i,
    /(?:c\/o|s\/o|d\/o|w\/o)\s*[:\-]?\s*([\s\S]{12,320}?)(?=\n\s*(?:\d{4}\s?\d{4}\s?\d{4}|vid\s*:|dob|date of birth|male|female|$))/i
  ]);
  if (labelledAddress) return cleanAddressValue(labelledAddress);

  const lines = normalized
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const pinIndex = lines.findIndex(line => /\b\d{6}\b/.test(line));
  if (pinIndex >= 0) {
    const start = Math.max(0, pinIndex - 4);
    const windowLines = lines.slice(start, pinIndex + 1);
    const addressLines = windowLines.filter(line => {
      if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(line)) return false;
      if (/(uidai|aadhaar|aadhar|government|dob|birth|male|female|vid|www\.uidai|help@uidai)/i.test(line)) return false;
      return /[a-zA-Z]/.test(line) || /\b\d{6}\b/.test(line);
    });
    const candidate = cleanAddressValue(addressLines.join(', '));
    if (candidate && /\b\d{6}\b/.test(candidate)) return candidate;
  }

  return '';
}

function extractAadhaarName(text = '') {
  const inline = normalizeOcrText(text);
  const beforeDobText = inline.split(/\b(?:DOB|Date of Birth|Birth)\b/i)[0] || '';
  const nameCandidates = beforeDobText.match(/\b[A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,4}\b/g) || [];
  const filtered = nameCandidates
    .map(candidate => cleanPersonName(candidate))
    .filter(candidate => candidate.length >= 4 && !/(government|india|uidai|aadhaar|aadhar|issue date)$/i.test(candidate));
  if (filtered.length) return filtered[filtered.length - 1];

  const lines = compactText(text).split('\n').map(line => cleanPersonName(line)).filter(Boolean);
  const dobLineIndex = lines.findIndex(line => /dob|date of birth|birth/i.test(line));
  for (let i = Math.max(0, dobLineIndex - 3); dobLineIndex >= 0 && i < dobLineIndex; i += 1) {
    const candidate = lines[i];
    if (/^[a-zA-Z .'-]{4,80}$/.test(candidate) && !/(government|india|uidai|aadhaar|aadhar)/i.test(candidate)) return candidate;
  }
  return guessNameFromLines(text);
}

function extractCommonContact(text = '') {
  const email = firstMatch(text, [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i]);
  const mobile = firstMatch(text, [
    /(?:mobile|phone|contact|tel)\s*[:\-]?\s*(\+?\d[\d\s-]{8,16}\d)/i,
    /(\+?91[\s-]?[6-9]\d{9}|[6-9]\d{9})/
  ]).replace(/[^\d+]/g, '');
  return { email, mobile, phone: mobile };
}

function extractAadhaarData(text = '') {
  const aadhaarNumber = firstMatch(text, [/\b(\d{4}\s?\d{4}\s?\d{4})\b/]).replace(/\s/g, '');
  const dob = normalizeDateString(firstMatch(text, [
    /(?:dob|date of birth|birth)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})\b/
  ]));
  const fatherName = cleanPersonName(firstMatch(text, [
    /(?:s\/o|d\/o|w\/o|c\/o|father'?s name|husband'?s name|father|husband)\s*[:\-]?\s*([a-zA-Z .'-]{3,80}?)(?:,|\bmain\b|\bbajar\b|\bbazaar\b|\bGoradka\b|\bAmreli\b|\bGujarat\b|\b\d{6}\b|$)/i
  ]));
  const gender = firstMatch(text, [/\b(male|female|transgender)\b/i]);
  const pincode = firstMatch(text, [/\b(\d{6})\b/]);
  const address = extractAddressFromText(text);
  const name = extractAadhaarName(text);

  return { documentNumber: aadhaarNumber, aadhaarNumber, idNumber: aadhaarNumber, name, fullName: name, fatherName, dob, gender, address, pincode };
}

function extractPanData(text = '') {
  const panNumber = firstMatch(text, [/\b([A-Z]{5}[0-9]{4}[A-Z])\b/]);
  const dob = normalizeDateString(firstMatch(text, [
    /(?:dob|date of birth|birth)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
    /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})\b/
  ]));
  const fatherName = cleanPersonName(firstMatch(text, [
    /father'?s?\s*name\s*[:\-]?\s*([a-zA-Z .'-]{3,80})/i
  ]));
  const name = cleanPersonName(firstMatch(text, [
    /(?:name)\s*[:\-]?\s*([a-zA-Z .'-]{3,80})/i
  ])) || guessNameFromLines(text);
  return { documentNumber: panNumber, panNumber, idNumber: panNumber, name, fullName: name, fatherName, dob };
}

function extractBankData(text = '') {
  const ifsc = firstMatch(text.toUpperCase(), [/\b([A-Z]{4}0[A-Z0-9]{6})\b/]);
  const accountNumber = firstMatch(text, [
    /(?:account|a\/c|acct)\s*(?:number|no|#)?\s*[:\-]?\s*(\d{8,20})/i,
    /\b(\d{10,18})\b/
  ]);
  const bankName = firstMatch(text, [
    /([A-Z][A-Za-z .&'-]{2,60}\s+Bank(?:\s+of\s+[A-Za-z .&'-]+)?)/,
    /\b(State Bank of India|HDFC Bank|ICICI Bank|Axis Bank|Kotak Mahindra Bank|Bank of Baroda|Punjab National Bank|Canara Bank|Union Bank of India)\b/i
  ]);
  const branchName = firstMatch(text, [
    /branch\s*[:\-]?\s*([a-zA-Z0-9 .,'/-]{3,80})/i
  ]);
  const accountHolderName = cleanPersonName(firstMatch(text, [
    /(?:account holder|a\/c holder|customer name|name)\s*[:\-]?\s*([a-zA-Z .'-]{3,80})/i
  ])) || guessNameFromLines(text);
  return { bankName, accountNumber, ifsc, branchName, accountHolderName, name: accountHolderName, fullName: accountHolderName };
}

function extractResumeFallbackData(text = '', ai = {}) {
  const contact = extractCommonContact(text);
  const workHistory = Array.isArray(ai.workHistory) ? ai.workHistory : [];
  const latestWork = workHistory[0] || {};
  const linkedin = firstMatch(text, [/(https?:\/\/(?:www\.)?linkedin\.com\/[^\s,]+)/i, /((?:www\.)?linkedin\.com\/[^\s,]+)/i]);
  const totalExperience = ai.totalExperience || firstMatch(text, [
    /(?:total experience|experience)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?\s*(?:years?|yrs?))/i,
    /([0-9]+(?:\.[0-9]+)?\s*(?:years?|yrs?)\s+(?:of\s+)?experience)/i
  ]);
  const currentDesignation = cleanLineValue(latestWork.role || firstMatch(text, [
    /(?:current\s+designation|current\s+role|designation|job\s+title|position|role)\s*[:\-]\s*([^\n\r]{2,90})/i,
    /(?:working\s+as|work\s+as|employed\s+as)\s+([^\n\r,]{2,90})/i
  ]));
  const currentCompany = cleanLineValue(latestWork.company || firstMatch(text, [
    /(?:current\s+company|company\s+name|employer|organization|organisation|company)\s*[:\-]\s*([^\n\r]{2,90})/i,
    /(?:at|with)\s+([A-Z][A-Za-z0-9 .&'-]{2,70}(?:Pvt|Ltd|Limited|LLP|Inc|Technologies|Solutions|Services)?)/i
  ]));
  const expectedCTC = cleanLineValue(firstMatch(text, [
    /(?:expected\s+ctc|expected\s+salary|salary\s+expectation)\s*[:\-]\s*([^\n\r]{2,50})/i
  ]));
  const currentCTC = cleanLineValue(firstMatch(text, [
    /(?:current\s+ctc|current\s+salary)\s*[:\-]\s*([^\n\r]{2,50})/i
  ]));

  return {
    ...contact,
    name: ai.fullName || guessNameFromLines(text),
    fullName: ai.fullName || guessNameFromLines(text),
    experience: totalExperience,
    totalExperience,
    currentDesignation,
    designation: currentDesignation,
    currentCompany,
    company: currentCompany,
    expectedCTC,
    currentCTC,
    linkedin,
    skills: Array.isArray(ai.skills) ? ai.skills.join(', ') : '',
    education: Array.isArray(ai.education) ? ai.education.map(e => e.degree || e.institution).filter(Boolean).join(', ') : ''
  };
}

function extractDocumentData(text = '', type = 'id_proof', ai = {}) {
  const common = extractCommonContact(text);
  if (type === 'aadhaar') return extractAadhaarData(text);
  if (type === 'pan') return extractPanData(text);
  if (type === 'passbook') return extractBankData(text);
  if (type === 'resume') return extractResumeFallbackData(text, ai);
  const genericName = guessNameFromLines(text);
  return { ...common, name: genericName, fullName: genericName, documentNumber: firstMatch(text, [/\b([A-Z0-9]{6,20})\b/i]) };
}

/* ----------------------------------------------------
   PARSE RESUME (PUBLIC - PRE-FILL)
---------------------------------------------------- */
exports.parseResumePublic = [
  upload.single('resume'),
  async (req, res) => {
    const fs = require('fs');

    // Helper to cleanup temp file safely
    const cleanup = () => {
      if (req.file) {
        try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (e) { }
      }
    };

    try {
      const { requirementId } = req.body;
      // console.log(`🤖 [PARSE_RESUME_PUBLIC] File: ${req.file?.originalname}, MIME: ${req.file?.mimetype}`);

      if (!req.file) {
        return res.status(400).json({ error: "No resume file uploaded" });
      }

      let jobDescription = "";
      let jobTitle = "";

      if (requirementId) {
        const tenantId = req.headers['x-tenant-id'] || req.query.tenantId;
        if (tenantId) {
          try {
            const tenantDB = await getTenantDB(tenantId);
            const Requirement = tenantDB.model('Requirement');
            const reqDoc = await Requirement.findById(requirementId).select('jobTitle description');
            if (reqDoc) {
              jobTitle = reqDoc.jobTitle;
              jobDescription = reqDoc.description;
            }
          } catch (e) { console.warn('[PARSE_RESUME_PUBLIC] Could not fetch requirement:', e.message); }
        }
      }

      // A. Text Extraction — non-blocking: if it fails, return empty success
      let rawText = "";
      let structuredData = {};
      let parseWarning = null;

      try {
        const ResumeParserService = require('../services/ResumeParser.service');
        rawText = await ResumeParserService.parseResume(req.file.path, req.file.mimetype);
        // console.log(`✅ [PARSE_RESUME_PUBLIC] Extracted ${rawText.length} chars`);
      } catch (parseErr) {
        console.warn(`⚠️ [PARSE_RESUME_PUBLIC] Text extraction failed: ${parseErr.message}`);
        parseWarning = parseErr.message;
        // Don't throw — return empty data so user can fill form manually
      }

      // B. AI Extraction — only if we have text
      if (rawText && rawText.length > 10) {
        try {
          const AIExtractionService = require('../services/AIExtraction.service');
          structuredData = await AIExtractionService.extractData(rawText, jobTitle, jobDescription);
          // console.log(`✅ [PARSE_RESUME_PUBLIC] AI extraction complete`);
        } catch (aiErr) {
          console.warn(`⚠️ [PARSE_RESUME_PUBLIC] AI extraction failed: ${aiErr.message}`);
        }
      }

      cleanup();

      // Always return success — even if parsing failed, user can fill form manually
      res.json({
        success: true,
        data: structuredData,
        rawText: rawText,
        warning: parseWarning  // Frontend can optionally show this as a soft warning
      });

    } catch (err) {
      console.error("❌ [PARSE_RESUME_PUBLIC] Unexpected Error:", err.message);
      cleanup();
      res.status(500).json({ error: "Failed to process resume. Please fill the form manually." });
    }
  }
];

/* ----------------------------------------------------
   PARSE DOCUMENT (PUBLIC - AUTO FILL CUSTOM FIELDS)
---------------------------------------------------- */
exports.parseDocumentPublic = [
  upload.single('document'),
  async (req, res) => {
    const fs = require('fs');
    const cleanup = () => {
      if (req.file) {
        try { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); } catch (e) { }
      }
    };

    try {
      const { requirementId, documentType, fieldLabel } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "No document uploaded" });
      }

      let rawText = "";
      let structuredData = {};
      let parseWarning = null;
      let jobTitle = "";
      let jobDescription = "";

      try {
        rawText = await ResumeParserService.parseResume(req.file.path, req.file.mimetype);
      } catch (parseErr) {
        console.warn(`⚠️ [PARSE_DOCUMENT_PUBLIC] Text extraction failed: ${parseErr.message}`);
        parseWarning = parseErr.message;
      }

      const detectedType = normalizeOcrDocumentType(documentType, fieldLabel, rawText);

      if (detectedType === 'resume' && rawText && rawText.length > 10) {
        if (requirementId) {
          const tenantId = req.headers['x-tenant-id'] || req.body.tenantId || req.query.tenantId;
          if (tenantId) {
            try {
              const tenantDB = await getTenantDB(tenantId);
              const Requirement = tenantDB.model('Requirement');
              const reqDoc = await Requirement.findById(requirementId).select('jobTitle description');
              if (reqDoc) {
                jobTitle = reqDoc.jobTitle;
                jobDescription = reqDoc.description;
              }
            } catch (e) { console.warn('[PARSE_DOCUMENT_PUBLIC] Could not fetch requirement:', e.message); }
          }
        }

        try {
          const AIExtractionService = require('../services/AIExtraction.service');
          structuredData = await AIExtractionService.extractData(rawText, jobTitle, jobDescription);
        } catch (aiErr) {
          console.warn(`⚠️ [PARSE_DOCUMENT_PUBLIC] AI extraction failed: ${aiErr.message}`);
        }
      }

      const data = extractDocumentData(rawText, detectedType, structuredData);
      cleanup();

      res.json({
        success: true,
        documentType: detectedType,
        data,
        rawText: rawText,
        warning: parseWarning
      });
    } catch (err) {
      console.error("❌ [PARSE_DOCUMENT_PUBLIC] Unexpected Error:", err.message);
      cleanup();
      res.status(500).json({ error: "Failed to scan document. Please fill the form manually." });
    }
  }
];
