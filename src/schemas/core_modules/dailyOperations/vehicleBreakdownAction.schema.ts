import { z } from "zod";

import { optionalRemarks, requiredRemarks } from "@/schemas/core_modules/shared/remarks.schema";

/**
 * `VehicleBreakdownViewSet.verify` / `.reject`
 * (`VehicleBreakdownVerifySerializer` / `VehicleBreakdownRejectSerializer`).
 *
 * - verify: `remarks` optional. `collection_point_ids` is only sent for a bin
 *   trip, and then at least one stop must be carried over.
 * - reject: `rejection_remarks` is required (blank is rejected by DRF).
 */
export const vehicleBreakdownVerifySchema = z.object({
  remarks: optionalRemarks(),
  collection_point_ids: z
    .array(z.string())
    .min(1, "Select at least one collection point to carry over to the replacement trip.")
    .optional(),
});

export const vehicleBreakdownRejectSchema = z.object({
  rejection_remarks: requiredRemarks({ label: "Rejection reason" }),
});
