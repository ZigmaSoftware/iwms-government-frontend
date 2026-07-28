import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";
import { coordinateDraftSchema } from "@/schemas/shared/coordinateDraft.schema";

export const WARD_LOCAL_BODY_TYPES = [
  "corporation",
  "municipality",
  "town_panchayat",
  "panchayat_union",
  "panchayat",
] as const;

export type WardLocalBodyType = (typeof WARD_LOCAL_BODY_TYPES)[number];

export const wardSchema = z.object({
  state_id: requiredString("State"),
  district_id: requiredString("District"),
  area_type_id: requiredString("Area type"),
  local_body_type: z.enum(WARD_LOCAL_BODY_TYPES, { error: "Local body type is required" }),
  local_body_id: requiredString("Local body"),
  ward_name: requiredString("Ward name"),
  coordinates: z.array(coordinateDraftSchema).optional(),
  is_active: z.boolean(),
});

export type WardFormValues = z.infer<typeof wardSchema>;
