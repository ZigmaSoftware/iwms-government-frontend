import { z } from "zod";

import { requiredString } from "./fields";

/**
 * Fully-required base schema for the Hierarchy master form. Per-instance
 * visibility relaxation is applied via `requireWhenVisible` in the
 * component. Mirrors the original getMissingRequiredFields checks:
 * level_name and area_type were required, is_active was never validated.
 */
export const hierarchySchema = z.object({
  area_type: requiredString("Area Type"),
  level_name: requiredString("Level Name"),
  is_active: z.boolean(),
});

export type HierarchyFormValues = z.infer<typeof hierarchySchema>;
