import { z } from "zod";

import { optionalString, requiredString } from "./fields";

/**
 * Mirrors the original inline checks in DesignationForm: designation_name
 * and department_id were required before submit; description and status
 * were never validated.
 */
export const designationSchema = z.object({
  designation_name: requiredString("Designation name"),
  department_id: requiredString("Department"),
  description: optionalString,
  status: z.string(),
});

export type DesignationFormValues = z.infer<typeof designationSchema>;
