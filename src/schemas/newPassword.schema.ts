import { z } from "zod";

import { CONFIRM_PASSWORD_MESSAGE, passwordField } from "./shared/fields";

/** Shared by every "set/change/reset password" form: one password field plus a
 * confirmation that must match, enforcing the canonical password policy. */
export const newPasswordSchema = z
  .object({
    newPassword: passwordField,
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: CONFIRM_PASSWORD_MESSAGE,
    path: ["confirmPassword"],
  });

export type NewPasswordFormValues = z.infer<typeof newPasswordSchema>;
