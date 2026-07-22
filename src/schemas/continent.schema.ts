import { z } from "zod";

import { requiredString } from "./fields";

/**
 * Fully-required base schema. Per-instance visibility relaxation is applied
 * via `requireWhenVisible` in the component.
 */
export const continentSchema = z.object({
  name: requiredString("Continent Name"),
  is_active: z.boolean(),
});

export type ContinentFormValues = z.infer<typeof continentSchema>;
