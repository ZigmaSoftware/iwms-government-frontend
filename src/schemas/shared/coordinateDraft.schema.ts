import { z } from "zod";

/**
 * Draft-row schema for a lat/lng pair entered as raw strings in a coordinate
 * list editor (see `GeoFenceCoordinates`). Shared by every location-hierarchy
 * form (district, corporation, municipality, panchayat, ...) instead of each
 * one hand-rolling an identical copy.
 */
export const coordinateDraftSchema = z
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

export type CoordinateDraft = z.infer<typeof coordinateDraftSchema>;
