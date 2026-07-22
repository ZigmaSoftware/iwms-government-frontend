import { z } from "zod";

import { requiredString } from "./fields";

/**
 * Per-row lat/long validator for the GeoFenceCoordinates draft rows — copied
 * from district.schema.ts (see that file for the rationale of keeping lat/lng
 * as strings and only validating non-empty rows).
 */
const coordinateDraftSchema = z
  .object({
    latitude: z.string(),
    longitude: z.string(),
  })
  .superRefine((value, ctx) => {
    const latStr = value.latitude.trim();
    const lngStr = value.longitude.trim();
    if (!latStr && !lngStr) return; // empty row — ignored at submit time

    const lat = Number(latStr);
    if (!latStr || !Number.isFinite(lat) || lat < -90 || lat > 90) {
      ctx.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Latitude must be between -90 and 90",
      });
    }

    const lng = Number(lngStr);
    if (!lngStr || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      ctx.addIssue({
        code: "custom",
        path: ["longitude"],
        message: "Longitude must be between -180 and 180",
      });
    }
  });

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
  localBodyLevel: requiredString("Local Body Level"),
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
});

export type CollectionPointFormValues = z.infer<typeof collectionPointSchema>;
