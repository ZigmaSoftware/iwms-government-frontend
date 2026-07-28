import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

/**
 * Mirrors the fields that were already marked mandatory in
 * AlternativeStaffTemplateForm.tsx (red-asterisk label + HTML `required` on
 * From Date, To Date, Driver, Operator, Change Reason). Staff Template,
 * Extra Operator and Remarks carry no such marker in the form today, so they
 * stay optional here.
 */
export const alternativeStaffTemplateSchema = z.object({
  staff_template: z.string(),
  effective_date: z.string(),
  from_date: requiredString("From Date"),
  to_date: requiredString("To Date"),
  driver: requiredString("Driver"),
  operator: requiredString("Operator"),
  extra_operator: z.array(z.string()),
  change_reason: requiredString("Change Reason"),
  change_remarks: z.string(),
});

export type AlternativeStaffTemplateFormValues = z.infer<typeof alternativeStaffTemplateSchema>;
