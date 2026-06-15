const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const RequirementSchema = require('../models/Requirement');
const ApplicantSchema = require('../models/Applicant');
const getTenantDB = require('../utils/tenantDB');
const { generateApplicationId } = require('../utils/idGenerator');
const { stringifyId } = require('../utils/idUtils');

/**
 * HELPER: Escape Regex
 */
function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * HELPER: Regex Wrapper
 */
function asRegex(value) {
  return new RegExp(escapeRegex(value), 'i');
}

/**
 * AUTO RESOLVE TENANT
 * 1. Find active tenant
 * 2. If multiple active, load latest updated
 * 3. If no active, fallback to first tenant
 */
async function resolvePublicTenant(req) {
  // 1. Check for explicit tenantId in headers or query
  const tenantId = req?.headers?.['x-tenant-id'] || req?.query?.tenantId;
  
  if (tenantId && mongoose.Types.ObjectId.isValid(tenantId)) {
    const tenant = await Tenant.findById(tenantId).lean();
    if (tenant) return tenant;
  }

  // 2. Fallback to latest active tenant (legacy discovery)
  let tenant = await Tenant.findOne({ status: 'active' })
    .sort({ updatedAt: -1 })
    .lean();

  // 3. Last resort fallback
  if (!tenant) {
    tenant = await Tenant.findOne({})
      .sort({ updatedAt: -1 })
      .lean();
  }

  if (!tenant) {
    const error = new Error('No company found in system');
    error.statusCode = 404;
    throw error;
  }

  return tenant;
}

/**
 * GET PUBLIC MODELS
 * Automatically resolves the correct tenant database and models
 */
async function getPublicModels(req) {
  const tenant = await resolvePublicTenant(req);
  const tenantDB = await getTenantDB(String(tenant._id));

  if (!tenantDB) {
    const error = new Error('Company database connection failed');
    error.statusCode = 500;
    throw error;
  }

  const Requirement = tenantDB.models.Requirement || tenantDB.model('Requirement', RequirementSchema);
  const Applicant = tenantDB.models.Applicant || tenantDB.model('Applicant', ApplicantSchema);

  return { tenant, tenantDB, Requirement, Applicant };
}

/**
 * BUILD JOB FILTER
 * Ensures only open, external, and published jobs are shown
 */
function buildPublicJobFilter(query = {}) {
  const filter = {
    $and: [
      {
        $or: [
          { status: /open/i },
          { hiringStatus: /open/i },
          { 'jobDetails.status': /open/i },
        ],
      },
      {
        $or: [
          { visibility: /external|both/i },
          { 'jobDetails.visibility': /external|both/i },
          { visibility: { $exists: false } },
          { 'jobDetails.visibility': { $exists: false } },
        ],
      },
      { isDeleted: { $ne: true } },
      { deleted: { $ne: true } },
    ],
  };

  // Search by title, department, skills
  if (query.search) {
    const rx = asRegex(query.search);
    filter.$and.push({
      $or: [
        { jobTitle: rx },
        { department: rx },
        { 'jobDetails.location': rx },
        { 'jobDescription.roleOverview': rx },
      ],
    });
  }

  // Filter by location
  if (query.location) {
    filter.$and.push({
      $or: [
        { location: asRegex(query.location) },
        { 'jobDetails.location': asRegex(query.location) },
      ],
    });
  }

  // Filter by department
  if (query.department) {
    filter.$and.push({ department: asRegex(query.department) });
  }

  return filter;
}

/**
 * SERIALIZE JOB
 * Clean job data for public view
 */
