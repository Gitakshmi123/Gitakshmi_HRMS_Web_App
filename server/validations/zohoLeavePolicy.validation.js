const { z } = require('zod');

const zohoLeavePolicySchema = z.object({
    name: z.string().min(1, "Policy name is required"),
    leaveType: z.enum(['PAID', 'SICK', 'CASUAL', 'UNPAID', 'MATERNITY', 'PATERNITY']),
    description: z.string().optional(),

    entitlement: z.object({
        daysPerYear: z.number().min(0),
        accrualType: z.enum(['MONTHLY', 'YEARLY', 'QUARTERLY']).default('YEARLY'),
        gradeEntitlements: z.array(z.object({
            grade: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Grade ID"),
            days: z.number().min(0)
        })).optional()
    }),

    applicability: z.object({
        targetType: z.enum(['ALL', 'GRADE', 'DEPARTMENT', 'DESIGNATION', 'SPECIFIC']).default('ALL'),
        targetValues: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid Target ID")).optional()
    }).optional(),

    restrictions: z.object({
        maxPerMonth: z.number().min(0).optional(),
        minGapBetweenLeaves: z.number().min(0).optional(),
        requireApproval: z.boolean().default(true),
        allowDuringProbation: z.boolean().default(false),
        noticePeriodDays: z.number().min(0).optional()
    }).optional(),

    resetRules: z.object({
        resetCycle: z.enum(['MONTHLY', 'YEARLY']).default('YEARLY'),
        carryForwardLimit: z.number().min(0).optional(),
        encashmentLimit: z.number().min(0).optional()
    }).optional(),

    advanced: z.object({
        allowHalfDay: z.boolean().default(true),
        allowNegativeBalance: z.boolean().default(false),
        maxNegativeBalance: z.number().min(0).optional(),
        sandwichRule: z.boolean().default(false),
        color: z.string().optional()
    }).optional(),

    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE')
});

module.exports = {
    validateLeavePolicy: (data) => zohoLeavePolicySchema.safeParse(data)
};
