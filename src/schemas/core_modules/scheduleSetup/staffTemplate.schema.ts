import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

/**
 * Mirrors the fields already marked mandatory in staffTemplateForm.tsx (the
 * Driver, Operator and Status `Select`s all carry the `required` prop).
 * Extra Operator carries no such marker, so it stays optional here.
 */
export const staffTemplateSchema = z.object({
  driver_id: requiredString("Driver"),
  operator_id: requiredString("Operator"),
  extra_operator_id: z.array(z.string()),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type StaffTemplateFormValues = z.infer<typeof staffTemplateSchema>;
