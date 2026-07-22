import { z } from "zod";

import { optionalString, requiredString } from "./fields";

/**
 * Mirrors the original inline check in DepartmentForm: department_name and
 * department_code were required before submit; description and status were
 * never validated.
 */
export const departmentSchema = z.object({
  department_name: requiredString("Department name"),
  department_code: requiredString("Department code"),
  description: optionalString,
  status: z.string(),
});

export type DepartmentFormValues = z.infer<typeof departmentSchema>;
