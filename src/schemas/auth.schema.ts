import { z } from "zod";
import { emailField, requiredString } from "@/schemas/shared/fields";

export const loginSchema = z.object({
  username: requiredString("Username"),
  password: requiredString("Password"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  username: requiredString("Username"),
  email: emailField,
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const otpVerificationSchema = z.object({
  sessionToken: requiredString("Session token"),
  otpCode: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Enter the 4-digit code"),
});

export type OtpVerificationFormValues = z.infer<typeof otpVerificationSchema>;
