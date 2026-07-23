import { z } from "zod";

import { nonNegativeNumberField, requiredString } from "@/schemas/shared/fields";

/**
 * WasteCollectedDataForm's submit handler only ever guarded Customer and
 * Collection Date before save — the geo cascade, Trip Assignment and Status
 * are all optional. The four waste-quantity inputs (wet/dry/mixed/sanitary)
 * were never blocked on either (a blank input becomes `0` via `Number(...)
 * || 0` in the payload), but their HTML inputs already carry `min={0}`, so
 * `nonNegativeNumberField` enforces that same non-negative constraint
 * server-side too while still treating a blank value as `0`, not an error.
 */
export const wasteCollectedDataSchema = z.object({
  customerId: requiredString("Customer"),
  collectionDate: requiredString("Collection Date"),
  wetWaste: nonNegativeNumberField("Wet Waste"),
  dryWaste: nonNegativeNumberField("Dry Waste"),
  mixedWaste: nonNegativeNumberField("Mixed Waste"),
  sanitaryWaste: nonNegativeNumberField("Sanitary Waste"),
});

export type WasteCollectedDataFormValues = z.infer<typeof wasteCollectedDataSchema>;
