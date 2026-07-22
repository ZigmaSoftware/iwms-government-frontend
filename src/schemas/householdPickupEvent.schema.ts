import { z } from "zod";

import { optionalString } from "./fields";

/**
 * The original HouseholdPickupEventForm performed no required-field checks
 * before submit — every field was optional at the point of save. This
 * schema mirrors that behavior exactly; it exists only to route the form
 * through react-hook-form + zodResolver consistently with the rest of the
 * app, not to introduce new validation.
 */
export const householdPickupEventSchema = z.object({
  customer_id: optionalString,
  property_id: optionalString,
  sub_property_id: optionalString,
  pickup_time: optionalString,
  weight_kg: optionalString,
  collector_staff_id: optionalString,
  vehicle_id: optionalString,
  source: optionalString,
});

export type HouseholdPickupEventFormValues = z.infer<typeof householdPickupEventSchema>;
