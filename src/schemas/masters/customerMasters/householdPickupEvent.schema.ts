import { z } from "zod";

import { optionalString, requiredString } from "@/schemas/shared/fields";

/**
 * The form presents customer/property/collector/vehicle as required
 * relation selects and pickup time as a required datetime field. Sub
 * property is left optional — not every property has one (a standalone
 * house has no sub-property, unlike an apartment block). Weight is
 * captured once the pickup actually happens, so it stays optional at
 * creation but must be a non-negative number when supplied. Source is a
 * free-text note.
 */
export const householdPickupEventSchema = z.object({
  customer_id: requiredString("Customer"),
  property_id: requiredString("Property"),
  sub_property_id: optionalString,
  pickup_time: requiredString("Pickup Time"),
  weight_kg: optionalString.refine(
    (value) => !value || (Number.isFinite(Number(value)) && Number(value) >= 0),
    { message: "Weight (kg) cannot be negative" },
  ),
  collector_staff_id: requiredString("Collector"),
  vehicle_id: requiredString("Vehicle"),
  source: optionalString,
});

export type HouseholdPickupEventFormValues = z.infer<typeof householdPickupEventSchema>;