function serializeJob(job) {
  const requiredSkills = Array.isArray(job.requiredSkills)
    ? job.requiredSkills.map((skill) => skill?.name || skill).filter(Boolean)
    : [];

  const preferredSkills = Array.isArray(job.preferredSkills)
    ? job.preferredSkills.map((skill) => skill?.name || skill).filter(Boolean)
    : [];

  return {
    id: stringifyId(job._id),
    _id: stringifyId(job._id),
    title: job.jobTitle,
    jobTitle: job.jobTitle,
    department: job.department || '',
    location: job.location || job.jobDetails?.location || 'Remote',
    type: job.employmentType || job.jobDetails?.jobType || 'Full-time',
    experience: {
      min: job.jobDetails?.experienceMin ?? 0,
      max: job.jobDetails?.experienceMax ?? null,
    },
    salary: {
      min: job.jobDetails?.salaryMin ?? null,
      max: job.jobDetails?.salaryMax ?? null,
      currency: job.jobDetails?.currency || 'INR',
    },
    description: job.description || job.jobDescription?.roleOverview || '',
    responsibilities: job.jobDescription?.responsibilities || [],
    skills: [...new Set([...requiredSkills, ...preferredSkills])],
    publishedAt: job.publishedAt || job.createdAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    vacancy: job.vacancy || 1,
    status: job.status || job.hiringStatus || 'Open',
    visibility: job.visibility || job.jobDetails?.visibility || 'External',
  };
}

/**
 * GET /api/public/careers/jobs
 */
exports.getJobs = async (req, res, next) => {
  try {
    const { Requirement } = await getPublicModels(req);
    
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter = buildPublicJobFilter(req.query);

    const [jobs, total] = await Promise.all([
      Requirement.find(filter)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Requirement.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      message: 'Jobs fetched successfully',
      data: {
        jobs: jobs.map(serializeJob),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/public/careers/jobs/:id
 */
exports.getJobById = async (req, res, next) => {
  try {
    const { Requirement } = await getPublicModels(req);

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid Job ID format' });
    }

    const filter = buildPublicJobFilter();
    const job = await Requirement.findOne({
      _id: req.params.id,
      $and: filter.$and,
    }).lean();

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found or no longer available' });
    }

    return res.json({
      success: true,
      message: 'Job details fetched successfully',
      data: serializeJob(job),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/public/careers/apply
 */
exports.applyJob = async (req, res, next) => {
  try {
    const { jobId, fullName, email, phone, coverLetter } = req.body;

    // 1. Validate Required Fields
    if (!jobId || !fullName || !email || !phone) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields: jobId, fullName, email, phone' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Resume file is required' });
    }

    // 2. Resolve Tenant & Models
    const { tenant, tenantDB, Requirement, Applicant } = await getPublicModels(req);

    // 3. Validate Job
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: 'Invalid Job ID' });
    }

    const job = await Requirement.findOne({
      _id: jobId,
      ...buildPublicJobFilter(),
    }).lean();

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found or closed' });
    }

    // 4. Duplicate Check (Same email for same job)
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await Applicant.findOne({
      requirementId: job._id,
      email: normalizedEmail,
    });

    if (existing) {
      return res.status(409).json({ success: false, message: 'You have already applied for this position' });
    }

    // 5. Generate Application ID
    const applicationId = await generateApplicationId(tenantDB);

    // 6. Create Application
    const applicant = await Applicant.create({
      applicationId,
      tenant: tenant._id,
      requirementId: job._id,
      source: 'External',
      name: fullName,
      email: normalizedEmail,
      mobile: phone,
      resume: req.file.filename,
      status: 'Applied',
      customData: {
        coverLetter,
        appliedVia: 'Public Career Portal',
      },
      timeline: [
        {
          status: 'Applied',
          message: 'Application received via Public Career Portal',
          updatedBy: 'System',
          timestamp: new Date(),
        },
      ],
    });

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: {
        applicationId: applicant.applicationId,
        jobTitle: job.jobTitle,
        appliedAt: applicant.createdAt,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * ERROR HANDLER
 */
exports.errorHandler = (err, _req, res, _next) => {
  console.error('[PUBLIC_CAREER_API_ERROR]', err);

  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Something went wrong',
  });
};
