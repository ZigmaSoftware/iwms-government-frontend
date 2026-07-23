import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

/**
 * Mirrors the fields already marked mandatory in staffTemplateForm.tsx (the
 * Driver, Operator, Status and Approval Status `Select`s all carry the
 * `required` prop). Extra Operator and Approved By carry no such marker, so
 * they stay optional here.
 */
export const staffTemplateSchema = z.object({
  driver_id: requiredString("Driver"),
  operator_id: requiredString("Operator"),
  extra_operator_id: z.array(z.string()),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  approval_status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  approved_by: z.string(),
});

export type StaffTemplateFormValues = z.infer<typeof staffTemplateSchema>;
