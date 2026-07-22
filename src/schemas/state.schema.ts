import { z } from "zod";

import { requiredString } from "./fields";

/**
 * Fully-required base schema. Per-instance visibility relaxation is applied
 * via `requireWhenVisible` in the component (state_code is already optional
 * here since it was never required even when visible).
 */
export const stateSchema = z.object({
  continent_id: requiredString("Continent"),
  country_id: requiredString("Country"),
  state_name: requiredString("State Name"),
  state_code: z.string().trim().optional(),
  is_active: z.boolean(),
});

export type StateFormValues = z.infer<typeof stateSchema>;
