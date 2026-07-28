import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";
import { coordinateDraftSchema } from "@/schemas/shared/coordinateDraft.schema";

/**
 * Fully-required base schema. Per-instance visibility relaxation is applied
 * via `requireWhenVisible` in the component (district_code/coordinates/is_active
 * are already optional here since they were never required even when visible).
 */
export const districtSchema = z.object({
  state_id: requiredString("State"),
  district_name: requiredString("District Name"),
  district_code: z.string().trim().optional(),
  coordinates: z.array(coordinateDraftSchema).optional(),
  is_active: z.boolean(),
});

export type DistrictFormValues = z.infer<typeof districtSchema>;
