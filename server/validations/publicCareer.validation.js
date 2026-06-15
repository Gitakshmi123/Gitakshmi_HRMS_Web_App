const { z } = require('zod');

const listJobsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().optional(),
  location: z.string().trim().optional(),
  department: z.string().trim().optional(),
  employmentType: z.string().trim().optional(),
  experience: z.coerce.number().min(0).optional(),
  workMode: z.string().trim().optional(),
  tenantId: z.string().trim().optional(),
  companyId: z.string().trim().optional(),
});

const applyJobBody = z.object({
  jobId: z.string().trim().min(1, 'jobId is required'),
  fullName: z.string().trim().min(2, 'fullName is required').max(160),
  email: z.string().trim().email(),
  phone: z.string().trim().min(7).max(30),
  coverLetter: z.string().trim().max(5000).optional().default(''),
  tenantId: z.string().trim().optional(),
  companyId: z.string().trim().optional(),
});

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }

    req[source] = result.data;
    return next();
  };
}

module.exports = {
  listJobsQuery,
  applyJobBody,
  validate,
};
