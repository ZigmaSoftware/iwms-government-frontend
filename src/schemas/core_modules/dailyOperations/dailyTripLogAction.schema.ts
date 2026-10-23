import { z } from "zod";

import { optionalRemarks, requiredRemarks } from "@/schemas/core_modules/shared/remarks.schema";

/** `DailyTripLog.LOG_STATUS_*` — the only values `change-status` accepts. */
export const DAILY_TRIP_LOG_STATUSES = ["Draft", "Submitted", "Verified"] as const;

/** `DailyTripLogViewSet.verify`: remarks optional. */
export const dailyTripLogVerifySchema = z.object({
  remarks: optionalRemarks(),
});

/** `DailyTripLogViewSet.change_status`. */
export const dailyTripLogChangeStatusSchema = z.object({
  log_status: z.enum(DAILY_TRIP_LOG_STATUSES, { error: "Select a valid log status" }),
});

/**
 * `DailyTripAssignmentViewSet.proceed_next_trip`: remarks required.
 * `collection_point_ids` is sent only for a bin trip, where at least one stop
 * must be carried over; a household trip omits it and carries everything.
 */
export const proceedNextTripSchema = z.object({
  collection_point_ids: z
    .array(z.string())
    .min(1, "Select at least one collection point to carry over.")
    .optional(),
  remarks: requiredRemarks(),
});
