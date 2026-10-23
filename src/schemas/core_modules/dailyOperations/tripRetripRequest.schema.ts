import { z } from "zod";

import { optionalRemarks } from "@/schemas/core_modules/shared/remarks.schema";

/**
 * `TripRetripViewSet.approve` / `.reject`. Remarks are optional on both.
 * `collection_point_ids` is sent only for bin trips; an empty list is legal
 * (the continuation trip then carries no bin stops), so no minimum here.
 */
export const retripApproveSchema = z.object({
  collection_point_ids: z.array(z.string()).optional(),
  remarks: optionalRemarks(),
});

export const retripRejectSchema = z.object({
  remarks: optionalRemarks(),
});
