const { z } = require('zod');

const objectId = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'Invalid MongoDB ObjectId');

const benefitSchema = z.object({
  name: z.string().trim().min(1, 'Benefit name is required').max(120),
  code: z.string().trim().max(60).optional(),
  type: z.enum(['ALLOWANCE', 'INSURANCE', 'RETIREMENT', 'LEAVE', 'PERK', 'CUSTOM']).default('CUSTOM'),
  valueType: z.enum(['FIXED', 'PERCENTAGE', 'TEXT', 'BOOLEAN']).default('TEXT'),
  value: z.any().optional().nullable(),
  description: z.string().trim().max(500).optional().default(''),
  isTaxable: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

const timeHHMM = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format')
  .optional()
  .or(z.literal(''));

const attendanceRulesSchema = z.object({
  timingType: z.enum(['fixed', 'flexible']).optional(),
  timingMode: z.enum(['fixed', 'flexible']).optional(),
  shiftStartTime: timeHHMM,
  shiftEndTime: timeHHMM,
  flexibleWindowStart: timeHHMM,
  flexibleWindowEnd: timeHHMM,
  requiredWorkMinutes: z.number().int().min(0).optional().nullable(),
  workingHoursPerDay: z.number().min(0).max(24).optional(),
  graceLateMinutes: z.number().int().min(0).optional(),
  graceEarlyMinutes: z.number().int().min(0).optional(),
  halfDayThresholdHours: z.number().min(0).max(24).optional(),
  fullDayThresholdHours: z.number().min(0).max(24).optional(),
  weeklyOffDays: z.array(z.number().int().min(0).max(6)).optional(),
  overtimeEligible: z.boolean().optional(),
  overtimeStartsAfterMinutes: z.number().int().min(0).optional(),
  leaveDeductionOrder: z.array(z.string().trim().min(1).max(30)).optional(),
  autoMarkAbsentOnNoPunch: z.boolean().optional(),
  lateMarkEnabled: z.boolean().optional(),
  allowedLateMinutesPerDay: z.number().int().min(0).optional(),
  lateMarksToHalfDay: z.number().int().min(0).optional(),
  lateMarksToFullDay: z.number().int().min(0).optional(),
  earlyExitEnabled: z.boolean().optional(),
  earlyExitsToHalfDay: z.number().int().min(0).optional(),
  earlyExitsToFullDay: z.number().int().min(0).optional(),
  autoLeaveDeductionEnabled: z.boolean().optional(),
}).strict();

const leaveRuleSchema = z.object({
  leaveType: z.string().trim().min(1).max(60),
  totalPerYear: z.number().min(0).optional(),
  monthlyAccrual: z.boolean().optional(),
  accrualType: z.enum(['yearly', 'monthly']).optional(),
  monthlyAccrualRate: z.number().min(0).optional(),
  carryForwardAllowed: z.boolean().optional(),
  maxCarryForward: z.number().min(0).optional(),
  maxLeaveCap: z.number().min(0).optional(),
  expiryMonths: z.number().int().min(0).optional(),
  encashmentAllowed: z.boolean().optional(),
  requiresApproval: z.boolean().optional(),
  allowDuringProbation: z.boolean().optional(),
  minimumTenureMonths: z.number().int().min(0).optional(),
  prorateForNewJoiners: z.boolean().optional(),
  color: z.string().trim().max(40).optional(),
}).strict();

const validateGradeDatesAndThresholds = (body, ctx) => {
  if (body.effectiveFrom && body.effectiveTo && body.effectiveTo < body.effectiveFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['effectiveTo'],
      message: 'effectiveTo must be greater than or equal to effectiveFrom',
    });
  }

  if (
    body.attendanceRules?.halfDayThresholdHours !== undefined &&
    body.attendanceRules?.fullDayThresholdHours !== undefined &&
    body.attendanceRules.halfDayThresholdHours > body.attendanceRules.fullDayThresholdHours
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attendanceRules.halfDayThresholdHours'],
      message: 'halfDayThresholdHours cannot exceed fullDayThresholdHours',
    });
  }

  if (
    body.attendanceRules?.lateMarksToHalfDay &&
    body.attendanceRules?.lateMarksToFullDay &&
    body.attendanceRules.lateMarksToHalfDay > body.attendanceRules.lateMarksToFullDay
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['attendanceRules.lateMarksToHalfDay'],
      message: 'lateMarksToHalfDay cannot exceed lateMarksToFullDay',
    });
  }
};

const gradeShape = {
  name: z.string().trim().min(2, 'Grade name must be at least 2 characters').max(120),
  code: z.string().trim().max(60).optional(),
  level: z.number().int().min(1).max(999),
  description: z.string().trim().max(1000).optional(),
  benefits: z.array(benefitSchema).optional(),
  attendanceRules: attendanceRulesSchema.optional(),
  leaveRules: z.array(leaveRuleSchema).optional(),
  effectiveFrom: z.coerce.date().optional().nullable(),
  effectiveTo: z.coerce.date().optional().nullable(),
  isActive: z.boolean().optional(),
};

const createGradeShape = {
  ...gradeShape,
  description: gradeShape.description.default(''),
  benefits: gradeShape.benefits.default([]),
  attendanceRules: gradeShape.attendanceRules.default({}),
  leaveRules: gradeShape.leaveRules.default([]),
  isActive: gradeShape.isActive.default(true),
};

const gradeBody = z.object(createGradeShape).strict().superRefine(validateGradeDatesAndThresholds);

const updateGradeBody = z.object(gradeShape).partial().strict().superRefine((body, ctx) => {
  if (Object.keys(body).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [],
      message: 'At least one field is required',
    });
  }

  validateGradeDatesAndThresholds(body, ctx);
});

const listGradesSchema = z.object({
  body: z.object({}).passthrough().default({}),
  params: z.object({}).passthrough().default({}),
  query: z.object({
    search: z.string().trim().max(120).optional(),
    isActive: z.enum(['true', 'false']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['name', 'level', 'createdAt', 'updatedAt']).default('level'),
    sortOrder: z.enum(['asc', 'desc']).default('asc'),
  }).default({}),
});

const createGradeSchema = z.object({
  body: gradeBody,
  query: z.object({}).passthrough().default({}),
  params: z.object({}).passthrough().default({}),
});

const updateGradeSchema = z.object({
  body: updateGradeBody,
  query: z.object({}).passthrough().default({}),
  params: z.object({ id: objectId }),
});

const gradeIdSchema = z.object({
  body: z.object({}).passthrough().default({}),
  query: z.object({}).passthrough().default({}),
  params: z.object({ id: objectId }),
});

module.exports = {
  createGradeSchema,
  updateGradeSchema,
  gradeIdSchema,
  listGradesSchema,
};
