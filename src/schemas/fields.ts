import { z } from "zod";

/**
 * Shared, reusable field-level Zod schemas. Every form in the app should
 * source its email/mobile/pincode/password/coordinate validation from here
 * instead of hand-rolling regex, so the rule (and its error copy) is defined
 * exactly once.
 */

export const requiredString = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`);

export const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => value ?? "");

export const EMAIL_MESSAGE = "Enter a valid email address";

export const emailField = z
  .string()
  .trim()
  .min(1, "Email is required")
  .email(EMAIL_MESSAGE);

export const optionalEmailField = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || z.string().email().safeParse(value).success, {
    message: EMAIL_MESSAGE,
  });

export const MOBILE_MESSAGE = "Enter a valid 10-digit mobile number";

export const mobileField = z
  .string()
  .trim()
  .regex(/^\d{10}$/, MOBILE_MESSAGE);

export const optionalMobileField = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^\d{10}$/.test(value), { message: MOBILE_MESSAGE });

export const PINCODE_MESSAGE = "Enter a valid 6-digit pincode";

export const pincodeField = z
  .string()
  .trim()
  .regex(/^\d{6}$/, PINCODE_MESSAGE);

export const optionalPincodeField = z
  .string()
  .trim()
  .optional()
  .refine((value) => !value || /^\d{6}$/.test(value), { message: PINCODE_MESSAGE });

/**
 * Canonical password policy for the whole app: at least 8 characters, one
 * uppercase, one lowercase, one digit, one special character. Replaces the
 * 3+ conflicting ad-hoc rules previously scattered across forms (an 8-12
 * char cap with no digit requirement in one form, a cosmetic-only strength
 * meter in another, no rule at all in a third).
 */
export const PASSWORD_POLICY_MESSAGE =
  "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.";

export const passwordField = z
  .string()
  .min(8, PASSWORD_POLICY_MESSAGE)
  .regex(/[A-Z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[a-z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[0-9]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[^A-Za-z0-9]/, PASSWORD_POLICY_MESSAGE);

export const CONFIRM_PASSWORD_MESSAGE = "Passwords do not match";

/** Attach to a schema's `.refine()`/`.superRefine()` to enforce a confirm-password match. */
export const passwordsMatch = <T extends { password: string; confirmPassword: string }>(
  data: T,
) => data.password === data.confirmPassword;

export const latitudeField = z.coerce
  .number({ error: "Latitude is required" })
  .min(-90, "Latitude must be between -90 and 90")
  .max(90, "Latitude must be between -90 and 90");

export const longitudeField = z.coerce
  .number({ error: "Longitude is required" })
  .min(-180, "Longitude must be between -180 and 180")
  .max(180, "Longitude must be between -180 and 180");

export const OTP_MESSAGE = "Enter the 6-digit code";

export const otpField = z
  .string()
  .trim()
  .regex(/^\d{6}$/, OTP_MESSAGE);

export const positiveIntField = (label: string) =>
  z.coerce.number({ error: `${label} is required` }).int().positive(`${label} must be greater than 0`);

export const nonNegativeNumberField = (label: string) =>
  z.coerce.number({ error: `${label} is required` }).min(0, `${label} cannot be negative`);
