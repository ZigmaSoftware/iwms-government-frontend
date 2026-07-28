import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";
import { coordinateDraftSchema } from "@/schemas/shared/coordinateDraft.schema";

/**
 * Country -> State -> District -> Area Type -> Local Body cascade rendered by
 * the shared `LocationFields` component. Every leg was required in the old
 * manual check, so every leg stays required here.
 */
const geoLocationSchema = z.object({
  countryId: requiredString("Country"),
  stateId: requiredString("State"),
  districtId: requiredString("District"),
  areaTypeId: requiredString("Area Type"),
  localBodyLevel: z.enum([
    "corporation_id",
    "municipality_id",
    "town_panchayat_id",
    "panchayat_union_id",
    "panchayat_id",
  ], { error: "Local Body Level is required" }),
  localBodyId: requiredString("Local Body"),
});

/**
 * One row of the inline Bins editor. `key` is UI-only React list bookkeeping
 * (never sent to the API); `unique_id` is only present when editing an
 * existing bin. The other fields were all required in the old
 * `bins.some((bin) => !bin.wastetype_id || ...)` guard.
 */
const binRowSchema = z.object({
  key: z.string(),
  unique_id: z.string().optional(),
  wastetype_id: requiredString("Waste Type"),
  bin_name: requiredString("Bin Name"),
  bin_capacity: requiredString("Bin Capacity").refine(
    (value) => {
      const num = Number(value);
      return Number.isFinite(num) && num > 0;
    },
    { message: "Bin Capacity must be greater than 0" },
  ),
  bin_type: requiredString("Bin Type"),
  ward_id: requiredString("Bin Ward"),
  is_active: z.boolean(),
});

/**
 * Fully-required base schema mirroring exactly which fields were guarded in
 * the old manual validation:
 *  - geo.* and cp_name: required (were in the top-level `if` check).
 *  - collection_type / is_active: always populated by their controls'
 *    defaults, never blank — never explicitly checked, same treatment as
 *    district.schema.ts's `is_active`.
 *  - coordinates: optional, never required (there was no coordinate check).
 *  - bins: optional array (zero bins is valid — "No bins added yet"), but
 *    every row present must satisfy binRowSchema.
 */
export const collectionPointSchema = z.object({
  geo: geoLocationSchema,
  cp_name: requiredString("Collection Point Name"),
  collection_type: z.string(),
  coordinates: z.array(coordinateDraftSchema).optional(),
  is_active: z.boolean(),
  bins: z.array(binRowSchema).optional(),
  ward_ids: z.array(z.string()).min(1, "Select at least one ward"),
});

export type CollectionPointFormValues = z.infer<typeof collectionPointSchema>;
