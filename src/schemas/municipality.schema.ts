import { z } from "zod";

import { requiredString } from "./fields";

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
 * Fully-required base schema. Per-instance visibility relaxation is applied
 * via `requireWhenVisible` in the component (coordinates is already optional
 * here since it was never required even when visible).
 */
export const municipalitySchema = z.object({
  state_id: requiredString("State"),
  district_id: requiredString("District"),
  area_type_id: requiredString("Area Type"),
  municipality_name: requiredString("Municipality Name"),
  coordinates: z.array(coordinateDraftSchema).optional(),
  is_active: z.boolean(),
});

export type MunicipalityFormValues = z.infer<typeof municipalitySchema>;
