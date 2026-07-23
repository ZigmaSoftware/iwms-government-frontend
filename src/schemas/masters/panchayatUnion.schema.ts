import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";
import { coordinateDraftSchema } from "@/schemas/shared/coordinateDraft.schema";

/**
 * Fully-required base schema. Per-instance visibility relaxation is applied
 * via `requireWhenVisible` in the component (coordinates is already optional
 * here since it was never required even when visible).
 */
export const panchayatUnionSchema = z.object({
  state_id: requiredString("State"),
  district_id: requiredString("District"),
  area_type_id: requiredString("Area Type"),
  union_name: requiredString("Union Name"),
  coordinates: z.array(coordinateDraftSchema).optional(),
  is_active: z.boolean(),
});

export type PanchayatUnionFormValues = z.infer<typeof panchayatUnionSchema>;
