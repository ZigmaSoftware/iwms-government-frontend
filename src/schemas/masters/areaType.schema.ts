import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";
import { coordinateDraftSchema } from "@/schemas/shared/coordinateDraft.schema";

/**
 * Fully-required base schema. Per-instance visibility relaxation is applied
 * via `requireWhenVisible` in the component (coordinates is already optional
 * here since it was never required even when visible).
 *
 * `name` here is the Area Type category itself (an "Urban Local Body" /
 * "Rural Local Body" select), not a free-text label.
 */
export const areaTypeSchema = z.object({
  state_id: requiredString("State"),
  district_id: requiredString("District"),
  name: requiredString("Area Type"),
  coordinates: z.array(coordinateDraftSchema).optional(),
  is_active: z.boolean(),
});

export type AreaTypeFormValues = z.infer<typeof areaTypeSchema>;
