import { z } from "zod";

import { requiredString } from "./fields";

/**
 * Mirrors the original inline check in UserScreenActionForm: actionName and
 * variableName were required before submit; status was never validated.
 */
export const userScreenActionSchema = z.object({
  actionName: requiredString("Action Name"),
  variableName: requiredString("Variable Name"),
  isActive: z.boolean(),
});

export type UserScreenActionFormValues = z.infer<typeof userScreenActionSchema>;
