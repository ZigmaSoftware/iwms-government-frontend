import { z } from "zod";

import { latitudeField, longitudeField, requiredString } from "@/schemas/shared/fields";

/**
 * VehicleBreakdownForm's submit handler guarded, in order: Trip Assignment,
 * Broken Vehicle (auto-filled, blocked on only to catch a trip that
 * resolved no vehicle), Breakdown Reason, Replacement Vehicle, Replacement
 * Driver, Replacement Operator, and Breakdown Latitude/Longitude (both
 * required and range-checked -90..90 / -180..180). Breakdown Time, Weight
 * Before Breakdown, Location and Remarks were always optional.
 *
 * `latitudeField`/`longitudeField` alone coerce an empty string to `0`
 * (which passes their range check), so the "required" case is enforced by a
 * string presence check first, then delegated to the shared field.
 */
const requiredLatitude = z
  .string()
  .trim()
  .min(1, "Breakdown Latitude is required")
  .transform((value, ctx) => {
    const result = latitudeField.safeParse(value);
    if (!result.success) {
      result.error.issues.forEach((issue) => ctx.addIssue({ code: "custom", message: issue.message }));
      return z.NEVER;
    }
    return result.data;
  });

const requiredLongitude = z
  .string()
  .trim()
  .min(1, "Breakdown Longitude is required")
  .transform((value, ctx) => {
    const result = longitudeField.safeParse(value);
    if (!result.success) {
      result.error.issues.forEach((issue) => ctx.addIssue({ code: "custom", message: issue.message }));
      return z.NEVER;
    }
    return result.data;
  });

export const vehicleBreakdownSchema = z.object({
  trip_assignment_id: requiredString("Trip Assignment"),
  breakdown_vehicle_id: requiredString("Broken Vehicle"),
  replacement_vehicle_id: requiredString("Replacement Vehicle"),
  replacement_driver_id: requiredString("Replacement Driver"),
  replacement_operator_id: requiredString("Replacement Operator"),
  breakdown_reason: requiredString("Breakdown Reason"),
  breakdown_lat: requiredLatitude,
  breakdown_lng: requiredLongitude,
});

export type VehicleBreakdownFormValues = z.infer<typeof vehicleBreakdownSchema>;
