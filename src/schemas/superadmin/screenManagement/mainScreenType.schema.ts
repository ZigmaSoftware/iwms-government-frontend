import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";

/**
 * Mirrors the original inline check in MainScreenTypeForm: typeName was
 * required before submit; status was never validated (always defaulted).
 */
export const mainScreenTypeSchema = z.object({
  typeName: requiredString("Type Name"),
  isActive: z.boolean(),
});

export type MainScreenTypeFormValues = z.infer<typeof mainScreenTypeSchema>;
