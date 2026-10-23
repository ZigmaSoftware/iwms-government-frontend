import { z } from "zod";

import { requiredString } from "@/schemas/shared/fields";
import { optionalRemarks, requiredRemarks } from "@/schemas/core_modules/shared/remarks.schema";

/**
 * Payload rules for the complaint-ticket workflow actions
 * (`ComplaintTicketViewSet`):
 *
 * - `status`: `status_code` is required; `remarks` is optional.
 * - `resolve`: `resolution_note` is optional (defaults to "Marked as resolved").
 * - `cleanup/{approve|reject}`: `remarks` is required (blank is a 400).
 * - `reopen`: `reopen_reason` is required (blank is a 400).
 *
 * All the text fields are unbounded `TextField`s server-side, so they share
 * the UI cap from `REMARKS_MAX_LENGTH`.
 */
export const ticketChangeStatusSchema = z.object({
  status_code: requiredString("Status"),
  remarks: optionalRemarks(),
});

export const ticketResolveSchema = z.object({
  resolution_note: optionalRemarks({ label: "Remarks" }),
});

export const ticketCleanupReviewSchema = z.object({
  remarks: requiredRemarks({ requiredMessage: "Please enter remarks." }),
});

export const ticketReopenSchema = z.object({
  reopen_reason: requiredRemarks({
    label: "Reason for reopening",
    requiredMessage: "Please enter the reason for reopening.",
  }),
});
