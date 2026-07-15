// Zod re-expression of Inventra/lib/validation/auth.ts's framework-free
// validators — same rules, same error copy, so behavior stays identical
// between web and mobile even though the mobile stack (React Hook Form +
// Zod, per AGENTS.md) differs from the web's inline functions.
import { z } from 'zod';

import { isKnownCountry } from '@/lib/geo/countries';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PasswordRule {
  key: string;
  label: string;
  test: (pw: string) => boolean;
}

export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'length', label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { key: 'upper', label: 'One uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lower', label: 'One lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { key: 'number', label: 'One number', test: (pw) => /\d/.test(pw) },
  { key: 'special', label: 'One special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

export function passwordStrength(pw: string): number {
  return PASSWORD_RULES.filter((r) => r.test(pw)).length;
}

const passwordSchema = z.string().superRefine((pw, ctx) => {
  const unmet = PASSWORD_RULES.filter((r) => !r.test(pw));
  if (unmet.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Password must have: ${unmet.map((r) => r.label.toLowerCase()).join(', ')}.`,
    });
  }
});

const fullNameSchema = z
  .string()
  .trim()
  .min(1, 'Full name is required.')
  .min(3, 'Full name must be at least 3 characters.');

const emailSchema = z.string().trim().min(1, 'Email is required.').regex(EMAIL_RE, 'Enter a valid email address.');

const businessEmailSchema = z
  .string()
  .trim()
  .regex(EMAIL_RE, 'Enter a valid business email address.')
  .optional()
  .or(z.literal(''));

const businessNameSchema = z.string().trim().min(1, 'Business name is required.');

export const signupSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: passwordSchema,
    businessName: businessNameSchema,
    businessEmail: businessEmailSchema,
    country: z.string().min(1, 'Country is required.'),
    state: z.string().optional(),
    role: z.enum(['admin', 'manager', 'staff']),
    termsAccepted: z.boolean().refine((v) => v, {
      message: 'You must accept the Terms & Conditions and Privacy Policy.',
    }),
  })
  .superRefine((values, ctx) => {
    if (!isKnownCountry(values.country)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select a valid country.', path: ['country'] });
    }
  });

export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Mirrors CompleteProfileForm.tsx's client-side rules, which vary by
// whether the signed-in user can edit the business fields (owner/admin) and
// whether terms are already accepted.
export function buildCompleteOnboardingSchema(opts: {
  canEditBusiness: boolean;
  termsAlreadyAccepted: boolean;
}) {
  return z
    .object({
      businessName: z.string().trim().optional(),
      businessEmail: businessEmailSchema,
      country: opts.canEditBusiness ? z.string().min(1, 'Country is required.') : z.string().optional(),
      state: z.string().optional(),
      termsAccepted: opts.termsAlreadyAccepted
        ? z.boolean().optional()
        : z.boolean().refine((v) => v, {
            message: 'You must accept the Terms & Conditions and Privacy Policy.',
          }),
    })
    .superRefine((values, ctx) => {
      if (values.country && !isKnownCountry(values.country)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Select a valid country.', path: ['country'] });
      }
    });
}

export type CompleteOnboardingInput = z.infer<ReturnType<typeof buildCompleteOnboardingSchema>>;
