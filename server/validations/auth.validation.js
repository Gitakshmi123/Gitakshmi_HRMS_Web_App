const { z } = require('zod');

const normalizedString = z
  .string()
  .trim()
  .min(1)
  .max(256);

const passwordField = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(256, 'Password is too long');

const loginBodySchema = z
  .object({
    email: z.string().trim().email('Invalid email address').optional(),
    identifier: normalizedString.optional(),
    employeeCode: normalizedString.optional(),
    password: passwordField,
  })
  .superRefine((body, ctx) => {
    const hasIdentifier = Boolean(body.identifier || body.email || body.employeeCode);

    if (!hasIdentifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['identifier'],
        message: 'Email, identifier, or employeeCode is required',
      });
    }
  });

const loginSchema = z.object({
  body: loginBodySchema,
  query: z.object({}).passthrough().default({}),
  params: z.object({}).passthrough().default({}),
});

const passwordOnlySchema = z.object({
  body: z.object({
    password: passwordField,
  }),
  query: z.object({}).passthrough().default({}),
  params: z.object({}).passthrough().default({}),
});

module.exports = {
  loginSchema,
  passwordOnlySchema,
};
