import { z } from "zod";

import { optionalString, requiredString } from "@/schemas/shared/fields";

/**
 * `level` is only mandatory for the Government category (the form only ever
 * sends it when a Government user type is selected); Staff/Contractor never
 * require it, matching the component's `if (isGovernment && !selectedLevel)`
 * check.
 */
export const staffUserTypeSchema = z
  .object({
    usertype_id: requiredString("User Type"),
    name: requiredString("Role"),
    level: optionalString,
    is_active: z.boolean(),
    category: z.enum(["staff", "contractor", "government"]),
  })
  .superRefine((data, ctx) => {
    if (data.category === "government" && !data.level.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["level"],
        message: "Government Level is required",
      });
    }
  });

export type StaffUserTypeFormValues = z.infer<typeof staffUserTypeSchema>;
